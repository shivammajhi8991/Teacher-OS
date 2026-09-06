import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/assignments_providers.dart';

/// docs/08 §8.2 "Create assignment: Title, attachments, deadline, target." Mobile scope here is
/// class-targeted, attachment-free (documented deviation — the backend's individual-student
/// targeting and real attachment upload both exist and are usable, just not from this dialog
/// yet, matching the same "no new pubspec dependency" discipline as Notes' link-only scope).
class CreateAssignmentDialog extends ConsumerStatefulWidget {
  const CreateAssignmentDialog({super.key, required this.classId});

  final String classId;

  @override
  ConsumerState<CreateAssignmentDialog> createState() => _CreateAssignmentDialogState();
}

class _CreateAssignmentDialogState extends ConsumerState<CreateAssignmentDialog> {
  final _titleController = TextEditingController();
  final _descriptionController = TextEditingController();
  DateTime? _dueAt;
  bool _allowLateSubmission = true;
  bool _allowResubmission = false;
  bool _isSubmitting = false;
  String? _errorMessage;

  @override
  void dispose() {
    _titleController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _pickDueDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime.now().add(const Duration(days: 7)),
      firstDate: DateTime.now(),
      lastDate: DateTime(2035),
    );
    if (picked != null) setState(() => _dueAt = picked);
  }

  Future<void> _confirm() async {
    final title = _titleController.text.trim();
    if (title.isEmpty) {
      setState(() => _errorMessage = 'Enter a title');
      return;
    }
    if (_dueAt == null) {
      setState(() => _errorMessage = 'Pick a due date');
      return;
    }

    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    final result = await ref.read(assignmentsRepositoryProvider).createClassAssignment(
          classId: widget.classId,
          title: title,
          description: _descriptionController.text.trim().isEmpty ? null : _descriptionController.text.trim(),
          dueAt: _dueAt!,
          allowLateSubmission: _allowLateSubmission,
          allowResubmission: _allowResubmission,
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
    return AlertDialog(
      title: const Text('New assignment'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            TextField(
              controller: _titleController,
              decoration: const InputDecoration(labelText: 'Title'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _descriptionController,
              decoration: const InputDecoration(labelText: 'Description (optional)'),
              maxLines: 3,
            ),
            const SizedBox(height: 12),
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(_dueAt == null ? 'Due date' : 'Due ${_dueAt!.toLocal().toString().substring(0, 10)}'),
              trailing: const Icon(Icons.calendar_today_outlined),
              onTap: _pickDueDate,
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Allow late submission'),
              value: _allowLateSubmission,
              onChanged: (v) => setState(() => _allowLateSubmission = v),
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Allow resubmission'),
              value: _allowResubmission,
              onChanged: (v) => setState(() => _allowResubmission = v),
            ),
            if (_errorMessage != null) ...[
              const SizedBox(height: 8),
              Text(_errorMessage!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
            ],
          ],
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
              : const Text('Create'),
        ),
      ],
    );
  }
}
