import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/widgets/loading_view.dart';
import '../../domain/entities/guardian_input.dart';
import '../../domain/entities/student.dart';
import '../providers/students_providers.dart';

/// docs/08 §8.2 "Add/invite student" (create mode) and "Student detail → edit" (edit mode) —
/// one form for both, since the field set is almost identical (docs/04 §4.4: creation accepts an
/// optional inline guardian, per spec §3 "Add parent/guardian details"; a plain edit does not —
/// guardians are managed one at a time from the detail screen once the student exists).
class StudentFormScreen extends ConsumerStatefulWidget {
  const StudentFormScreen({super.key, this.studentId, this.initial});

  /// null = create mode. Non-null = editing this student (guardian section hidden).
  final String? studentId;
  final Student? initial;

  @override
  ConsumerState<StudentFormScreen> createState() => _StudentFormScreenState();
}

class _StudentFormScreenState extends ConsumerState<StudentFormScreen> {
  final _formKey = GlobalKey<FormState>();
  late final _fullNameController =
      TextEditingController(text: widget.initial?.fullName ?? '');
  late final _dobController = TextEditingController(text: widget.initial?.dob ?? '');
  late final _genderController = TextEditingController(text: widget.initial?.gender ?? '');
  late final _emergencyNameController =
      TextEditingController(text: widget.initial?.emergencyContactName ?? '');
  late final _emergencyPhoneController =
      TextEditingController(text: widget.initial?.emergencyContactPhone ?? '');
  late final _medicalNotesController =
      TextEditingController(text: widget.initial?.medicalNotes ?? '');
  String _enrollmentStatus = 'active';

  // Create-mode-only inline guardian (docs/08 §8.2) — left blank = skip.
  final _guardianNameController = TextEditingController();
  final _guardianPhoneController = TextEditingController();
  final _guardianEmailController = TextEditingController();
  final _guardianRelationshipController = TextEditingController();
  bool _guardianConsent = false;

  bool _isSubmitting = false;
  String? _errorMessage;

  bool get _isEditMode => widget.studentId != null;

  @override
  void initState() {
    super.initState();
    if (widget.initial != null) {
      _enrollmentStatus = widget.initial!.enrollmentStatus;
    }
  }

  @override
  void dispose() {
    _fullNameController.dispose();
    _dobController.dispose();
    _genderController.dispose();
    _emergencyNameController.dispose();
    _emergencyPhoneController.dispose();
    _medicalNotesController.dispose();
    _guardianNameController.dispose();
    _guardianPhoneController.dispose();
    _guardianEmailController.dispose();
    _guardianRelationshipController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    final result = _isEditMode
        ? await ref.read(updateStudentUseCaseProvider).call(
              widget.studentId!,
              fullName: _fullNameController.text.trim(),
              dob: _dobController.text.trim().isEmpty ? null : _dobController.text.trim(),
              gender: _genderController.text.trim().isEmpty ? null : _genderController.text.trim(),
              emergencyContactName: _emergencyNameController.text.trim().isEmpty
                  ? null
                  : _emergencyNameController.text.trim(),
              emergencyContactPhone: _emergencyPhoneController.text.trim().isEmpty
                  ? null
                  : _emergencyPhoneController.text.trim(),
              medicalNotes: _medicalNotesController.text.trim().isEmpty
                  ? null
                  : _medicalNotesController.text.trim(),
              enrollmentStatus: _enrollmentStatus,
            )
        : await ref.read(createStudentUseCaseProvider).call(
              fullName: _fullNameController.text.trim(),
              dob: _dobController.text.trim().isEmpty ? null : _dobController.text.trim(),
              gender: _genderController.text.trim().isEmpty ? null : _genderController.text.trim(),
              emergencyContactName: _emergencyNameController.text.trim().isEmpty
                  ? null
                  : _emergencyNameController.text.trim(),
              emergencyContactPhone: _emergencyPhoneController.text.trim().isEmpty
                  ? null
                  : _emergencyPhoneController.text.trim(),
              medicalNotes: _medicalNotesController.text.trim().isEmpty
                  ? null
                  : _medicalNotesController.text.trim(),
              guardians: _guardianNameController.text.trim().isEmpty
                  ? const []
                  : [
                      GuardianInput(
                        fullName: _guardianNameController.text.trim(),
                        phone: _guardianPhoneController.text.trim().isEmpty
                            ? null
                            : _guardianPhoneController.text.trim(),
                        email: _guardianEmailController.text.trim().isEmpty
                            ? null
                            : _guardianEmailController.text.trim(),
                        relationship: _guardianRelationshipController.text.trim().isEmpty
                            ? null
                            : _guardianRelationshipController.text.trim(),
                        consentDataSharing: _guardianConsent,
                      ),
                    ],
            );

    if (!mounted) return;
    result.fold(
      (failure) => setState(() {
        _isSubmitting = false;
        _errorMessage = failure.message;
      }),
      (_) {
        ref.invalidate(studentListProvider);
        if (_isEditMode) ref.invalidate(studentDetailProvider(widget.studentId!));
        Navigator.of(context).pop(true);
      },
    );
  }

