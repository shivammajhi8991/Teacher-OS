import 'package:dio/dio.dart';

class ClassesRemoteDataSource {
  const ClassesRemoteDataSource(this._dio);

  final Dio _dio;

  Future<Map<String, dynamic>> createClass({
    required String name,
    String? subjectOrActivity,
    String? classType,
    required String mode,
    String? locationOrMeetingLink,
    int? capacityMax,
    required String startDate,
    String? endDate,
  }) async {
    final response = await _dio.post('/classes', data: {
      'name': name,
      if (subjectOrActivity != null) 'subjectOrActivity': subjectOrActivity,
      if (classType != null) 'classType': classType,
      'mode': mode,
      if (locationOrMeetingLink != null) 'locationOrMeetingLink': locationOrMeetingLink,
      if (capacityMax != null) 'capacityMax': capacityMax,
      'startDate': startDate,
      if (endDate != null) 'endDate': endDate,
    });
    return response.data as Map<String, dynamic>;
  }

  Future<List<dynamic>> listClasses({String? status}) async {
    final response = await _dio.get('/classes', queryParameters: {
      if (status != null) 'status': status,
    });
    return response.data as List<dynamic>;
  }

  Future<Map<String, dynamic>> getClass(String id) async {
    final response = await _dio.get('/classes/$id');
    return response.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> updateClass(
    String id, {
    String? name,
    String? subjectOrActivity,
    String? mode,
    String? locationOrMeetingLink,
    int? capacityMax,
    String? endDate,
    String? status,
  }) async {
    final response = await _dio.patch('/classes/$id', data: {
      if (name != null) 'name': name,
      if (subjectOrActivity != null) 'subjectOrActivity': subjectOrActivity,
      if (mode != null) 'mode': mode,
      if (locationOrMeetingLink != null) 'locationOrMeetingLink': locationOrMeetingLink,
      if (capacityMax != null) 'capacityMax': capacityMax,
      if (endDate != null) 'endDate': endDate,
      if (status != null) 'status': status,
    });
    return response.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>?> getSchedule(String classId) async {
    final response = await _dio.get('/classes/$classId/schedule');
    return response.data as Map<String, dynamic>?;
  }

  Future<Map<String, dynamic>> setSchedule(
    String classId, {
    required String effectiveFrom,
    required String recurrenceRule,
    required String startTime,
    required String endTime,
    String? timezone,
  }) async {
    final response = await _dio.post('/classes/$classId/schedule', data: {
      'effectiveFrom': effectiveFrom,
      'recurrenceRule': recurrenceRule,
      'startTime': startTime,
      'endTime': endTime,
      if (timezone != null) 'timezone': timezone,
    });
    return response.data as Map<String, dynamic>;
  }

  Future<List<dynamic>> getConflicts(String classId) async {
    final response = await _dio.get('/classes/$classId/conflicts');
    return response.data as List<dynamic>;
  }

  Future<List<dynamic>> getEnrollments(String classId) async {
    final response = await _dio.get('/classes/$classId/enrollments');
    return response.data as List<dynamic>;
  }

  Future<Map<String, dynamic>> enrollStudent(
    String classId,
    String studentId, {
    String? enrollmentType,
  }) async {
    final response = await _dio.post('/classes/$classId/enrollments', data: {
      'studentId': studentId,
      if (enrollmentType != null) 'enrollmentType': enrollmentType,
    });
    return response.data as Map<String, dynamic>;
  }

  Future<void> addToWaitlist(String classId, String studentId) {
    return _dio.post('/classes/$classId/waitlist', data: {'studentId': studentId});
  }
}
