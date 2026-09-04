import 'package:dio/dio.dart';

/// Thin wrapper over the raw `/auth/*` calls (docs/04 §4.3) — returns raw JSON maps; DTO parsing
/// and Failure mapping happen one layer up in AuthRepositoryImpl, so this class's only job is
/// "know the endpoint shapes," making it trivial to swap for a fake in repository tests.
class AuthRemoteDataSource {
  const AuthRemoteDataSource(this._dio);

  final Dio _dio;

  Future<Map<String, dynamic>> login({
    required String identifier,
    required String password,
    required String deviceId,
  }) async {
    final response = await _dio.post('/auth/login', data: {
      'identifier': identifier,
      'password': password,
      'deviceId': deviceId,
    });
    return response.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> register({
    String? email,
    String? phone,
    required String password,
    required String fullName,
    required String role,
    String? preferredLanguage,
    required String deviceId,
  }) async {
    final response = await _dio.post('/auth/register', data: {
      if (email != null) 'email': email,
      if (phone != null) 'phone': phone,
      'password': password,
      'fullName': fullName,
      'role': role,
      if (preferredLanguage != null) 'preferredLanguage': preferredLanguage,
      'deviceId': deviceId,
    });
    return response.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> me() async {
    final response = await _dio.get('/auth/me');
    return response.data as Map<String, dynamic>;
  }

  Future<void> logout(String deviceId) async {
    await _dio.post('/auth/logout', data: {'deviceId': deviceId});
  }
}
