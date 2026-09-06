import '../../domain/entities/performance_record.dart';

class PerformanceRecordDto {
  const PerformanceRecordDto({
    required this.id,
    required this.metricDefinitionId,
    required this.metricName,
    required this.metricType,
    required this.unit,
    required this.classId,
    required this.value,
    required this.recordedAt,
  });

  factory PerformanceRecordDto.fromJson(Map<String, dynamic> json) => PerformanceRecordDto(
        id: json['id'] as String,
        metricDefinitionId: json['metricDefinitionId'] as String,
        metricName: json['metricName'] as String,
        metricType: json['metricType'] as String,
        unit: json['unit'] as String?,
        classId: json['classId'] as String?,
        value: json['value'] as String,
        recordedAt: DateTime.parse(json['recordedAt'] as String),
      );

  final String id;
  final String metricDefinitionId;
  final String metricName;
  final String metricType;
  final String? unit;
  final String? classId;
  final String value;
  final DateTime recordedAt;

  PerformanceRecord toEntity() => PerformanceRecord(
        id: id,
        metricDefinitionId: metricDefinitionId,
        metricName: metricName,
        metricType: metricType,
        unit: unit,
        classId: classId,
        value: value,
        recordedAt: recordedAt,
      );
}
