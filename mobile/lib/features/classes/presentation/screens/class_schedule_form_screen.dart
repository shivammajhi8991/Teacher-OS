import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/widgets/loading_view.dart';
import '../../domain/entities/class_schedule.dart';
import '../providers/classes_providers.dart';

const _weekdayCodes = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
const _weekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/// docs/03 §3.5 "Support different schedules: Daily / Weekly / Specific days / Custom recurring
/// schedules". Weekday checkboxes cover the common weekly/specific-days case and write directly
/// into the same RRULE text field that's shown (and editable) below them, so "Custom" is just
/// "type your own RFC 5545 rule there" rather than a second UI path (docs/01 §1.6 — fewer clicks
/// beats a wizard for the common case, without boxing out the uncommon one).
class ClassScheduleFormScreen extends ConsumerStatefulWidget {
  const ClassScheduleFormScreen({super.key, required this.classId, this.initial, this.defaultDate});

  final String classId;
  final ClassSchedule? initial;
  final String? defaultDate;

  @override
  ConsumerState<ClassScheduleFormScreen> createState() => _ClassScheduleFormScreenState();
}

class _ClassScheduleFormScreenState extends ConsumerState<ClassScheduleFormScreen> {
  final Set<String> _selectedDays = {};
  late final _ruleController = TextEditingController(text: widget.initial?.recurrenceRule ?? '');
  late final _effectiveFromController =
      TextEditingController(text: widget.initial?.effectiveFrom ?? widget.defaultDate ?? '');
  TimeOfDay _startTime = const TimeOfDay(hour: 16, minute: 0);
  TimeOfDay _endTime = const TimeOfDay(hour: 17, minute: 0);

  bool _isSubmitting = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    if (widget.initial != null) {
      _startTime = _parseTime(widget.initial!.startTime);
      _endTime = _parseTime(widget.initial!.endTime);
      final match = RegExp(r'BYDAY=([A-Z,]+)').firstMatch(widget.initial!.recurrenceRule);
      if (match != null) _selectedDays.addAll(match.group(1)!.split(','));
    }
  }

  @override
  void dispose() {
    _ruleController.dispose();
    _effectiveFromController.dispose();
    super.dispose();
  }

  TimeOfDay _parseTime(String value) {
    final parts = value.split(':');
    return TimeOfDay(hour: int.parse(parts[0]), minute: int.parse(parts[1]));
  }

  String _formatTime(TimeOfDay time) =>
      '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}';

  void _toggleDay(String code) {
    setState(() {
      if (_selectedDays.contains(code)) {
        _selectedDays.remove(code);
      } else {
        _selectedDays.add(code);
      }
      _regenerateRule();
    });
  }

  void _regenerateRule() {
    if (_selectedDays.isEmpty) {
      _ruleController.text = '';
      return;
    }
    final ordered = _weekdayCodes.where(_selectedDays.contains).join(',');
    _ruleController.text = 'FREQ=WEEKLY;BYDAY=$ordered';
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime.tryParse(_effectiveFromController.text) ?? DateTime.now(),
      firstDate: DateTime(2020),
      lastDate: DateTime(2035),
    );
    if (picked != null) _effectiveFromController.text = picked.toIso8601String().substring(0, 10);
  }

  Future<void> _pickTime({required bool isStart}) async {
    final picked = await showTimePicker(context: context, initialTime: isStart ? _startTime : _endTime);
    if (picked == null) return;
    setState(() => isStart ? _startTime = picked : _endTime = picked);
  }

  Future<void> _submit() async {
    if (_ruleController.text.trim().isEmpty || _effectiveFromController.text.trim().isEmpty) {
      setState(() => _errorMessage = 'Pick at least one day (or enter a rule) and an effective-from date.');
      return;
    }
    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    final result = await ref.read(classesRepositoryProvider).setSchedule(
          widget.classId,
          effectiveFrom: _effectiveFromController.text.trim(),
          recurrenceRule: _ruleController.text.trim(),
          startTime: _formatTime(_startTime),
          endTime: _formatTime(_endTime),
        );

    if (!mounted) return;
    result.fold(
      (failure) => setState(() {
        _isSubmitting = false;
        _errorMessage = failure.message;
      }),
      (_) {
        ref.invalidate(classScheduleProvider(widget.classId));
        ref.invalidate(classConflictsProvider(widget.classId));
        Navigator.of(context).pop(true);
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Set schedule')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Repeats on', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                children: [
                  for (var i = 0; i < _weekdayCodes.length; i++)
                    FilterChip(
                      label: Text(_weekdayLabels[i]),
                      selected: _selectedDays.contains(_weekdayCodes[i]),
                      onSelected: (_) => _toggleDay(_weekdayCodes[i]),
                    ),
                ],
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _ruleController,
                decoration: const InputDecoration(
                  labelText: 'Recurrence rule (RFC 5545)',
                  helperText: 'Auto-filled from the days above — edit directly for daily/monthly/custom rules.',
                ),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _effectiveFromController,
                decoration: const InputDecoration(
                  labelText: 'Effective from',
                  suffixIcon: Icon(Icons.calendar_today),
                ),
                readOnly: true,
                onTap: _pickDate,
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => _pickTime(isStart: true),
                      child: Text('Start: ${_formatTime(_startTime)}'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => _pickTime(isStart: false),
                      child: Text('End: ${_formatTime(_endTime)}'),
                    ),
                  ),
                ],
              ),
              if (_errorMessage != null) ...[
                const SizedBox(height: 12),
                Text(_errorMessage!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
              ],
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: _isSubmitting ? null : _submit,
                child: _isSubmitting ? const InlineSpinner() : const Text('Save schedule'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