  Future<void> _pickDate(TextEditingController controller) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime.tryParse(controller.text) ?? DateTime(2015),
      firstDate: DateTime(1990),
      lastDate: DateTime.now(),
    );
    if (picked != null) {
      controller.text = picked.toIso8601String().substring(0, 10);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(_isEditMode ? 'Edit student' : 'Add student')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                TextFormField(
                  controller: _fullNameController,
                  decoration: const InputDecoration(labelText: 'Full name'),
                  validator: (v) => (v == null || v.trim().isEmpty) ? 'Required' : null,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _dobController,
                  decoration: const InputDecoration(labelText: 'Date of birth', suffixIcon: Icon(Icons.calendar_today)),
                  readOnly: true,
                  onTap: () => _pickDate(_dobController),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _genderController,
                  decoration: const InputDecoration(labelText: 'Gender'),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _emergencyNameController,
                  decoration: const InputDecoration(labelText: 'Emergency contact name'),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _emergencyPhoneController,
                  decoration: const InputDecoration(labelText: 'Emergency contact phone'),
                  keyboardType: TextInputType.phone,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _medicalNotesController,
                  decoration: const InputDecoration(labelText: 'Medical notes'),
                  maxLines: 2,
                ),
                if (_isEditMode) ...[
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    initialValue: _enrollmentStatus,
                    decoration: const InputDecoration(labelText: 'Status'),
                    items: const [
                      DropdownMenuItem(value: 'active', child: Text('Active')),
                      DropdownMenuItem(value: 'inactive', child: Text('Inactive')),
                      DropdownMenuItem(value: 'left', child: Text('Left')),
                    ],
                    onChanged: (v) => setState(() => _enrollmentStatus = v ?? _enrollmentStatus),
                  ),
                ],
                if (!_isEditMode) ...[
                  const SizedBox(height: 24),
                  Text('Parent/guardian (optional)', style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 8),
                  TextFormField(
                    controller: _guardianNameController,
                    decoration: const InputDecoration(labelText: 'Guardian full name'),
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _guardianPhoneController,
                    decoration: const InputDecoration(labelText: 'Guardian phone'),
                    keyboardType: TextInputType.phone,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _guardianEmailController,
                    decoration: const InputDecoration(labelText: 'Guardian email'),
                    keyboardType: TextInputType.emailAddress,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _guardianRelationshipController,
                    decoration: const InputDecoration(labelText: 'Relationship (e.g. Mother)'),
                  ),
                  CheckboxListTile(
                    contentPadding: EdgeInsets.zero,
                    controlAffinity: ListTileControlAffinity.leading,
                    title: const Text('Guardian consents to data sharing'),
                    value: _guardianConsent,
                    onChanged: (v) => setState(() => _guardianConsent = v ?? false),
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
                      : Text(_isEditMode ? 'Save changes' : 'Add student'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
