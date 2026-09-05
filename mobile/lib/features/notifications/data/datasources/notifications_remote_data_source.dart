import 'package:dio/dio.dart';

class NotificationsRemoteDataSource {
  const NotificationsRemoteDataSource(this._dio);

  final Dio _dio;

  Future<List<dynamic>> listNotifications({bool unreadOnly = false}) async {
    final response = await _dio.get(
      '/notifications',
      queryParameters: unreadOnly ? {'unreadOnly': 'true'} : null,
    );
    return response.data as List<dynamic>;
  }

  Future<void> markRead(String id) => _dio.patch('/notifications/$id/read');

  Future<void> markAllRead() => _dio.patch('/notifications/read-all');

  Future<List<dynamic>> getPreferences() async {
    final response = await _dio.get('/notification-preferences');
    return response.data as List<dynamic>;
  }

  Future<void> updatePreference({required String category, required String channel}) {
    return _dio.patch('/notification-preferences', data: {
      'category': category,
      'channel': channel,
    });
  }
}
