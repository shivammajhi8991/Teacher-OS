import '../../../../core/utils/result.dart';
import '../entities/metric_definition.dart';
import '../entities/performance_record.dart';

abstract interface class PerformanceRepository {
  /// docs/07 roadmap Phase 5 step 2 — the definitions this teacher can actually record against
  /// right now (their own + their institute's + their category's defaults).
  Future<Result<List<MetricDefinition>>> listApplicableDefinitions();

  Future<Result<void>> recordPerformance({
    required String studentId,
    required String metricDefinitionId,
    required String value,
    String? classId,
  });

  Future<Result<List<PerformanceRecord>>> getStudentPerformance(String studentId);
}
