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

  /// docs/08 §8.2 Admin Web Panel "Institutes | List, drill into any institute's admin view" —
  /// reuses the plain `GET /institutes` every authenticated user already has read access to
  /// (docs/04 §4.4 "Reads: any authenticated user"), rather than a separate `/admin/institutes`
  /// alias with no behavioral difference.
  Future<List<dynamic>> listAll() async {
    final response = await _dio.get('/institutes');
    return response.data as List<dynamic>;
  }
}
