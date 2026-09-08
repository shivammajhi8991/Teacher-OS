import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../../core/error/failure.dart';
import '../../../../core/theme/modernist.dart';
import '../../../../core/widgets/empty_state.dart';
import '../../../../core/widgets/error_view.dart';
import '../../../../core/widgets/loading_view.dart';
import '../../../../core/widgets/modernist_primitives.dart';
import '../../domain/entities/calendar_event.dart';
import '../providers/calendar_providers.dart';

/// docs/08 §8.2 "Calendar" (all four roles, reached from a Dashboard quick action) — one shared
/// screen; `GET /calendar` already scopes to the caller automatically (own classes, own
/// enrollments, every linked child's, or own institute), so this passes no owner filter, only a
/// date range. Shows a week at a time with Prev/Next navigation; a conflicting class occurrence
/// (docs/03 §3.5) gets a visible warning chip rather than being silently included.
///
/// Modernist redesign (design_handoff_modernist/README.md's "Calendar week" row): "Replace the
/// day-grouped list with a 7-cell week strip... over a day list." The old screen listed every
/// day in the range at once; this one shows one week-strip cell per day (tap to pick a day) and
/// the selected day's events below it. Also fixes the two bugs the README calls out by name:
///  - The old header printed the fetched range as raw `2026-09-08 – 2026-09-14` ISO strings.
///    Gone — replaced by "This week" / "Week of 8 Sep" plus a month/year kicker.
///  - `assignment_due` and `fee_due` events are instants (`calendar.service.ts` sets
///    `startsAt == endsAt`, both a plain due date/time, never a real span), so the old
///    `"${start} – ${end}"` formatting rendered a midnight due date as "00:00 – 00:00". Fixed in
///    [_TimeColumn]: an instant event shows its one time (or just "DUE" when that instant is
///    exactly midnight, since a due *date* rarely carries a meaningful time-of-day) instead of a
///    fake range.
class CalendarScreen extends ConsumerStatefulWidget {
  const CalendarScreen({super.key});

  @override
  ConsumerState<CalendarScreen> createState() => _CalendarScreenState();
}

class _CalendarScreenState extends ConsumerState<CalendarScreen> {
  late DateTime _weekStart = _startOfWeek(DateTime.now());
  late DateTime _selectedDate = _startOfDay(DateTime.now());

  DateTime _startOfDay(DateTime d) => DateTime(d.year, d.month, d.day);

  DateTime _startOfWeek(DateTime d) => _startOfDay(d).subtract(Duration(days: d.weekday - 1));

  String _apiFmt(DateTime d) => d.toIso8601String().substring(0, 10);

