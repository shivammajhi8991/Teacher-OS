import 'package:dio/dio.dart';

class AttendanceRemoteDataSource {
  const AttendanceRemoteDataSource(this._dio);

  final Dio _dio;

  Future<Map<String, dynamic>> getRoster(String classId, String occurrenceDate) async {
    final response = await _dio.get('/classes/$classId/attendance/$occurrenceDate');
    return response.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> bulkMark(
    String classId,
    String occurrenceDate,
    List<({String studentId, String status, String? notes})> records,
  ) {
    return bulkMarkRaw(classId, occurrenceDate, [
      for (final r in records) {'studentId': r.studentId, 'status': r.status, if (r.notes != null) 'notes': r.notes},
    ]);
  }

  /// Same call as [bulkMark], but takes already-JSON-shaped records — used by the offline sync
  /// replayer (features/attendance/presentation/providers), which only has the plain map it
  /// round-tripped through the queue's JSON payload, not the typed record list.
  Future<Map<String, dynamic>> bulkMarkRaw(
    String classId,
    String occurrenceDate,
    List<Map<String, dynamic>> records,
  ) async {
    final response = await _dio.post(
      '/classes/$classId/attendance/$occurrenceDate/bulk',
      data: {'records': records},
    );
    return response.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> getStudentAttendanceHistory(String studentId) async {
    final response = await _dio.get('/students/$studentId/attendance');
    return response.data as Map<String, dynamic>;
  }
}
