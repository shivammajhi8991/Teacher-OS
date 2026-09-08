import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/error/failure.dart';
import '../../../../core/sync/sync_engine.dart';
import '../../../../core/theme/modernist.dart';
import '../../../../core/widgets/empty_state.dart';
import '../../../../core/widgets/error_view.dart';
import '../../../../core/widgets/loading_view.dart';
import '../../../../core/widgets/modernist_primitives.dart';
import '../../../../core/widgets/sync_status_chip.dart' as chip;
import '../../domain/entities/attendance_roster.dart';
import '../providers/attendance_providers.dart';

/// docs/08 §8.3 Quick Attendance — the flagship flow, redesigned.
///
/// Unchanged from the original: every student defaults to Present, so an ordinary class is
/// still open-and-Save; a failed Save queues through `core/sync` and optimistically merges into
/// the cached roster (docs/05 §5.4). Same providers, same repository call, same class name and
/// constructor — this is a drop-in replacement for the previous file.
///
/// Three design changes:
///  1. **Direct selection instead of a cycling chip.** The old `ActionChip` cycled
///     Present → Absent → Late → Excused, so recording one excused student cost four taps and
///     the current state was only legible by reading the label. Each row now carries all four
///     states as an [MSegmented] control: any state is one tap, and the row reads at a glance.
///  2. **A live count strip.** The teacher can see what they are about to save without
///     scrolling the roster, and the Save label states it too.
///  3. **The class is named on screen.** The old app bar said "Quick Attendance" and the date
///     appeared as a raw ISO string in the body; pass [className] and the header carries the
///     class, the date and the time instead.
class QuickAttendanceScreen extends ConsumerStatefulWidget {
  const QuickAttendanceScreen({
    super.key,
    required this.classId,
    this.initialDate,
    this.className,
    this.scheduleLabel,
  });

  final String classId;
  final String? initialDate;

  /// Shown as the screen title. Falls back to "Attendance" when the caller has no name to
  /// hand (the class-detail screen always does — see `class_detail_screen.dart`).
  final String? className;

  /// Optional "16:00 — 17:00" style label for the header kicker.
  final String? scheduleLabel;

  @override
  ConsumerState<QuickAttendanceScreen> createState() => _QuickAttendanceScreenState();
}

class _QuickAttendanceScreenState extends ConsumerState<QuickAttendanceScreen> {
  static const _states = <({String value, String label})>[
    (value: 'present', label: 'Present'),
    (value: 'absent', label: 'Absent'),
    (value: 'late', label: 'Late'),
    (value: 'excused', label: 'Excused'),
  ];

  late String _date = widget.initialDate ?? DateTime.now().toIso8601String().substring(0, 10);
  List<RosterEntry> _students = [];
  Map<String, String>? _localStatuses; // null until seeded from the loaded roster
  bool _isSaving = false;
  String? _errorMessage;

  RosterKey get _key => (classId: widget.classId, date: _date);

  void _seedFromRoster(AttendanceRoster roster) {
    if (_localStatuses != null) return; // already seeded — don't clobber the teacher's taps
    _students = roster.students;
    _localStatuses = {
      for (final s in roster.students) s.studentId: s.status ?? 'present', // default-Present
    };
  }

  void _setStatus(String studentId, String status) {
    setState(() => _localStatuses![studentId] = status);
  }

