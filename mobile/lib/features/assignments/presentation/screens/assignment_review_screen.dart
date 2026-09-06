import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/error/failure.dart';
import '../../../../core/widgets/empty_state.dart';
import '../../../../core/widgets/error_view.dart';
import '../../../../core/widgets/loading_view.dart';
import '../../../students/presentation/providers/students_providers.dart';
import '../../domain/entities/submission_summary.dart';
import '../providers/assignments_providers.dart';

/// docs/08 §8.2 "Review submissions: Per-student submission, feedback, grade." Reached by
/// tapping an assignment in the Class Detail screen's Assignments section.
class AssignmentReviewScreen extends ConsumerWidget {
  const AssignmentReviewScreen({super.key, required this.assignmentId, required this.title});

  final String assignmentId;
  final String title;

  Future<void> _openReviewDialog(
    BuildContext context,
    WidgetRef ref,
    SubmissionSummary submission,
  ) async {
    final gradeController = TextEditingController(text: submission.grade ?? '');
    final feedbackController = TextEditingController(text: submission.feedback ?? '');

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Review submission'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(controller: gradeController, decoration: const InputDecoration(labelText: 'Grade (optional)')),
            const SizedBox(height: 12),
            TextField(
              controller: feedbackController,
              decoration: const InputDecoration(labelText: 'Feedback (optional)'),
              maxLines: 3,
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.of(context).pop(true), child: const Text('Save review')),
        ],
      ),
    );
    if (confirmed != true || !context.mounted) return;

    final result = await ref.read(assignmentsRepositoryProvider).reviewSubmission(
          submissionId: submission.id,
          grade: gradeController.text.trim().isEmpty ? null : gradeController.text.trim(),
          feedback: feedbackController.text.trim().isEmpty ? null : feedbackController.text.trim(),
        );
    if (!context.mounted) return;
    result.fold(
      (failure) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(failure.message))),
      (_) => ref.invalidate(assignmentSubmissionsProvider(assignmentId)),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final submissionsAsync = ref.watch(assignmentSubmissionsProvider(assignmentId));
    // Best-effort name lookup, reusing the Students feature's existing list provider rather than
    // a fresh unfiltered fetch — if the user left an active search/status filter on the Student
    // list screen, a name here can miss and fall back to "Student" below. Acceptable for this
    // pass; a dedicated by-id lookup would avoid it.
    final studentsAsync = ref.watch(studentListProvider);

    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: submissionsAsync.when(
        loading: () => const LoadingView(),
        error: (error, stackTrace) => ErrorView(
          failure: UnexpectedFailure(message: error.toString()),
          onRetry: () => ref.invalidate(assignmentSubmissionsProvider(assignmentId)),
        ),
        data: (result) => result.fold(
          (failure) => ErrorView(
            failure: failure,
            onRetry: () => ref.invalidate(assignmentSubmissionsProvider(assignmentId)),
          ),
          (submissions) {
            final namesById = studentsAsync.maybeWhen(
              data: (studentsResult) => studentsResult.fold(
                (_) => <String, String>{},
                (students) => {for (final s in students) s.id: s.fullName},
              ),
              orElse: () => <String, String>{},
            );

            return submissions.isEmpty
                ? const EmptyState(message: 'No submissions yet.')
                : ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: submissions.length,
                    separatorBuilder: (_, __) => const Divider(),
                    itemBuilder: (context, index) {
                      final submission = submissions[index];
                      return ListTile(
                        title: Text(namesById[submission.studentId] ?? 'Student'),
                        subtitle: Text(
                          'Attempt ${submission.attemptNumber}'
                          '${submission.isLate ? " · Late" : ""}'
                          '${submission.isReviewed ? " · Reviewed" : " · Submitted"}',
                        ),
                        trailing: submission.grade != null
                            ? Chip(label: Text(submission.grade!), visualDensity: VisualDensity.compact)
                            : null,
                        onTap: () => _openReviewDialog(context, ref, submission),
                      );
                    },
                  );
          },
        ),
      ),
    );
  }
}
