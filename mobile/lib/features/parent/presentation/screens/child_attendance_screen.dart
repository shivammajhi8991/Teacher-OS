import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/error/failure.dart';
import '../../../../core/widgets/empty_state.dart';
import '../../../../core/widgets/error_view.dart';
import '../../../../core/widgets/loading_view.dart';
import '../../../attendance/presentation/providers/attendance_providers.dart';

/// docs/07 roadmap Phase 4 step 5's own deferred item ("a mobile history/percentage-view screen
/// — the backend endpoint exists and is usable, no screen consumes it yet"), picked up here as
/// Phase 5 step 3's natural first consumer: a parent viewing their child's attendance record.
class ChildAttendanceScreen extends ConsumerWidget {
  const ChildAttendanceScreen({super.key, required this.studentId, required this.childName});

  final String studentId;
  final String childName;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final historyAsync = ref.watch(studentAttendanceHistoryProvider(studentId));

    return Scaffold(
      appBar: AppBar(title: Text("$childName's attendance")),
      body: historyAsync.when(
        loading: () => const LoadingView(),
        error: (error, stackTrace) => ErrorView(
          failure: UnexpectedFailure(message: error.toString()),
          onRetry: () => ref.invalidate(studentAttendanceHistoryProvider(studentId)),
        ),
        data: (result) => result.fold(
          (failure) =>
              ErrorView(failure: failure, onRetry: () => ref.invalidate(studentAttendanceHistoryProvider(studentId))),
          (history) => history.records.isEmpty
              ? const EmptyState(icon: Icons.fact_check_outlined, message: 'No attendance recorded yet.')
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          children: [
                            Text(
                              history.percentage != null ? '${history.percentage!.round()}%' : '—',
                              style: Theme.of(context).textTheme.displaySmall,
                            ),
                            const SizedBox(height: 4),
                            const Text('Overall attendance'),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    for (final entry in history.records)
                      ListTile(
                        leading: Icon(_iconFor(entry.status), color: _colorFor(context, entry.status)),
                        title: Text(entry.className),
                        subtitle: Text(entry.occurrenceDate),
                        trailing: Chip(
                          label: Text(entry.status),
                          visualDensity: VisualDensity.compact,
                        ),
                      ),
                  ],
                ),
        ),
      ),
    );
  }

  IconData _iconFor(String status) => switch (status) {
        'present' => Icons.check_circle_outline,
        'late' => Icons.schedule,
        'excused' => Icons.info_outline,
        _ => Icons.cancel_outlined,
      };

  Color? _colorFor(BuildContext context, String status) => switch (status) {
        'present' => Colors.green.shade600,
        'absent' => Theme.of(context).colorScheme.error,
        _ => null,
      };
}
