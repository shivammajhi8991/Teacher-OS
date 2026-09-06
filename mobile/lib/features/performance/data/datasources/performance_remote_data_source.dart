import 'package:dio/dio.dart';

class PerformanceRemoteDataSource {
  const PerformanceRemoteDataSource(this._dio);

  final Dio _dio;

  Future<List<dynamic>> listApplicableDefinitions() async {
    final response = await _dio.get('/performance-metric-definitions');
    return response.data as List<dynamic>;
  }

  Future<void> recordPerformance({
    required String studentId,
    required String metricDefinitionId,
    required String value,
    String? classId,
  }) {
    return _dio.post('/performance-records', data: {
      'studentId': studentId,
      'metricDefinitionId': metricDefinitionId,
      'value': value,
      if (classId != null) 'classId': classId,
    });
  }

  Future<List<dynamic>> getStudentPerformance(String studentId) async {
    final response = await _dio.get('/students/$studentId/performance');
    return response.data as List<dynamic>;
  }
}
