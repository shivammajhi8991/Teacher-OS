/// Mirrors backend `PerformanceRecordSummary` (performance.service.ts).
class PerformanceRecord {
  const PerformanceRecord({
    required this.id,
    required this.metricDefinitionId,
    required this.metricName,
    required this.metricType,
    required this.unit,
    required this.classId,
    required this.value,
    required this.recordedAt,
  });

  final String id;
  final String metricDefinitionId;
  final String metricName;
  final String metricType;
  final String? unit;
  final String? classId;
  final String value;
  final DateTime recordedAt;
}
