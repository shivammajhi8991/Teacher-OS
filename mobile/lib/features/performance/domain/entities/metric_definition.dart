/// Mirrors backend `MetricDefinitionSummary` (performance.service.ts).
class MetricDefinition {
  const MetricDefinition({
    required this.id,
    required this.name,
    required this.metricType,
    required this.unit,
    required this.scope,
  });

  final String id;
  final String name;
  final String metricType; // 'numeric' | 'scale_1_5' | 'pass_fail' | 'text' | 'percentage'
  final String? unit;
  final String scope; // 'category' | 'institute' | 'teacher'
}
