import 'package:dio/dio.dart';

class AnnouncementsRemoteDataSource {
  const AnnouncementsRemoteDataSource(this._dio);

  final Dio _dio;

  Future<List<dynamic>> listAnnouncements() async {
    final response = await _dio.get('/announcements');
    return response.data as List<dynamic>;
  }

  Future<void> createAnnouncement({
    required String targetType,
    String? targetId,
    required String title,
    required String body,
  }) {
    return _dio.post('/announcements', data: {
      'targetType': targetType,
      if (targetId != null) 'targetId': targetId,
      'title': title,
      'body': body,
    });
  }
}
