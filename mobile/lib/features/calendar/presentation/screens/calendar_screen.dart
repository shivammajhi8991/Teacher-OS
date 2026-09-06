import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/error/failure.dart';
import '../../../../core/widgets/empty_state.dart';
import '../../../../core/widgets/error_view.dart';
import '../../../../core/widgets/loading_view.dart';
import '../../domain/entities/calendar_event.dart';
import '../providers/calendar_providers.dart';

/// docs/08 §8.2 "Calendar" (all four roles, reached from a Dashboard quick action) — one shared
/// screen; `GET /calendar` already scopes to the caller automatically (own classes, own
/// enrollments, every linked child's, or own institute), so this passes no owner filter, only a
/// date range. Shows a week at a time with Prev/Next navigation; a conflicting class occurrence
/// (docs/03 §3.5) gets a visible warning chip rather than being silently included.
class CalendarScreen extends ConsumerStatefulWidget {
  const CalendarScreen({super.key});

  @override
  ConsumerState<CalendarScreen> createState() => _CalendarScreenState();
}

class _CalendarScreenState extends ConsumerState<CalendarScreen> {
  late DateTime _weekStart = _startOfWeek(DateTime.now());

  DateTime _startOfWeek(DateTime d) => DateTime(d.year, d.month, d.day).subtract(Duration(days: d.weekday - 1));

  String _fmt(DateTime d) => d.toIso8601String().substring(0, 10);

  void _shiftWeek(int deltaWeeks) {
    setState(() => _weekStart = _weekStart.add(Duration(days: 7 * deltaWeeks)));
  }

  @override
  Widget build(BuildContext context) {
    final weekEnd = _weekStart.add(const Duration(days: 6));
    final range = (from: _fmt(_weekStart), to: _fmt(weekEnd));
    final calendarAsync = ref.watch(calendarProvider(range));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Calendar'),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(48),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                IconButton(
                  icon: const Icon(Icons.chevron_left),
                  tooltip: 'Previous week',
                  onPressed: () => _shiftWeek(-1),
                ),
                Text('${_fmt(_weekStart)} – ${_fmt(weekEnd)}'),
                IconButton(
                  icon: const Icon(Icons.chevron_right),
                  tooltip: 'Next week',
                  onPressed: () => _shiftWeek(1),
                ),
              ],
            ),
          ),
        ),
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(calendarProvider(range)),
        child: calendarAsync.when(
          loading: () => const LoadingView(),
          error: (error, stackTrace) => ErrorView(
            failure: UnexpectedFailure(message: error.toString()),
            onRetry: () => ref.invalidate(calendarProvider(range)),
          ),
          data: (result) => result.fold(
            (failure) => ErrorView(failure: failure, onRetry: () => ref.invalidate(calendarProvider(range))),
            (events) => events.isEmpty
                ? ListView(
                    children: const [
                      SizedBox(height: 80),
                      EmptyState(icon: Icons.event_note_outlined, message: 'Nothing scheduled this week.'),
                    ],
                  )
                : _buildDayGroups(events),
          ),
        ),
      ),
    );
  }

  Widget _buildDayGroups(List<CalendarEvent> events) {
    final byDay = <String, List<CalendarEvent>>{};
    for (final e in events) {
      final key = _fmt(e.startsAt.toLocal());
      byDay.putIfAbsent(key, () => []).add(e);
    }
    final days = byDay.keys.toList()..sort();

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        for (final day in days) ...[
          Padding(
            padding: const EdgeInsets.only(top: 8, bottom: 4),
            child: Text(day, style: Theme.of(context).textTheme.titleSmall),
          ),
          for (final event in byDay[day]!) _EventTile(event: event),
        ],
      ],
    );
  }
}

class _EventTile extends StatelessWidget {
  const _EventTile({required this.event});

  final CalendarEvent event;

  IconData get _icon => switch (event.eventType) {
        'class_occurrence' => Icons.class_outlined,
        'assignment_due' => Icons.assignment_outlined,
        'fee_due' => Icons.payments_outlined,
        _ => Icons.event_outlined,
      };

  String _time(DateTime d) {
    final local = d.toLocal();
    return '${local.hour.toString().padLeft(2, '0')}:${local.minute.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: Icon(_icon),
        title: Text(event.title),
        subtitle: Text('${_time(event.startsAt)} – ${_time(event.endsAt)}'),
        trailing: event.conflict
            ? Chip(
                label: const Text('Conflict'),
                backgroundColor: Theme.of(context).colorScheme.errorContainer,
                labelStyle: TextStyle(color: Theme.of(context).colorScheme.onErrorContainer, fontSize: 12),
                side: BorderSide.none,
                visualDensity: VisualDensity.compact,
              )
            : null,
      ),
    );
  }
}
