import 'package:dio/dio.dart';
import '../../../../core/network/api_exception_mapper.dart';
import '../../../../core/utils/result.dart';
import '../../domain/entities/metric_definition.dart';
import '../../domain/entities/performance_record.dart';
import '../../domain/repositories/performance_repository.dart';
import '../datasources/performance_remote_data_source.dart';
import '../dto/metric_definition_dto.dart';
import '../dto/performance_record_dto.dart';

class PerformanceRepositoryImpl implements PerformanceRepository {
  const PerformanceRepositoryImpl(this._remoteDataSource);

  final PerformanceRemoteDataSource _remoteDataSource;

  @override
  Future<Result<List<MetricDefinition>>> listApplicableDefinitions() async {
    try {
      final json = await _remoteDataSource.listApplicableDefinitions();
      final definitions =
          json.map((item) => MetricDefinitionDto.fromJson(item as Map<String, dynamic>).toEntity()).toList();
      return Ok(definitions);
    } on DioException catch (e) {
      return Err(mapDioExceptionToFailure(e));
    }
  }

  @override
  Future<Result<void>> recordPerformance({
    required String studentId,
    required String metricDefinitionId,
    required String value,
    String? classId,
  }) async {
    try {
      await _remoteDataSource.recordPerformance(
        studentId: studentId,
        metricDefinitionId: metricDefinitionId,
        value: value,
        classId: classId,
      );
      return const Ok(null);
    } on DioException catch (e) {
      return Err(mapDioExceptionToFailure(e));
    }
  }

  @override
  Future<Result<List<PerformanceRecord>>> getStudentPerformance(String studentId) async {
    try {
      final json = await _remoteDataSource.getStudentPerformance(studentId);
      final records =
          json.map((item) => PerformanceRecordDto.fromJson(item as Map<String, dynamic>).toEntity()).toList();
      return Ok(records);
    } on DioException catch (e) {
      return Err(mapDioExceptionToFailure(e));
    }
  }
}
