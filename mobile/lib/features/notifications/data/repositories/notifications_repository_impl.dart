import 'package:dio/dio.dart';
import '../../../../core/network/api_exception_mapper.dart';
import '../../../../core/utils/result.dart';
import '../../domain/entities/notification_item.dart';
import '../../domain/entities/notification_preference.dart';
import '../../domain/repositories/notifications_repository.dart';
import '../datasources/notifications_remote_data_source.dart';
import '../dto/notification_item_dto.dart';
import '../dto/notification_preference_dto.dart';

class NotificationsRepositoryImpl implements NotificationsRepository {
  const NotificationsRepositoryImpl(this._remoteDataSource);

  final NotificationsRemoteDataSource _remoteDataSource;

  @override
  Future<Result<List<NotificationItem>>> listNotifications({bool unreadOnly = false}) async {
    try {
      final json = await _remoteDataSource.listNotifications(unreadOnly: unreadOnly);
      final items = json
          .map((item) => NotificationItemDto.fromJson(item as Map<String, dynamic>).toEntity())
          .toList();
      return Ok(items);
    } on DioException catch (e) {
      return Err(mapDioExceptionToFailure(e));
    }
  }

  @override
  Future<Result<void>> markRead(String id) async {
    try {
      await _remoteDataSource.markRead(id);
      return const Ok(null);
    } on DioException catch (e) {
      return Err(mapDioExceptionToFailure(e));
    }
  }

  @override
  Future<Result<void>> markAllRead() async {
    try {
      await _remoteDataSource.markAllRead();
      return const Ok(null);
    } on DioException catch (e) {
      return Err(mapDioExceptionToFailure(e));
    }
  }

  @override
  Future<Result<List<NotificationPreference>>> getPreferences() async {
    try {
      final json = await _remoteDataSource.getPreferences();
      final prefs = json
          .map((item) => NotificationPreferenceDto.fromJson(item as Map<String, dynamic>).toEntity())
          .toList();
      return Ok(prefs);
    } on DioException catch (e) {
      return Err(mapDioExceptionToFailure(e));
    }
  }

  @override
  Future<Result<void>> updatePreference({required String category, required String channel}) async {
    try {
      await _remoteDataSource.updatePreference(category: category, channel: channel);
      return const Ok(null);
    } on DioException catch (e) {
      return Err(mapDioExceptionToFailure(e));
    }
  }
}