  void _shiftWeek(int deltaWeeks) {
    setState(() {
      _weekStart = _weekStart.add(Duration(days: 7 * deltaWeeks));
      _selectedDate = _weekStart;
    });
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final weekEnd = _weekStart.add(const Duration(days: 6));
    final range = (from: _apiFmt(_weekStart), to: _apiFmt(weekEnd));
    final calendarAsync = ref.watch(calendarProvider(range));

    final isCurrentWeek = !_startOfDay(DateTime.now()).isBefore(_weekStart) &&
        !_startOfDay(DateTime.now()).isAfter(weekEnd);

    return Scaffold(
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () async => ref.invalidate(calendarProvider(range)),
          child: calendarAsync.when(
            loading: () => const LoadingView(),
            error: (error, stackTrace) => ErrorView(
              failure: UnexpectedFailure(message: error.toString()),
              onRetry: () => ref.invalidate(calendarProvider(range)),
            ),
            data: (result) => result.fold(
              (failure) =>
                  ErrorView(failure: failure, onRetry: () => ref.invalidate(calendarProvider(range))),
              (events) => _buildWeek(context, scheme, events, isCurrentWeek),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildWeek(
    BuildContext context,
    ColorScheme scheme,
    List<CalendarEvent> events,
    bool isCurrentWeek,
  ) {
    final byDay = <String, List<CalendarEvent>>{};
    for (final e in events) {
      byDay.putIfAbsent(_apiFmt(_startOfDay(e.startsAt.toLocal())), () => []).add(e);
    }
    final dayEvents = byDay[_apiFmt(_selectedDate)] ?? const <CalendarEvent>[];
    final conflicts = events.where((e) => e.conflict).toList()
      ..sort((a, b) => a.startsAt.compareTo(b.startsAt));

    return ListView(
      padding: EdgeInsets.zero,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(M.gutter, M.s1, M.gutter, M.s4),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _SquareIconButton(
                icon: Icons.arrow_back,
                tooltip: 'Back',
                onPressed: () => Navigator.of(context).maybePop(),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      DateFormat('MMMM y').format(_weekStart).toUpperCase(),
                      style: M.kicker.copyWith(letterSpacing: 1.54, color: scheme.onSurfaceVariant),
                    ),
                    const SizedBox(height: 7),
                    Text(
                      isCurrentWeek ? 'This week' : 'Week of ${DateFormat('d MMM').format(_weekStart)}',
                      style: M.screenTitle,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: M.s2),
              Container(
                decoration: BoxDecoration(border: Border.all(color: scheme.outline)),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    _WeekNavButton(
                      icon: Icons.arrow_back,
                      tooltip: 'Previous week',
                      onPressed: () => _shiftWeek(-1),
                      trailingRule: true,
                    ),
                    _WeekNavButton(
                      icon: Icons.arrow_forward,
                      tooltip: 'Next week',
                      onPressed: () => _shiftWeek(1),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        _WeekStrip(
          weekStart: _weekStart,
          selectedDate: _selectedDate,
          countByDay: {for (final e in byDay.entries) e.key: e.value.length},
          onSelect: (d) => setState(() => _selectedDate = d),
        ),
        MSectionLabel(DateFormat('EEEE, d MMM').format(_selectedDate)),
        if (dayEvents.isEmpty)
          const _EmptyRow('Nothing scheduled this day.')
        else
          for (final (i, event) in dayEvents.indexed) ...[
            if (i > 0) const MRowRule(),
            MRow(
              leading: _TimeColumn(event: event),
              title: event.title,
              sub: _subLabel(event),
              trailing: event.conflict ? const MTag('Clash', emphasis: true) : null,
            ),
          ],
        if (conflicts.isNotEmpty)
          Padding(
            padding: const EdgeInsets.all(M.gutter),
            child: Text(_conflictNote(conflicts), style: M.meta.copyWith(color: scheme.onSurfaceVariant)),
          ),
        if (events.isEmpty)
          const Padding(
            padding: EdgeInsets.only(top: 40),
            child: EmptyState(icon: Icons.event_note_outlined, message: 'Nothing scheduled this week.'),
          ),
        const SizedBox(height: M.s6),
      ],
    );
  }

  String _subLabel(CalendarEvent event) {
    if (event.conflict) {
      return switch (event.conflictReason) {
        'teacher_double_booking' => 'Teacher double-booking',
        'location_conflict' => 'Location conflict',
        _ => 'Scheduling conflict',
      };
    }
    return switch (event.eventType) {
      'class_occurrence' => 'Class',
      'assignment_due' => 'Assignment due',
      'fee_due' => 'Fee due',
      _ => event.eventType,
    };
  }

  String _conflictNote(List<CalendarEvent> conflicts) {
    final first = conflicts.first;
    final time = DateFormat('HH:mm').format(first.startsAt.toLocal());
    final day = DateFormat('EEEE').format(first.startsAt.toLocal());
    final plural = conflicts.length == 1 ? '1 class conflicts' : '${conflicts.length} classes conflict';
    return '$plural this week — the first at $time on $day. Tap CLASH to move one; the conflict '
        'rules are the same ones the class form already enforces.';
  }
}

/// The 52px time column the README specs for each day row. `MRow`'s `leading` slot takes any
/// widget, so this composes into the existing primitive rather than needing a new row shape.
///
/// `startsAt == endsAt` marks an instant (a due date, not a real span — see the class doc
/// comment above) — shown as its one time, or just "DUE" when that instant is exactly midnight,
/// instead of the old screen's fabricated "00:00 – 00:00" range.
class _TimeColumn extends StatelessWidget {
  const _TimeColumn({required this.event});

  final CalendarEvent event;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final start = event.startsAt.toLocal();
    final end = event.endsAt.toLocal();
    final isInstant = start.isAtSameMomentAs(end);
    final isMidnight = start.hour == 0 && start.minute == 0;

    final topLabel = isInstant && isMidnight ? 'DUE' : DateFormat('HH:mm').format(start);
    final bottomLabel = isInstant ? (isMidnight ? null : 'DUE') : DateFormat('HH:mm').format(end);

    return SizedBox(
      width: 52,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(topLabel, style: M.dataSmall.copyWith(color: scheme.onSurface)),
          if (bottomLabel != null) ...[
            const SizedBox(height: 5),
            Text(
              bottomLabel,
              style: M.meta.copyWith(fontSize: 11.5, color: scheme.onSurfaceVariant),
            ),
          ],
        ],
      ),
    );
  }
}

/// The 7-cell week strip: equal-width days, 1px internal rules, 2px top/bottom border, the
/// selected day fills ink — the same visual grammar as `MSegmented`, just with three lines of
/// per-cell content (day-of-week, date, event count) instead of one label, which the shared
/// primitive's single-`Text` cell doesn't support.
class _WeekStrip extends StatelessWidget {
  const _WeekStrip({
    required this.weekStart,
    required this.selectedDate,
    required this.countByDay,
    required this.onSelect,
  });

  final DateTime weekStart;
  final DateTime selectedDate;
  final Map<String, int> countByDay;
  final ValueChanged<DateTime> onSelect;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final days = List.generate(7, (i) => weekStart.add(Duration(days: i)));

    return Container(
      decoration: BoxDecoration(
        border: Border(
          top: BorderSide(color: scheme.outline, width: 2),
          bottom: BorderSide(color: scheme.outline, width: 2),
        ),
      ),
      child: Row(
        children: [
          for (final (i, day) in days.indexed) ...[
            if (i > 0) Container(width: 1, color: scheme.outlineVariant),
            Expanded(
              child: Builder(
                builder: (context) {
                  final key = '${day.year.toString().padLeft(4, '0')}-'
                      '${day.month.toString().padLeft(2, '0')}-'
                      '${day.day.toString().padLeft(2, '0')}';
                  final selected = day.year == selectedDate.year &&
                      day.month == selectedDate.month &&
                      day.day == selectedDate.day;
                  final count = countByDay[key] ?? 0;
                  return Semantics(
                    selected: selected,
                    button: true,
                    child: InkWell(
                      onTap: () => onSelect(day),
                      child: Container(
                        color: selected ? scheme.onSurface : null,
                        padding: const EdgeInsets.symmetric(vertical: M.s3, horizontal: M.s2),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.center,
                          children: [
                            Text(
                              DateFormat('EEE').format(day).toUpperCase(),
                              style: M.meta.copyWith(
                                fontSize: 10,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 0.6,
                                color: selected
                                    ? scheme.surface.withValues(alpha: 0.75)
                                    : scheme.onSurfaceVariant,
                              ),
                            ),
                            const SizedBox(height: 7),
                            Text(
                              '${day.day}',
                              style: M.dataSmall.copyWith(
                                color: selected ? scheme.surface : scheme.onSurface,
                              ),
                            ),
                            const SizedBox(height: 7),
                            Text(
                              count > 0 ? '$count' : '—',
                              style: M.meta.copyWith(
                                fontSize: 11,
                                color: selected
                                    ? scheme.surface.withValues(alpha: 0.75)
                                    : scheme.onSurfaceVariant,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// A pair of 44px square icon buttons sharing one outer border, matching the prototype's
/// Prev/Next control. [trailingRule] draws the 1px divider between the two.
class _WeekNavButton extends StatelessWidget {
  const _WeekNavButton({
    required this.icon,
    required this.onPressed,
    this.tooltip,
    this.trailingRule = false,
  });

  final IconData icon;
  final VoidCallback onPressed;
  final String? tooltip;
  final bool trailingRule;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      decoration: trailingRule
          ? BoxDecoration(border: Border(right: BorderSide(color: scheme.outline)))
          : null,
      child: Tooltip(
        message: tooltip ?? '',
        child: InkWell(
          onTap: onPressed,
          child: SizedBox(
            width: M.tapMin,
            height: M.tapMin,
            child: Icon(icon, size: 18, color: scheme.onSurface),
          ),
        ),
      ),
    );
  }
}

class _EmptyRow extends StatelessWidget {
  const _EmptyRow(this.message);

  final String message;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.fromLTRB(M.gutter, M.s2, M.gutter, M.s4),
      child: Text(message, style: M.meta.copyWith(color: scheme.onSurfaceVariant)),
    );
  }
}

/// Same shape as `student_detail_screen.dart`'s own `_SquareIconButton` — screen-local by the
/// same precedent set there, not promoted into `modernist_primitives.dart`.
class _SquareIconButton extends StatelessWidget {
  const _SquareIconButton({required this.icon, required this.onPressed, this.tooltip});

  final IconData icon;
  final VoidCallback onPressed;
  final String? tooltip;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Tooltip(
      message: tooltip ?? '',
      child: InkWell(
        onTap: onPressed,
        child: Container(
          width: M.tapMin,
          height: M.tapMin,
          decoration: BoxDecoration(border: Border.all(color: scheme.outline)),
          child: Icon(icon, size: 20, color: scheme.onSurface),
        ),
      ),
    );
  }
}