  int _count(String status) =>
      _localStatuses?.values.where((s) => s == status).length ?? 0;

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime.parse(_date),
      firstDate: DateTime(2020),
      lastDate: DateTime(2035),
    );
    if (picked == null) return;
    setState(() {
      _date = picked.toIso8601String().substring(0, 10);
      _localStatuses = null; // force reseed for the new date
    });
  }

  Future<void> _save() async {
    if (_localStatuses == null) return;
    setState(() {
      _isSaving = true;
      _errorMessage = null;
    });

    final records = [
      for (final entry in _localStatuses!.entries)
        (studentId: entry.key, status: entry.value, notes: null as String?),
    ];
    final result =
        await ref.read(attendanceRepositoryProvider).bulkMark(widget.classId, _date, records);

    if (!mounted) return;
    result.fold(
      (failure) => setState(() {
        _isSaving = false;
        _errorMessage = failure.message;
      }),
      (roster) {
        setState(() => _isSaving = false);
        ref.invalidate(rosterProvider(_key));
        final pending = ref.read(syncEngineProvider).pendingCount;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              pending > 0 ? 'Saved locally — will sync when back online.' : 'Attendance saved.',
            ),
          ),
        );
        if (roster.skippedStudentIds.isNotEmpty) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                '${roster.skippedStudentIds.length} student(s) skipped — not enrolled on $_date.',
              ),
            ),
          );
        }
      },
    );
  }

  chip.SyncStatus _mapSyncStatus(SyncEngineStatus status) => switch (status) {
        SyncEngineStatus.synced => chip.SyncStatus.synced,
        SyncEngineStatus.syncing => chip.SyncStatus.syncing,
        SyncEngineStatus.pending => chip.SyncStatus.pending,
        SyncEngineStatus.error => chip.SyncStatus.conflict,
      };

  String get _saveLabel {
    final present = _count('present');
    final total = _students.length;
    if (total == 0) return 'Save';
    final flagged = total - present;
    return flagged == 0
        ? 'Save · all $total present'
        : 'Save · $present present, $flagged flagged';
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final rosterAsync = ref.watch(rosterProvider(_key));
    final syncState = ref.watch(syncEngineProvider);

    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            // ── Header. Flush left, no app bar: the title is the class, not the feature.
            Padding(
              padding: const EdgeInsets.fromLTRB(M.gutter, M.s2, M.s3, M.s3),
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
                          [
                            'Attendance',
                            _friendlyDate(_date),
                            if (widget.scheduleLabel != null) widget.scheduleLabel!,
                          ].join(' · ').toUpperCase(),
                          style: M.kicker.copyWith(
                            letterSpacing: 1.32,
                            color: scheme.onSurfaceVariant,
                          ),
                        ),
                        const SizedBox(height: 7),
                        Text(widget.className ?? 'Attendance', style: M.sectionTitle),
                      ],
                    ),
                  ),
                  const SizedBox(width: M.s2),
                  chip.SyncStatusChip(
                    status: _mapSyncStatus(syncState.status),
                    count: syncState.pendingCount,
                  ),
                  _SquareIconButton(
                    icon: Icons.calendar_today_outlined,
                    tooltip: 'Change date',
                    onPressed: _pickDate,
                  ),
                ],
              ),
            ),
            Expanded(
              child: rosterAsync.when(
                loading: () => const LoadingView(),
                error: (error, stackTrace) => ErrorView(
                  failure: UnexpectedFailure(message: error.toString()),
                  onRetry: () => ref.invalidate(rosterProvider(_key)),
                ),
                data: (result) => result.fold(
                  (failure) => ErrorView(
                    failure: failure,
                    onRetry: () => ref.invalidate(rosterProvider(_key)),
                  ),
                  (roster) {
                    if (roster.isCancelled) {
                      return EmptyState(
                        icon: Icons.event_busy_outlined,
                        message: "This occurrence is ${roster.cancellationReason ?? 'cancelled'} — "
                            "attendance can't be recorded for it.",
                      );
                    }
                    _seedFromRoster(roster);
                    if (_students.isEmpty) {
                      return const EmptyState(message: 'No students enrolled in this class yet.');
                    }
                    return _RosterBody(
                      students: _students,
                      statuses: _localStatuses!,
                      onStatus: _setStatus,
                      counts: (
                        present: _count('present'),
                        absent: _count('absent'),
                        late: _count('late'),
                        excused: _count('excused'),
                      ),
                    );
                  },
                ),
              ),
            ),
            if (_localStatuses != null && _students.isNotEmpty)
              Container(
                decoration: BoxDecoration(
                  border: Border(top: BorderSide(color: scheme.outline, width: 2)),
                ),
                child: SafeArea(
                  top: false,
                  minimum: const EdgeInsets.fromLTRB(M.gutter, M.s4, M.gutter, M.s4),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (_errorMessage != null) ...[
                        Text(
                          _errorMessage!,
                          style: M.meta.copyWith(color: scheme.error),
                        ),
                        const SizedBox(height: M.s3),
                      ],
                      MPrimaryAction(
                        label: _saveLabel,
                        busy: _isSaving,
                        onPressed: _save,
                      ),
                      const SizedBox(height: M.s3),
                      Text(
                        syncState.pendingCount > 0
                            ? 'Offline — this save joins ${syncState.pendingCount} queued change(s) and syncs when you reconnect.'
                            : 'Everyone starts Present, so an ordinary class is a single tap.',
                        style: M.meta.copyWith(color: scheme.onSurfaceVariant),
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  /// "2026-09-08" → "TUE 8 SEP". The old screen printed the raw ISO string.
  static String _friendlyDate(String iso) {
    final d = DateTime.parse(iso);
    const dows = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    return '${dows[d.weekday - 1]} ${d.day} ${months[d.month - 1]}';
  }
}

class _RosterBody extends StatelessWidget {
  const _RosterBody({
    required this.students,
    required this.statuses,
    required this.onStatus,
    required this.counts,
  });

  final List<RosterEntry> students;
  final Map<String, String> statuses;
  final void Function(String studentId, String status) onStatus;
  final ({int present, int absent, int late, int excused}) counts;

  @override
  Widget build(BuildContext context) {
    return CustomScrollView(
      slivers: [
        // Count strip — sticks under the header while the roster scrolls.
        SliverPersistentHeader(
          pinned: true,
          delegate: _CountStripDelegate(counts: counts),
        ),
        SliverList.separated(
          itemCount: students.length,
          separatorBuilder: (_, __) => const MRowRule(),
          itemBuilder: (context, index) {
            final student = students[index];
            final status = statuses[student.studentId] ?? 'present';
            return Padding(
              padding: const EdgeInsets.fromLTRB(M.gutter, 14, M.gutter, M.s4),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(student.studentFullName, style: M.row),
                  const SizedBox(height: 11),
                  MSegmented<String>(
                    options: _QuickAttendanceScreenState._states,
                    value: status,
                    // Absent is the one state that costs the student something — it fills red
                    // so a marked absence is visible while scrolling.
                    accentValues: const {'absent'},
                    onChanged: (v) => onStatus(student.studentId, v),
                  ),
                ],
              ),
            );
          },
        ),
        const SliverToBoxAdapter(child: SizedBox(height: M.s6)),
      ],
    );
  }
}

