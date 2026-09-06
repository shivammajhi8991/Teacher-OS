import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/error/failure.dart';
import '../../../../core/widgets/error_view.dart';
import '../../../../core/widgets/loading_view.dart';
import '../../domain/entities/assignment_summary.dart';
import '../../domain/entities/submission_summary.dart';
import '../providers/assignments_providers.dart';

/// docs/08 §8.2 "Assignment detail / submit: Description, attachments, submit/resubmit,
/// feedback once reviewed." Mobile scope: a submission is one external link (documented
/// deviation — see assignments_repository.dart's header comment; the backend's real
/// upload/attachment flow already exists, just not wired to a file picker here).
class AssignmentSubmitScreen extends ConsumerWidget {
  const AssignmentSubmitScreen({super.key, required this.assignmentId});

  final String assignmentId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final assignmentAsync = ref.watch(assignmentDetailProvider(assignmentId));
    final submissionsAsync = ref.watch(assignmentSubmissionsProvider(assignmentId));

    return Scaffold(
      appBar: AppBar(title: const Text('Assignment')),
      body: assignmentAsync.when(
        loading: () => const LoadingView(),
        error: (error, stackTrace) => ErrorView(
          failure: UnexpectedFailure(message: error.toString()),
          onRetry: () => ref.invalidate(assignmentDetailProvider(assignmentId)),
        ),
        data: (assignmentResult) => assignmentResult.fold(
          (failure) => ErrorView(failure: failure, onRetry: () => ref.invalidate(assignmentDetailProvider(assignmentId))),
          (assignment) => submissionsAsync.when(
            loading: () => const LoadingView(),
            error: (error, stackTrace) => ErrorView(
              failure: UnexpectedFailure(message: error.toString()),
              onRetry: () => ref.invalidate(assignmentSubmissionsProvider(assignmentId)),
            ),
            data: (submissionsResult) => submissionsResult.fold(
              (failure) =>
                  ErrorView(failure: failure, onRetry: () => ref.invalidate(assignmentSubmissionsProvider(assignmentId))),
              (submissions) => _Body(assignment: assignment, latestSubmission: submissions.isEmpty ? null : submissions.first),
            ),
          ),
        ),
      ),
    );
  }
}

class _Body extends ConsumerStatefulWidget {
  const _Body({required this.assignment, required this.latestSubmission});

  final AssignmentSummary assignment;
  final SubmissionSummary? latestSubmission;

  @override
  ConsumerState<_Body> createState() => _BodyState();
}

class _BodyState extends ConsumerState<_Body> {
  final _urlController = TextEditingController();
  bool _isSubmitting = false;
  String? _errorMessage;

  @override
  void dispose() {
    _urlController.dispose();
    super.dispose();
  }

  Future<void> _copyLink(String url) async {
    await Clipboard.setData(ClipboardData(text: url));
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Link copied.')));
  }

  Future<void> _submit() async {
    final url = _urlController.text.trim();
    final uri = Uri.tryParse(url);
    if (uri == null || !uri.hasScheme || !uri.hasAuthority) {
      setState(() => _errorMessage = 'Enter a valid URL (including https://)');
      return;
    }

    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    final result = await ref
        .read(assignmentsRepositoryProvider)
        .submitAssignment(assignmentId: widget.assignment.id, url: url);

    if (!mounted) return;
    result.fold(
      (failure) => setState(() {
        _isSubmitting = false;
        _errorMessage = failure.message;
      }),
      (_) {
        _urlController.clear();
        setState(() => _isSubmitting = false);
        ref.invalidate(assignmentSubmissionsProvider(widget.assignment.id));
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final assignment = widget.assignment;
    final submission = widget.latestSubmission;
    final canSubmit = submission == null || assignment.allowResubmission;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(assignment.title, style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 4),
        Text(
          'Due ${assignment.dueAt.toLocal().toString().substring(0, 16)}'
          '${assignment.isPastDue ? " (past due)" : ""}',
          style: Theme.of(context).textTheme.bodySmall,
        ),
        if (assignment.description != null) ...[
          const SizedBox(height: 12),
          Text(assignment.description!),
        ],
        if (assignment.attachmentUrls.isNotEmpty) ...[
          const SizedBox(height: 16),
          Text('Attachments', style: Theme.of(context).textTheme.titleSmall),
          for (final url in assignment.attachmentUrls)
            ListTile(
              contentPadding: EdgeInsets.zero,
              dense: true,
              leading: const Icon(Icons.attachment),
              title: Text(url, maxLines: 1, overflow: TextOverflow.ellipsis),
              trailing: IconButton(icon: const Icon(Icons.copy, size: 18), onPressed: () => _copyLink(url)),
            ),
        ],
        const Divider(height: 32),
        if (submission != null) ...[
          Text('Your submission', style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: 4),
          Text('Attempt ${submission.attemptNumber} · ${submission.isLate ? "Late" : "On time"}'),
          if (submission.isReviewed) ...[
            const SizedBox(height: 8),
            if (submission.grade != null) Text('Grade: ${submission.grade}', style: Theme.of(context).textTheme.titleMedium),
            if (submission.feedback != null) ...[
              const SizedBox(height: 4),
              Text(submission.feedback!),
            ],
          ] else
            const Text('Waiting for review.'),
          const SizedBox(height: 16),
        ],
        if (canSubmit) ...[
          Text(submission == null ? 'Submit your work' : 'Resubmit', style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: 8),
          TextField(
            controller: _urlController,
            decoration: const InputDecoration(labelText: 'Link to your work', hintText: 'https://…'),
            keyboardType: TextInputType.url,
          ),
          if (_errorMessage != null) ...[
            const SizedBox(height: 8),
            Text(_errorMessage!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
          ],
          const SizedBox(height: 12),
          FilledButton(
            onPressed: _isSubmitting ? null : _submit,
            child: _isSubmitting
                ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                : Text(submission == null ? 'Submit' : 'Resubmit'),
          ),
        ] else
          const Text("Resubmission isn't allowed for this assignment."),
      ],
    );
  }
}
