import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/widgets/loading_view.dart';
import '../../domain/entities/teaching_class.dart';
import '../providers/classes_providers.dart';

/// docs/08 §8.2 "Create/edit class" — one form for both, mirroring the Students pattern
/// (student_form_screen.dart).
class ClassFormScreen extends ConsumerStatefulWidget {
  const ClassFormScreen({super.key, this.classId, this.initial});

  final String? classId;
  final TeachingClass? initial;

  @override
  ConsumerState<ClassFormScreen> createState() => _ClassFormScreenState();
}

class _ClassFormScreenState extends ConsumerState<ClassFormScreen> {
  final _formKey = GlobalKey<FormState>();
  late final _nameController = TextEditingController(text: widget.initial?.name ?? '');
  late final _subjectController =
      TextEditingController(text: widget.initial?.subjectOrActivity ?? '');
  late final _locationController =
      TextEditingController(text: widget.initial?.locationOrMeetingLink ?? '');
  late final _capacityController =
      TextEditingController(text: widget.initial?.capacityMax?.toString() ?? '');
  late final _startDateController = TextEditingController(text: widget.initial?.startDate ?? '');
  late final _endDateController = TextEditingController(text: widget.initial?.endDate ?? '');
  String _mode = 'offline';
  String _classType = 'recurring';
  String _status = 'active';

  bool _isSubmitting = false;
  String? _errorMessage;

  bool get _isEditMode => widget.classId != null;

  @override
  void initState() {
    super.initState();
    if (widget.initial != null) {
      _mode = widget.initial!.mode;
      _classType = widget.initial!.classType;
      _status = widget.initial!.status;
    } else {
      _startDateController.text = DateTime.now().toIso8601String().substring(0, 10);
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _subjectController.dispose();
    _locationController.dispose();
    _capacityController.dispose();
    _startDateController.dispose();
    _endDateController.dispose();
    super.dispose();
  }

  Future<void> _pickDate(TextEditingController controller) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime.tryParse(controller.text) ?? DateTime.now(),
      firstDate: DateTime(2020),
      lastDate: DateTime(2035),
    );
    if (picked != null) controller.text = picked.toIso8601String().substring(0, 10);
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    final repository = ref.read(classesRepositoryProvider);
    final result = _isEditMode
        ? await repository.updateClass(
            widget.classId!,
            name: _nameController.text.trim(),
            subjectOrActivity: _subjectController.text.trim().isEmpty ? null : _subjectController.text.trim(),
            mode: _mode,
            locationOrMeetingLink:
                _locationController.text.trim().isEmpty ? null : _locationController.text.trim(),
            capacityMax: int.tryParse(_capacityController.text.trim()),
            endDate: _endDateController.text.trim().isEmpty ? null : _endDateController.text.trim(),
            status: _status,
          )
        : await repository.createClass(
            name: _nameController.text.trim(),
            subjectOrActivity: _subjectController.text.trim().isEmpty ? null : _subjectController.text.trim(),
            classType: _classType,
            mode: _mode,
            locationOrMeetingLink:
                _locationController.text.trim().isEmpty ? null : _locationController.text.trim(),
            capacityMax: int.tryParse(_capacityController.text.trim()),
            startDate: _startDateController.text.trim(),
            endDate: _endDateController.text.trim().isEmpty ? null : _endDateController.text.trim(),
          );

    if (!mounted) return;
    result.fold(
      (failure) => setState(() {
        _isSubmitting = false;
        _errorMessage = failure.message;
      }),
      (_) {
        ref.invalidate(classListProvider);
        if (_isEditMode) ref.invalidate(classDetailProvider(widget.classId!));
        Navigator.of(context).pop(true);
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(_isEditMode ? 'Edit class' : 'Create class')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                TextFormField(
                  controller: _nameController,
                  decoration: const InputDecoration(labelText: 'Class name'),
                  validator: (v) => (v == null || v.trim().isEmpty) ? 'Required' : null,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _subjectController,
                  decoration: const InputDecoration(labelText: 'Subject / activity'),
                ),
                const SizedBox(height: 12),
                if (!_isEditMode) ...[
                  Align(
                    alignment: Alignment.centerLeft,
                    child: SegmentedButton<String>(
                      segments: const [
                        ButtonSegment(value: 'recurring', label: Text('Recurring')),
                        ButtonSegment(value: 'one_time', label: Text('One-time')),
                        ButtonSegment(value: 'trial', label: Text('Trial')),
                      ],
                      selected: {_classType},
                      onSelectionChanged: (s) => setState(() => _classType = s.first),
                    ),
                  ),
                  const SizedBox(height: 12),
                ],
                Align(
                  alignment: Alignment.centerLeft,
                  child: SegmentedButton<String>(
                    segments: const [
                      ButtonSegment(value: 'offline', label: Text('Offline')),
                      ButtonSegment(value: 'online', label: Text('Online')),
                    ],
                    selected: {_mode},
                    onSelectionChanged: (s) => setState(() => _mode = s.first),
                  ),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _locationController,
                  decoration: InputDecoration(
                    labelText: _mode == 'online' ? 'Meeting link' : 'Location',
                  ),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _capacityController,
                  decoration: const InputDecoration(labelText: 'Max students (optional)'),
                  keyboardType: TextInputType.number,
                ),
                if (!_isEditMode) ...[
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _startDateController,
                    decoration: const InputDecoration(
                      labelText: 'Start date',
                      suffixIcon: Icon(Icons.calendar_today),
                    ),
                    readOnly: true,
                    onTap: () => _pickDate(_startDateController),
                    validator: (v) => (v == null || v.isEmpty) ? 'Required' : null,
                  ),
                ],
                const SizedBox(height: 12),
                TextFormField(
                  controller: _endDateController,
                  decoration: const InputDecoration(
                    labelText: 'End date (optional — leave blank if ongoing)',
                    suffixIcon: Icon(Icons.calendar_today),
                  ),
                  readOnly: true,
                  onTap: () => _pickDate(_endDateController),
                ),
                if (_isEditMode) ...[
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    initialValue: _status,
                    decoration: const InputDecoration(labelText: 'Status'),
                    items: const [
                      DropdownMenuItem(value: 'active', child: Text('Active')),
                      DropdownMenuItem(value: 'completed', child: Text('Completed')),
                      DropdownMenuItem(value: 'cancelled', child: Text('Cancelled')),
                    ],
                    onChanged: (v) => setState(() => _status = v ?? _status),
                  ),
                ],
                if (_errorMessage != null) ...[
                  const SizedBox(height: 12),
                  Text(_errorMessage!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
                ],
                const SizedBox(height: 24),
                ElevatedButton(
                  onPressed: _isSubmitting ? null : _submit,
                  child: _isSubmitting
                      ? const InlineSpinner()
                      : Text(_isEditMode ? 'Save changes' : 'Create class'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
