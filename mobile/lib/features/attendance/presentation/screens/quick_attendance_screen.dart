import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/error/failure.dart';
import '../../../../core/sync/sync_engine.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/empty_state.dart';
import '../../../../core/widgets/error_view.dart';
import '../../../../core/widgets/loading_view.dart';
import '../../../../core/widgets/sync_status_chip.dart' as chip;
import '../../domain/entities/attendance_roster.dart';
import '../providers/attendance_providers.dart';

/// docs/08 §8.3 Quick Attendance — the flagship 2-tap flow: open the class (1) → Save (2), with
/// every student defaulted to Present so only exceptions need a tap. Handles offline saves via
/// core/sync (docs/05 §5.4): a queued Save still updates this screen immediately, optimistically.
class QuickAttendanceScreen extends ConsumerStatefulWidget {
  const QuickAttendanceScreen({super.key, required this.classId, this.initialDate});

  final String classId;
  final String? initialDate;

  @override
  ConsumerState<QuickAttendanceScreen> createState() => _QuickAttendanceScreenState();
}

class _QuickAttendanceScreenState extends ConsumerState<QuickAttendanceScreen> {
  static const _cycle = ['present', 'absent', 'late', 'excused'];

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

  void _cycleStatus(String studentId) {
    setState(() {
      final current = _localStatuses![studentId] ?? 'present';
      final next = _cycle[(_cycle.indexOf(current) + 1) % _cycle.length];
      _localStatuses![studentId] = next;
    });
  }

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
    final result = await ref.read(attendanceRepositoryProvider).bulkMark(widget.classId, _date, records);

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

  @override
  Widget build(BuildContext context) {
    final rosterAsync = ref.watch(rosterProvider(_key));
    final syncState = ref.watch(syncEngineProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Quick Attendance'),
        actions: [
          chip.SyncStatusChip(status: _mapSyncStatus(syncState.status), count: syncState.pendingCount),
          IconButton(icon: const Icon(Icons.calendar_today), onPressed: _pickDate, tooltip: 'Change date'),
        ],
      ),
      body: rosterAsync.when(
        loading: () => const LoadingView(),
        error: (error, stackTrace) => ErrorView(
          failure: UnexpectedFailure(message: error.toString()),
          onRetry: () => ref.invalidate(rosterProvider(_key)),
        ),
        data: (result) => result.fold(
          (failure) => ErrorView(failure: failure, onRetry: () => ref.invalidate(rosterProvider(_key))),
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
            return Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                  child: Align(
                    alignment: Alignment.centerLeft,
                    child: Text('Date: $_date', style: Theme.of(context).textTheme.bodyMedium),
                  ),
                ),
                Expanded(
                  child: ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: _students.length,
                    separatorBuilder: (_, __) => const Divider(height: 1),
                    itemBuilder: (context, index) {
                      final student = _students[index];
                      final status = _localStatuses![student.studentId] ?? 'present';
                      return ListTile(
                        title: Text(student.studentFullName),
                        trailing: _StatusChipButton(
                          status: status,
                          onTap: () => _cycleStatus(student.studentId),
                        ),
                      );
                    },
                  ),
                ),
                if (_errorMessage != null)
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Text(_errorMessage!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
                  ),
                SafeArea(
                  minimum: const EdgeInsets.all(16),
                  child: ElevatedButton(
                    onPressed: _isSaving ? null : _save,
                    child: _isSaving ? const InlineSpinner() : const Text('Save'),
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _StatusChipButton extends StatelessWidget {
  const _StatusChipButton({required this.status, required this.onTap});

  final String status;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final (label, tone) = switch (status) {
      'present' => ('Present', AppStatusTone.success),
      'absent' => ('Absent', AppStatusTone.danger),
      'late' => ('Late', AppStatusTone.warning),
      'excused' => ('Excused', AppStatusTone.info),
      _ => (status, AppStatusTone.neutral),
    };
    final color = tone.color(context);
    return ActionChip(
      label: Text(label, style: TextStyle(color: color)),
      backgroundColor: color.withValues(alpha: 0.1),
      side: BorderSide(color: color),
      onPressed: onTap,
    );
  }
}
