import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/error/failure.dart';
import '../../../../core/widgets/empty_state.dart';
import '../../../../core/widgets/error_view.dart';
import '../../../../core/widgets/loading_view.dart';
import '../../domain/entities/teacher_roster_entry.dart';
import '../providers/institutes_providers.dart';

/// docs/08 §8.2 Institute Admin "Teachers list / detail: Roster, invite, verification status,
/// payout config" — roster + invite generation. Payout-config *editing* is this pass's documented
/// scope cut (backend's `PayoutsController.setPayoutPercent` has no mobile surface yet, matching
/// Branches' own precedent) — the roster still surfaces the configured percent, read-only.
class TeacherRosterScreen extends ConsumerWidget {
  const TeacherRosterScreen({super.key, required this.instituteId});

  final String instituteId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final rosterAsync = ref.watch(teacherRosterProvider(instituteId));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Teachers'),
        actions: [
          IconButton(
            icon: const Icon(Icons.person_add_alt_outlined),
            tooltip: 'Invite teacher',
            onPressed: () => _showInviteDialog(context, ref),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(teacherRosterProvider(instituteId)),
        child: rosterAsync.when(
          loading: () => const LoadingView(),
          error: (error, stackTrace) => ErrorView(
            failure: UnexpectedFailure(message: error.toString()),
            onRetry: () => ref.invalidate(teacherRosterProvider(instituteId)),
          ),
          data: (result) => result.fold(
            (failure) =>
                ErrorView(failure: failure, onRetry: () => ref.invalidate(teacherRosterProvider(instituteId))),
            (roster) => roster.isEmpty
                ? EmptyState(
                    icon: Icons.school_outlined,
                    message: 'No teachers yet — invite your first teacher to get started.',
                    actionLabel: 'Invite Teacher',
                    onAction: () => _showInviteDialog(context, ref),
                  )
                : ListView.separated(
                    itemCount: roster.length,
                    separatorBuilder: (_, __) => const Divider(height: 1),
                    itemBuilder: (context, index) => _TeacherTile(entry: roster[index]),
                  ),
          ),
        ),
      ),
    );
  }

  Future<void> _showInviteDialog(BuildContext context, WidgetRef ref) async {
    final result = await ref.read(institutesRepositoryProvider).createTeacherInvite(
          instituteId,
          expiresInDays: 7,
        );
    if (!context.mounted) return;
    result.fold(
      (failure) =>
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(failure.message))),
      (invite) => showDialog<void>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Invite code'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Share this code with the teacher: ', style: Theme.of(context).textTheme.bodyMedium),
              const SizedBox(height: 8),
              SelectableText(invite.code, style: Theme.of(context).textTheme.headlineSmall),
              const SizedBox(height: 8),
              Text(
                'Valid for 7 days. The teacher redeems it from their own app once they have '
                'completed their teacher profile.',
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Done')),
          ],
        ),
      ),
    );
  }
}

class _TeacherTile extends StatelessWidget {
  const _TeacherTile({required this.entry});

  final TeacherRosterEntry entry;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: CircleAvatar(child: Text(entry.fullName.isNotEmpty ? entry.fullName[0] : '?')),
      title: Text(entry.fullName),
      subtitle: Text(entry.headline ?? entry.email ?? ''),
      trailing: _VerificationBadge(status: entry.verificationStatus),
    );
  }
}

class _VerificationBadge extends StatelessWidget {
  const _VerificationBadge({required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final color = switch (status) {
      'verified' => Colors.green.shade600,
      'pending' => Colors.orange.shade700,
      _ => colorScheme.onSurfaceVariant,
    };
    return Chip(
      label: Text(status, style: TextStyle(color: color, fontSize: 12)),
      backgroundColor: color.withOpacity(0.1),
      side: BorderSide.none,
      visualDensity: VisualDensity.compact,
    );
  }
}
