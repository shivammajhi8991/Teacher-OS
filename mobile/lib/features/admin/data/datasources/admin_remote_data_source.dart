import 'package:dio/dio.dart';

class AdminRemoteDataSource {
  const AdminRemoteDataSource(this._dio);

  final Dio _dio;

  Future<List<dynamic>> searchUsers({String? q, String? status}) async {
    final response = await _dio.get('/admin/users', queryParameters: {
      if (q != null && q.isNotEmpty) 'q': q,
      if (status != null) 'status': status,
    });
    return response.data as List<dynamic>;
  }

  Future<void> updateUserStatus(String userId, String status) {
    return _dio.patch('/admin/users/$userId', data: {'status': status});
  }

  Future<void> assignUserRole(String userId, {required String role, String? instituteId}) {
    return _dio.post('/admin/users/$userId/roles', data: {
      'role': role,
      if (instituteId != null) 'instituteId': instituteId,
    });
  }

  Future<List<dynamic>> listVerificationQueue() async {
    final response = await _dio.get('/verification-requests');
    return response.data as List<dynamic>;
  }

  Future<void> reviewVerificationRequest(
    String requestId, {
    required String decision,
    String? rejectionReason,
  }) {
    return _dio.patch('/verification-requests/$requestId', data: {
      'decision': decision,
      if (rejectionReason != null) 'rejectionReason': rejectionReason,
    });
  }

  Future<Map<String, dynamic>> createTeacherCategory({required String name, String? icon}) async {
    final response = await _dio.post('/teacher-categories', data: {
      'name': name,
      if (icon != null) 'icon': icon,
    });
    return response.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> updateTeacherCategory(String id, {bool? isActive}) async {
    final response = await _dio.patch('/teacher-categories/$id', data: {
      if (isActive != null) 'isActive': isActive,
    });
    return response.data as Map<String, dynamic>;
  }
}
