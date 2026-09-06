import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../domain/entities/metric_definition.dart';
import '../providers/performance_providers.dart';

/// docs/01 §1.4 "configurable performance metrics" — the metric picker is populated from
/// whatever `listApplicableDefinitions` actually returns (this teacher's own + their institute's
/// + their category's defaults), so a sports coach naturally sees "40m Sprint Time" and a music
/// teacher sees "Scale Mastery" without any client-side per-category logic.
///
/// A single value field covers every metric type (numeric/percentage/scale_1_5/pass_fail/text) —
/// server-side validation (real, tested — see performance.service.spec.ts) is the actual source
/// of truth for what's a valid value, surfaced back here as an inline error rather than
/// duplicated client-side per type.
class RecordPerformanceDialog extends ConsumerStatefulWidget {
  const RecordPerformanceDialog({super.key, required this.studentId});

  final String studentId;

  @override
  ConsumerState<RecordPerformanceDialog> createState() => _RecordPerformanceDialogState();
}

class _RecordPerformanceDialogState extends ConsumerState<RecordPerformanceDialog> {
  MetricDefinition? _selected;
  final _valueController = TextEditingController();
  bool _isSubmitting = false;
  String? _errorMessage;

  @override
  void dispose() {
    _valueController.dispose();
    super.dispose();
  }

  String _hintFor(MetricDefinition definition) => switch (definition.metricType) {
        'numeric' => definition.unit != null ? 'A number, in ${definition.unit}' : 'A number',
        'percentage' => '0–100',
        'scale_1_5' => '1–5',
        'pass_fail' => "'pass' or 'fail'",
        _ => 'Free text',
      };

  Future<void> _confirm() async {
    if (_selected == null) {
      setState(() => _errorMessage = 'Choose a metric');
      return;
    }
    final value = _valueController.text.trim();
    if (value.isEmpty) {
      setState(() => _errorMessage = 'Enter a value');
      return;
    }

    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    final result = await ref.read(performanceRepositoryProvider).recordPerformance(
          studentId: widget.studentId,
          metricDefinitionId: _selected!.id,
          value: value,
        );

    if (!mounted) return;
    result.fold(
      (failure) => setState(() {
        _isSubmitting = false;
        _errorMessage = failure.message;
      }),
      (_) => Navigator.of(context).pop(true),
    );
  }

  @override
  Widget build(BuildContext context) {
    final definitionsAsync = ref.watch(applicableMetricDefinitionsProvider);

    return AlertDialog(
      title: const Text('Record performance'),
      content: definitionsAsync.when(
        loading: () => const SizedBox(
          height: 60,
          child: Center(child: CircularProgressIndicator()),
        ),
        error: (error, stackTrace) => Text('Could not load metrics: $error'),
        data: (result) => result.fold(
          (failure) => Text(failure.message),
          (definitions) => definitions.isEmpty
              ? const Text('No metrics defined yet — define one first.')
              : Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    DropdownButtonFormField<MetricDefinition>(
                      initialValue: _selected,
                      decoration: const InputDecoration(labelText: 'Metric'),
                      items: [
                        for (final d in definitions)
                          DropdownMenuItem(value: d, child: Text(d.name)),
                      ],
                      onChanged: (d) => setState(() => _selected = d),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _valueController,
                      decoration: InputDecoration(
                        labelText: 'Value',
                        hintText: _selected != null ? _hintFor(_selected!) : null,
                      ),
                    ),
                    if (_errorMessage != null) ...[
                      const SizedBox(height: 8),
                      Text(_errorMessage!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
                    ],
                  ],
                ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: _isSubmitting ? null : () => Navigator.of(context).pop(false),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: _isSubmitting ? null : _confirm,
          child: _isSubmitting
              ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
              : const Text('Save'),
        ),
      ],
    );
  }
}