class _CountStripDelegate extends SliverPersistentHeaderDelegate {
  _CountStripDelegate({required this.counts});

  final ({int present, int absent, int late, int excused}) counts;

  // README spec: 74px. MStatCells' actual content at that height + its 2px top/bottom border
  // overflowed by 7px (M.data's 24px value line + M.s2's 8px gap + the 13px label line + M.s4's
  // 16px top/bottom padding genuinely needs ~77px, not 70) — reproduced in
  // quick_attendance_screen_test.dart. This is this screen's own private layout constant, not a
  // shared M.* token, so widening it to comfortably fit is "adapt the call," the same principle
  // behind MStatCells' perRow fix just above.
  static const _height = 82.0;

  @override
  double get minExtent => _height;

  @override
  double get maxExtent => _height;

  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      height: _height,
      decoration: BoxDecoration(
        color: scheme.surfaceContainerLow,
        border: Border.symmetric(
          horizontal: BorderSide(color: scheme.outline, width: 2),
        ),
      ),
      child: MStatCells(
        // All 4 in one row — this strip is a fixed 74px band, not the dashboard's scrollable
        // footer grid, so it can't absorb MStatCells' default 3-per-row wrap into a second row.
        perRow: 4,
        cells: [
          (label: 'Present', value: '${counts.present}', tone: null),
          (label: 'Absent', value: '${counts.absent}', tone: counts.absent > 0 ? M.accent700 : null),
          (label: 'Late', value: '${counts.late}', tone: null),
          (label: 'Excused', value: '${counts.excused}', tone: null),
        ],
      ),
    );
  }

  @override
  bool shouldRebuild(_CountStripDelegate oldDelegate) => oldDelegate.counts != counts;
}

/// A 44px square icon button with a 1px rule — the system's `.btn-icon`, sized for touch.
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
