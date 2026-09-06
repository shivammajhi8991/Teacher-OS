import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/error/failure.dart';
import '../../../../core/widgets/empty_state.dart';
import '../../../../core/widgets/error_view.dart';
import '../../../../core/widgets/loading_view.dart';
import '../../../performance/presentation/providers/performance_providers.dart';

/// docs/08 §8.2 Parent "Performance | Metric history for the child | Dashboard" — the item
/// explicitly deferred out of Phase 5 step 2 (Performance tracking, teacher-facing only) to this
/// step. Read-only, reusing the same `GET /students/:id/performance` endpoint and access check
/// (guardian-linked read) the teacher-facing Student Detail screen already uses.
class ChildPerformanceScreen extends ConsumerWidget {
  const ChildPerformanceScreen({super.key, required this.studentId, required this.childName});

  final String studentId;
  final String childName;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final recordsAsync = ref.watch(studentPerformanceProvider(studentId));

    return Scaffold(
      appBar: AppBar(title: Text("$childName's performance")),
      body: recordsAsync.when(
        loading: () => const LoadingView(),
        error: (error, stackTrace) => ErrorView(
          failure: UnexpectedFailure(message: error.toString()),
          onRetry: () => ref.invalidate(studentPerformanceProvider(studentId)),
        ),
        data: (result) => result.fold(
          (failure) => ErrorView(failure: failure, onRetry: () => ref.invalidate(studentPerformanceProvider(studentId))),
          (records) => records.isEmpty
              ? const EmptyState(icon: Icons.insights_outlined, message: 'No performance records yet.')
              : ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: records.length,
                  separatorBuilder: (_, __) => const Divider(),
                  itemBuilder: (context, index) {
                    final record = records[index];
                    final display = record.unit != null ? '${record.value} ${record.unit}' : record.value;
                    return ListTile(
                      title: Text(record.metricName),
                      subtitle: Text(record.recordedAt.toLocal().toString().substring(0, 10)),
                      trailing: Chip(label: Text(display), visualDensity: VisualDensity.compact),
                    );
                  },
                ),
        ),
      ),
    );
  }
}
