import '../../../../core/utils/result.dart';
import '../entities/notification_item.dart';
import '../entities/notification_preference.dart';

abstract interface class NotificationsRepository {
  /// docs/08 §8.1 "Notification center." Device-token registration (the other half of docs/07
  /// roadmap step 8, "FCM wiring") isn't part of this repository — it needs `firebase_messaging`
  /// and a real Firebase project (google-services.json / APNs keys) neither of which exist for
  /// this codebase, so it's a documented deferral; everything here is plain REST against rows
  /// the backend already persists regardless of push delivery.
  Future<Result<List<NotificationItem>>> listNotifications({bool unreadOnly = false});

  Future<Result<void>> markRead(String id);

  Future<Result<void>> markAllRead();

  /// docs/08 §8.1 "Notification preferences: Per-category channel toggle."
  Future<Result<List<NotificationPreference>>> getPreferences();

  Future<Result<void>> updatePreference({required String category, required String channel});
}
