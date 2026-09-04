import 'package:dio/dio.dart';
import '../../domain/entities/guardian_input.dart';

class StudentsRemoteDataSource {
  const StudentsRemoteDataSource(this._dio);

  final Dio _dio;

  Future<Map<String, dynamic>> createStudent({
    required String fullName,
    String? dob,
    String? gender,
    String? emergencyContactName,
    String? emergencyContactPhone,
    String? medicalNotes,
    String? joinDate,
    List<GuardianInput> guardians = const [],
  }) async {
    final response = await _dio.post('/students', data: {
      'fullName': fullName,
      if (dob != null) 'dob': dob,
      if (gender != null) 'gender': gender,
      if (emergencyContactName != null) 'emergencyContactName': emergencyContactName,
      if (emergencyContactPhone != null) 'emergencyContactPhone': emergencyContactPhone,
      if (medicalNotes != null) 'medicalNotes': medicalNotes,
      if (joinDate != null) 'joinDate': joinDate,
      if (guardians.isNotEmpty) 'guardians': guardians.map(_guardianToJson).toList(),
    });
    return response.data as Map<String, dynamic>;
  }

  Future<List<dynamic>> listStudents({String? status, String? q}) async {
    final response = await _dio.get('/students', queryParameters: {
      if (status != null) 'status': status,
      if (q != null && q.isNotEmpty) 'q': q,
    });
    return response.data as List<dynamic>;
  }

  Future<Map<String, dynamic>> getStudentDetail(String id) async {
    final response = await _dio.get('/students/$id');
    return response.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> updateStudent(
    String id, {
    String? fullName,
    String? dob,
    String? gender,
    String? emergencyContactName,
    String? emergencyContactPhone,
    String? medicalNotes,
    String? enrollmentStatus,
  }) async {
    final response = await _dio.patch('/students/$id', data: {
      if (fullName != null) 'fullName': fullName,
      if (dob != null) 'dob': dob,
      if (gender != null) 'gender': gender,
      if (emergencyContactName != null) 'emergencyContactName': emergencyContactName,
      if (emergencyContactPhone != null) 'emergencyContactPhone': emergencyContactPhone,
      if (medicalNotes != null) 'medicalNotes': medicalNotes,
      if (enrollmentStatus != null) 'enrollmentStatus': enrollmentStatus,
    });
    return response.data as Map<String, dynamic>;
  }

  Future<void> archiveStudent(String id) => _dio.post('/students/$id/archive');

  Future<Map<String, dynamic>> addGuardian(String studentId, GuardianInput guardian) async {
    final response = await _dio.post(
      '/students/$studentId/guardians',
      data: _guardianToJson(guardian),
    );
    return response.data as Map<String, dynamic>;
  }

  Future<void> mergeStudents({
    required String survivingStudentId,
    required String mergedStudentId,
    required String reason,
  }) {
    return _dio.post('/students/merge', data: {
      'survivingStudentId': survivingStudentId,
      'mergedStudentId': mergedStudentId,
      'reason': reason,
    });
  }

  Future<Map<String, dynamic>> createInvite({int? expiresInDays}) async {
    final response = await _dio.post('/students/invite', data: {
      if (expiresInDays != null) 'expiresInDays': expiresInDays,
    });
    return response.data as Map<String, dynamic>;
  }

  Map<String, dynamic> _guardianToJson(GuardianInput g) => {
        'fullName': g.fullName,
        if (g.phone != null) 'phone': g.phone,
        if (g.email != null) 'email': g.email,
        if (g.relationship != null) 'relationship': g.relationship,
        if (g.isPrimary != null) 'isPrimary': g.isPrimary,
        if (g.consentDataSharing != null) 'consentDataSharing': g.consentDataSharing,
      };
}
