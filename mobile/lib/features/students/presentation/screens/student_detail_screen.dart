import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/error/failure.dart';
import '../../../../core/widgets/error_view.dart';
import '../../../../core/widgets/loading_view.dart';
import '../../domain/entities/guardian_info.dart';
import '../../domain/entities/guardian_input.dart';
import '../../domain/entities/student_detail.dart';
import '../../domain/entities/teacher_assignment_info.dart';
import '../providers/students_providers.dart';
import 'student_form_screen.dart';

/// docs/08 §8.2 "Student detail" — profile, guardians, teacher assignments. Attendance/fee/notes
/// sections join once those modules ship (docs/07 steps 5–7); this shows what exists today.
class StudentDetailScreen extends ConsumerWidget {
  const StudentDetailScreen({super.key, required this.studentId});

  final String studentId;

  Future<void> _openEdit(BuildContext context, WidgetRef ref, StudentDetail detail) async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => StudentFormScreen(studentId: studentId, initial: detail.student),
      ),
    );
  }

  Future<void> _confirmArchive(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Archive student?'),
        content: const Text(
          'Attendance and fee history is kept — you can restore this student later. '
          'This does not delete anything.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.of(context).pop(true), child: const Text('Archive')),
        ],
      ),
    );
    if (confirmed != true) return;

    final result = await ref.read(archiveStudentUseCaseProvider).call(studentId);
    if (!context.mounted) return;
    result.fold(
      (failure) =>
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(failure.message))),
      (_) {
        ref.invalidate(studentListProvider);
        Navigator.of(context).pop();
      },
    );
  }

  Future<void> _openAddGuardian(BuildContext context, WidgetRef ref) async {
    final result = await showDialog<GuardianInput>(
      context: context,
      builder: (context) => const _AddGuardianDialog(),
    );
    if (result == null) return;

    final addResult = await ref.read(addGuardianUseCaseProvider).call(studentId, result);
    if (!context.mounted) return;
    addResult.fold(
      (failure) =>
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(failure.message))),
      (_) => ref.invalidate(studentDetailProvider(studentId)),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detailAsync = ref.watch(studentDetailProvider(studentId));

    return Scaffold(
      appBar: AppBar(title: const Text('Student')),
      body: detailAsync.when(
        loading: () => const LoadingView(),
        error: (error, stackTrace) => ErrorView(
          failure: UnexpectedFailure(message: error.toString()),
          onRetry: () => ref.invalidate(studentDetailProvider(studentId)),
        ),
        data: (result) => result.fold(
          (failure) => ErrorView(
            failure: failure,
            onRetry: () => ref.invalidate(studentDetailProvider(studentId)),
          ),
          (detail) => ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Row(
                children: [
                  CircleAvatar(
                    radius: 28,
                    child: Text(detail.student.fullName.isNotEmpty ? detail.student.fullName[0] : '?'),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(detail.student.fullName, style: Theme.of(context).textTheme.titleLarge),
                        Text(
                          'Status: ${detail.student.enrollmentStatus} · Joined ${detail.student.joinDate}',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => _openEdit(context, ref, detail),
                      icon: const Icon(Icons.edit_outlined),
                      label: const Text('Edit'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => _confirmArchive(context, ref),
                      icon: const Icon(Icons.archive_outlined),
                      label: const Text('Archive'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),
              _Section(
                title: 'Details',
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _DetailRow('Date of birth', detail.student.dob),
                    _DetailRow('Gender', detail.student.gender),
                    _DetailRow('Emergency contact', detail.student.emergencyContactName),
                    _DetailRow('Emergency phone', detail.student.emergencyContactPhone),
                    _DetailRow('Medical notes', detail.student.medicalNotes),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              _Section(
                title: 'Guardians',
                trailing: TextButton.icon(
                  onPressed: () => _openAddGuardian(context, ref),
                  icon: const Icon(Icons.add, size: 18),
                  label: const Text('Add'),
                ),
                child: detail.guardians.isEmpty
                    ? const Text('No guardians linked yet.')
                    : Column(children: [for (final g in detail.guardians) _GuardianTile(guardian: g)]),
              ),
              const SizedBox(height: 16),
              _Section(
                title: 'Teachers',
                child: detail.teacherAssignments.isEmpty
                    ? const Text('No teacher assignments.')
                    : Column(
                        children: [
                          for (final a in detail.teacherAssignments) _AssignmentTile(assignment: a),
                        ],
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.child, this.trailing});

  final String title;
  final Widget child;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(title, style: Theme.of(context).textTheme.titleMedium),
                if (trailing != null) trailing!,
              ],
            ),
            const SizedBox(height: 8),
            child,
          ],
        ),
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow(this.label, this.value);

  final String label;
  final String? value;

  @override
  Widget build(BuildContext context) {
    if (value == null || value!.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          SizedBox(width: 140, child: Text(label, style: Theme.of(context).textTheme.bodySmall)),
          Expanded(child: Text(value!)),
        ],
      ),
    );
  }
}

class _GuardianTile extends StatelessWidget {
  const _GuardianTile({required this.guardian});

  final GuardianInfo guardian;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: const Icon(Icons.family_restroom_outlined),
      title: Text(guardian.fullName),
      subtitle: Text([
        if (guardian.relationship != null) guardian.relationship!,
        if (guardian.phone != null) guardian.phone!,
      ].join(' · ')),
      trailing: guardian.isPrimary ? const Chip(label: Text('Primary')) : null,
    );
  }
}

