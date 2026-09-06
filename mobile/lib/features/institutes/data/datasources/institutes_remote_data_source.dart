import 'package:dio/dio.dart';

class InstitutesRemoteDataSource {
  const InstitutesRemoteDataSource(this._dio);

  final Dio _dio;

  Future<List<dynamic>> listTeachers(String instituteId) async {
    final response = await _dio.get('/institutes/$instituteId/teachers');
    return response.data as List<dynamic>;
  }

  Future<Map<String, dynamic>> createTeacherInvite(String instituteId, {int? expiresInDays}) async {
    final response = await _dio.post('/institutes/$instituteId/teacher-invites', data: {
      if (expiresInDays != null) 'expiresInDays': expiresInDays,
    });
    return response.data as Map<String, dynamic>;
  }
}
