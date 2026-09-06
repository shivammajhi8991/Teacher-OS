import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/error/failure.dart';
import '../../../../core/widgets/empty_state.dart';
import '../../../../core/widgets/error_view.dart';
import '../../../../core/widgets/loading_view.dart';
import '../../domain/entities/admin_user.dart';
import '../providers/admin_providers.dart';

/// docs/08 §8.2 Admin Web Panel "Users | Search/suspend/role-manage across the platform."
/// `GET /admin/users` scopes to the caller automatically (institute_admin: their own institute's
/// users only, super_admin: the whole platform) — this screen sends only a free-text query.
class AdminUsersScreen extends ConsumerWidget {
  const AdminUsersScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final usersAsync = ref.watch(adminUsersProvider);

    return Scaffold(
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: TextField(
              decoration: const InputDecoration(
                prefixIcon: Icon(Icons.search),
                hintText: 'Search by name, email, or phone',
                isDense: true,
              ),
              onSubmitted: (value) =>
                  ref.read(adminUserSearchQueryProvider.notifier).state = value.trim(),
            ),
          ),
          Expanded(
            child: usersAsync.when(
              loading: () => const LoadingView(),
              error: (error, stackTrace) => ErrorView(
                failure: UnexpectedFailure(message: error.toString()),
                onRetry: () => ref.invalidate(adminUsersProvider),
              ),
              data: (result) => result.fold(
                (failure) =>
                    ErrorView(failure: failure, onRetry: () => ref.invalidate(adminUsersProvider)),
                (users) => users.isEmpty
                    ? const EmptyState(icon: Icons.people_outline, message: 'No users found.')
                    : RefreshIndicator(
                        onRefresh: () async => ref.invalidate(adminUsersProvider),
                        child: ListView.separated(
                          itemCount: users.length,
                          separatorBuilder: (_, __) => const Divider(height: 1),
                          itemBuilder: (context, index) => _AdminUserTile(user: users[index]),
                        ),
                      ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _AdminUserTile extends ConsumerWidget {
  const _AdminUserTile({required this.user});

  final AdminUser user;

  Future<void> _toggleStatus(BuildContext context, WidgetRef ref) async {
    final newStatus = user.status == 'suspended' ? 'active' : 'suspended';
    final result = await ref.read(adminRepositoryProvider).updateUserStatus(user.id, newStatus);
    if (!context.mounted) return;
    result.fold(
      (failure) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(failure.message))),
      (_) => ref.invalidate(adminUsersProvider),
    );
  }

  Future<void> _assignRole(BuildContext context, WidgetRef ref) async {
    final role = await showDialog<String>(
      context: context,
      builder: (context) => SimpleDialog(
        title: const Text('Assign role'),
        children: [
          for (final r in ['teacher', 'student', 'parent', 'institute_admin', 'super_admin'])
            SimpleDialogOption(onPressed: () => Navigator.of(context).pop(r), child: Text(r)),
        ],
      ),
    );
    if (role == null) return;
    final result = await ref.read(adminRepositoryProvider).assignUserRole(user.id, role: role);
    if (!context.mounted) return;
    result.fold(
      (failure) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(failure.message))),
      (_) => ref.invalidate(adminUsersProvider),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isSuspended = user.status == 'suspended';
    return ListTile(
      leading: CircleAvatar(child: Text(user.fullName.isNotEmpty ? user.fullName[0] : '?')),
      title: Text(user.fullName),
      subtitle: Text(
        [
          user.email ?? user.phone ?? '',
          user.roles.map((r) => r.role).join(', '),
        ].where((s) => s.isNotEmpty).join(' · '),
      ),
      trailing: PopupMenuButton<String>(
        onSelected: (action) {
          if (action == 'status') _toggleStatus(context, ref);
          if (action == 'role') _assignRole(context, ref);
        },
        itemBuilder: (context) => [
          PopupMenuItem(value: 'status', child: Text(isSuspended ? 'Reactivate' : 'Suspend')),
          const PopupMenuItem(value: 'role', child: Text('Assign role')),
        ],
      ),
    );
  }
}