class _AssignmentTile extends StatelessWidget {
  const _AssignmentTile({required this.assignment});

  final TeacherAssignmentInfo assignment;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: const Icon(Icons.school_outlined),
      title: Text(assignment.subjectOrSkill ?? 'General'),
      subtitle: Text(assignment.isOngoing ? 'Ongoing' : 'Ended'),
    );
  }
}

class _AddGuardianDialog extends StatefulWidget {
  const _AddGuardianDialog();

  @override
  State<_AddGuardianDialog> createState() => _AddGuardianDialogState();
}

class _AddGuardianDialogState extends State<_AddGuardianDialog> {
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _emailController = TextEditingController();
  final _relationshipController = TextEditingController();
  bool _consent = false;

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _emailController.dispose();
    _relationshipController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Add guardian'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: _nameController,
              decoration: const InputDecoration(labelText: 'Full name'),
              onChanged: (_) => setState(() {}), // keeps the Add button's enabled state live
            ),
            TextField(
              controller: _phoneController,
              decoration: const InputDecoration(labelText: 'Phone'),
              keyboardType: TextInputType.phone,
            ),
            TextField(
              controller: _emailController,
              decoration: const InputDecoration(labelText: 'Email'),
              keyboardType: TextInputType.emailAddress,
            ),
            TextField(
              controller: _relationshipController,
              decoration: const InputDecoration(labelText: 'Relationship'),
            ),
            CheckboxListTile(
              contentPadding: EdgeInsets.zero,
              controlAffinity: ListTileControlAffinity.leading,
              title: const Text('Consents to data sharing'),
              value: _consent,
              onChanged: (v) => setState(() => _consent = v ?? false),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Cancel')),
        FilledButton(
          onPressed: _nameController.text.trim().isEmpty
              ? null
              : () => Navigator.of(context).pop(
                    GuardianInput(
                      fullName: _nameController.text.trim(),
                      phone: _phoneController.text.trim().isEmpty ? null : _phoneController.text.trim(),
                      email: _emailController.text.trim().isEmpty ? null : _emailController.text.trim(),
                      relationship: _relationshipController.text.trim().isEmpty
                          ? null
                          : _relationshipController.text.trim(),
                      consentDataSharing: _consent,
                    ),
                  ),
          child: const Text('Add'),
        ),
      ],
    );
  }
}
