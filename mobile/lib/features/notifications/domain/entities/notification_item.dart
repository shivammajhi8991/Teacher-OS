/// Mirrors backend `Notification` (notifications.service.ts). `deliveryChannel` is what the
/// backend resolved at creation time (the user's preference, or the category default) — it
/// never changes retroactively if the preference changes later.
class NotificationItem {
  const NotificationItem({
    required this.id,
    required this.type,
    required this.title,
    required this.body,
    required this.deliveryChannel,
    required this.deliveredAt,
    required this.readAt,
    required this.createdAt,
  });

  final String id;
  final String type;
  final String title;
  final String body;
  final String deliveryChannel; // 'push' | 'email' | 'digest_daily' | 'digest_weekly' | 'off'
  final DateTime? deliveredAt;
  final DateTime? readAt;
  final DateTime createdAt;

  bool get isRead => readAt != null;
}
