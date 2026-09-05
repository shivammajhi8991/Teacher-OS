import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../data/datasources/notifications_remote_data_source.dart';
import '../../data/repositories/notifications_repository_impl.dart';
import '../../domain/repositories/notifications_repository.dart';

final notificationsRemoteDataSourceProvider = Provider<NotificationsRemoteDataSource>((ref) {
  return NotificationsRemoteDataSource(ref.watch(apiClientProvider).dio);
});

final notificationsRepositoryProvider = Provider<NotificationsRepository>((ref) {
  return NotificationsRepositoryImpl(ref.watch(notificationsRemoteDataSourceProvider));
});

final notificationsListProvider = FutureProvider.autoDispose((ref) {
  return ref.watch(notificationsRepositoryProvider).listNotifications();
});

// Backs the app bar bell icon's unread badge (role_dashboard_scaffold.dart) — a lightweight,
// separate query rather than deriving from [notificationsListProvider] so the badge can refresh
// (pull-to-refresh, returning from the Notification Center) independently of the full list.
final unreadNotificationCountProvider = FutureProvider.autoDispose((ref) async {
  final result = await ref.watch(notificationsRepositoryProvider).listNotifications(unreadOnly: true);
  return result.fold((_) => 0, (items) => items.length);
});

final notificationPreferencesProvider = FutureProvider.autoDispose((ref) {
  return ref.watch(notificationsRepositoryProvider).getPreferences();
});
