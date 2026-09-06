import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/error/failure.dart';
import '../../../../core/widgets/empty_state.dart';
import '../../../../core/widgets/error_view.dart';
import '../../../../core/widgets/loading_view.dart';
import '../../domain/entities/verification_queue_entry.dart';
import '../providers/admin_providers.dart';

/// docs/08 §8.2 Admin Web Panel "Verification queue | Review submitted docs, approve/reject with
/// reason." Document URLs are shown as selectable text (copy-to-clipboard equivalent, matching
/// Notes' own link-only precedent) rather than opened in-app — no `url_launcher` dependency yet.
class AdminVerificationQueueScreen extends ConsumerWidget {
  const AdminVerificationQueueScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final queueAsync = ref.watch(verificationQueueProvider);

    return Scaffold(
      body: queueAsync.when(
        loading: () => const LoadingView(),
        error: (error, stackTrace) => ErrorView(
          failure: UnexpectedFailure(message: error.toString()),
          onRetry: () => ref.invalidate(verificationQueueProvider),
        ),
        data: (result) => result.fold(
          (failure) => ErrorView(failure: failure, onRetry: () => ref.invalidate(verificationQueueProvider)),
          (queue) => queue.isEmpty
              ? const EmptyState(icon: Icons.verified_outlined, message: 'Nothing pending review.')
              : RefreshIndicator(
                  onRefresh: () async => ref.invalidate(verificationQueueProvider),
                  child: ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: queue.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 12),
                    itemBuilder: (context, index) => _QueueCard(entry: queue[index]),
                  ),
                ),
        ),
      ),
    );
  }
}

class _QueueCard extends ConsumerWidget {
  const _QueueCard({required this.entry});

  final VerificationQueueEntry entry;

  Future<void> _decide(BuildContext context, WidgetRef ref, String decision) async {
    String? rejectionReason;
    if (decision == 'rejected') {
      final controller = TextEditingController();
      rejectionReason = await showDialog<String>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Reject verification'),
          content: TextField(
            controller: controller,
            decoration: const InputDecoration(labelText: 'Reason'),
            autofocus: true,
          ),
          actions: [
            TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Cancel')),
            FilledButton(
              onPressed: () => Navigator.of(context).pop(controller.text.trim()),
              child: const Text('Reject'),
            ),
          ],
        ),
      );
      if (rejectionReason == null) return; // cancelled
    }

    final result = await ref.read(adminRepositoryProvider).reviewVerificationRequest(
          entry.id,
          decision: decision,
          rejectionReason: rejectionReason,
        );
    if (!context.mounted) return;
    result.fold(
      (failure) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(failure.message))),
      (_) => ref.invalidate(verificationQueueProvider),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(entry.teacherFullName, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            for (final url in entry.documentUrls)
              Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: SelectableText(url, style: Theme.of(context).textTheme.bodySmall),
              ),
            const SizedBox(height: 12),
            Row(
              children: [
                OutlinedButton(
                  onPressed: () => _decide(context, ref, 'rejected'),
                  child: const Text('Reject'),
                ),
                const SizedBox(width: 8),
                FilledButton(
                  onPressed: () => _decide(context, ref, 'approved'),
                  child: const Text('Approve'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
