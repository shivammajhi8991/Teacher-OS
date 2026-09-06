import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/error/failure.dart';
import '../../../../core/widgets/empty_state.dart';
import '../../../../core/widgets/error_view.dart';
import '../../../../core/widgets/loading_view.dart';
import '../../../announcements/presentation/screens/announcements_list_screen.dart';
import '../../domain/entities/notification_item.dart';
import '../providers/notifications_providers.dart';
import 'notification_preferences_screen.dart';

/// docs/08 §8.1 "Notification center" — reached from the app bar bell icon on every dashboard
/// (role_dashboard_scaffold.dart). "Notification preferences" (docs/08 says reachable from
/// Profile/Settings) is instead reachable from this screen's own app bar for now — no
/// Profile/Settings tab has a real screen behind it yet on any dashboard (every one of them
/// still shows "coming soon"), so routing through one would be building on a screen that
/// doesn't exist rather than a documented, honest shortcut. Same reasoning covers Student's
/// "Announcements | ... | Notification center" (docs/08 §8.2) — the campaign icon here is that
/// entry point.
class NotificationCenterScreen extends ConsumerWidget {
  const NotificationCenterScreen({super.key});

  Future<void> _markAllRead(BuildContext context, WidgetRef ref) async {
    final result = await ref.read(notificationsRepositoryProvider).markAllRead();
    if (!context.mounted) return;
    result.fold(
      (failure) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(failure.message))),
      (_) {
        ref.invalidate(notificationsListProvider);
        ref.invalidate(unreadNotificationCountProvider);
      },
    );
  }

  Future<void> _openNotification(WidgetRef ref, NotificationItem notification) async {
    if (notification.isRead) return;
    final result = await ref.read(notificationsRepositoryProvider).markRead(notification.id);
    result.fold(
      (_) {}, // a failed mark-as-read isn't worth interrupting the user over — it'll just show unread next time
      (_) {
        ref.invalidate(notificationsListProvider);
        ref.invalidate(unreadNotificationCountProvider);
      },
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notificationsAsync = ref.watch(notificationsListProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          IconButton(
            icon: const Icon(Icons.campaign_outlined),
            tooltip: 'Announcements',
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const AnnouncementsListScreen()),
            ),
          ),
          IconButton(
            icon: const Icon(Icons.tune),
            tooltip: 'Preferences',
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const NotificationPreferencesScreen()),
            ),
          ),
          TextButton(
            onPressed: () => _markAllRead(context, ref),
            child: const Text('Mark all read'),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(notificationsListProvider),
        child: notificationsAsync.when(
          loading: () => const LoadingView(),
          error: (error, stackTrace) => ErrorView(
            failure: UnexpectedFailure(message: error.toString()),
            onRetry: () => ref.invalidate(notificationsListProvider),
          ),
          data: (result) => result.fold(
            (failure) => ErrorView(failure: failure, onRetry: () => ref.invalidate(notificationsListProvider)),
            (notifications) => notifications.isEmpty
                ? ListView(
                    // still scrollable so pull-to-refresh works on an empty list
                    children: const [
                      SizedBox(height: 80),
                      EmptyState(icon: Icons.notifications_none, message: "You're all caught up."),
                    ],
                  )
                : ListView.separated(
                    itemCount: notifications.length,
                    separatorBuilder: (_, __) => const Divider(height: 1),
                    itemBuilder: (context, index) => _NotificationTile(
                      notification: notifications[index],
                      onTap: () => _openNotification(ref, notifications[index]),
                    ),
                  ),
          ),
        ),
      ),
    );
  }
}

class _NotificationTile extends StatelessWidget {
  const _NotificationTile({required this.notification, required this.onTap});

  final NotificationItem notification;
  final VoidCallback onTap;

  IconData _iconFor(String type) => switch (type) {
        'payment_confirmed' => Icons.payments_outlined,
        'invoice_issued' => Icons.receipt_long_outlined,
        'document_shared' => Icons.link,
        _ => Icons.notifications_none,
      };

  @override
  Widget build(BuildContext context) {
    final isUnread = !notification.isRead;
    return ListTile(
      onTap: onTap,
      leading: Icon(_iconFor(notification.type)),
      title: Text(
        notification.title,
        style: TextStyle(fontWeight: isUnread ? FontWeight.bold : FontWeight.normal),
      ),
      subtitle: Text(notification.body, maxLines: 2, overflow: TextOverflow.ellipsis),
      trailing: isUnread
          ? Container(
              width: 8,
              height: 8,
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.primary,
                shape: BoxShape.circle,
              ),
            )
          : null,
    );
  }
}
