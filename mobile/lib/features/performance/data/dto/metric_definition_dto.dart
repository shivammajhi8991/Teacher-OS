import '../../domain/entities/metric_definition.dart';

class MetricDefinitionDto {
  const MetricDefinitionDto({
    required this.id,
    required this.name,
    required this.metricType,
    required this.unit,
    required this.scope,
  });

  factory MetricDefinitionDto.fromJson(Map<String, dynamic> json) => MetricDefinitionDto(
        id: json['id'] as String,
        name: json['name'] as String,
        metricType: json['metricType'] as String,
        unit: json['unit'] as String?,
        scope: json['scope'] as String,
      );

  final String id;
  final String name;
  final String metricType;
  final String? unit;
  final String scope;

  MetricDefinition toEntity() =>
      MetricDefinition(id: id, name: name, metricType: metricType, unit: unit, scope: scope);
}
