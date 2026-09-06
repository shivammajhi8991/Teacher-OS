import 'package:dio/dio.dart';

class AssignmentsRemoteDataSource {
  const AssignmentsRemoteDataSource(this._dio);

  final Dio _dio;

  Future<List<dynamic>> listAssignments({String? classId, String? studentId}) async {
    final response = await _dio.get('/assignments', queryParameters: {
      if (classId != null) 'classId': classId,
      if (studentId != null) 'studentId': studentId,
    });
    return response.data as List<dynamic>;
  }

  Future<Map<String, dynamic>> getAssignment(String id) async {
    final response = await _dio.get('/assignments/$id');
    return response.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> createAssignment({
    required String title,
    String? description,
    required String classId,
    required String dueAt,
    required bool allowLateSubmission,
    required bool allowResubmission,
  }) async {
    final response = await _dio.post('/assignments', data: {
      'title': title,
      if (description != null) 'description': description,
      'classId': classId,
      'dueAt': dueAt,
      'allowLateSubmission': allowLateSubmission,
      'allowResubmission': allowResubmission,
    });
    return response.data as Map<String, dynamic>;
  }

  Future<List<dynamic>> listSubmissions(String assignmentId) async {
    final response = await _dio.get('/assignments/$assignmentId/submissions');
    return response.data as List<dynamic>;
  }

  Future<void> createSubmission(String assignmentId, List<String> attachmentUrls) {
    return _dio.post('/assignments/$assignmentId/submissions', data: {
      'attachmentUrls': attachmentUrls,
    });
  }

  Future<void> reviewSubmission(String submissionId, {String? grade, String? feedback}) {
    return _dio.patch('/assignment-submissions/$submissionId/review', data: {
      if (grade != null) 'grade': grade,
      if (feedback != null) 'feedback': feedback,
    });
  }
}
