import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/error/failure.dart';
import '../../../../core/widgets/empty_state.dart';
import '../../../../core/widgets/error_view.dart';
import '../../../../core/widgets/loading_view.dart';
import '../../../assignments/domain/entities/assignment_summary.dart';
import '../../../assignments/presentation/providers/assignments_providers.dart';
import '../../../assignments/presentation/screens/assignment_review_screen.dart';
import '../../../assignments/presentation/widgets/create_assignment_dialog.dart';
import '../../../attendance/presentation/screens/quick_attendance_screen.dart';
import '../../../notes/domain/entities/document_summary.dart';
import '../../../notes/presentation/providers/notes_providers.dart';
import '../../../notes/presentation/widgets/add_link_note_dialog.dart';
import '../../../students/domain/entities/student.dart';
import '../../../students/presentation/providers/students_providers.dart';
import '../../domain/entities/enrollment_summary.dart';
import '../../domain/entities/schedule_conflict.dart';
import '../../domain/entities/teaching_class.dart';
import '../providers/classes_providers.dart';
import 'class_form_screen.dart';
import 'class_schedule_form_screen.dart';

/// docs/08 §8.2 "Class detail" — info, schedule, conflict check, roster.
///
/// Deferred in this pass (documented, not silently skipped): schedule *exceptions*
/// (holiday/cancel/reschedule/makeup/extra — docs/03 §3.5 `schedule_exceptions`) and *waitlist*
/// management UI. Both backend endpoints exist and are tested
/// (backend/src/modules/classes/classes.service.spec.ts); only the mobile screens are pending.
class ClassDetailScreen extends ConsumerWidget {
  const ClassDetailScreen({super.key, required this.classId});

  final String classId;

  Future<void> _openEdit(BuildContext context, WidgetRef ref, TeachingClass cls) async {
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => ClassFormScreen(classId: classId, initial: cls)),
    );
  }

  Future<void> _openScheduleForm(BuildContext context, WidgetRef ref, TeachingClass cls) async {
    final scheduleResult = await ref.read(classesRepositoryProvider).getSchedule(classId);
    final current = scheduleResult.fold((_) => null, (schedule) => schedule);
    if (!context.mounted) return;
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ClassScheduleFormScreen(classId: classId, initial: current, defaultDate: cls.startDate),
      ),
    );
  }

  Future<void> _openEnrollDialog(BuildContext context, WidgetRef ref, List<EnrollmentSummary> enrolled) async {
    final enrolledIds = enrolled.map((e) => e.studentId).toSet();
    final studentsResult = await ref.read(listStudentsUseCaseProvider).call();
    if (!context.mounted) return;

    final List<Student> candidates = studentsResult.fold(
      (failure) => const <Student>[],
      (students) => students.where((s) => !enrolledIds.contains(s.id)).toList(),
    );

    if (candidates.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No more students to enroll — everyone is already in this class.')),
      );
      return;
    }

    final selectedId = await showDialog<String>(
      context: context,
      builder: (context) => SimpleDialog(
        title: const Text('Enroll a student'),
        children: [
          for (final student in candidates)
            SimpleDialogOption(
              onPressed: () => Navigator.of(context).pop(student.id),
              child: Text(student.fullName),
            ),
        ],
      ),
    );
    if (selectedId == null || !context.mounted) return;

    final result = await ref.read(classesRepositoryProvider).enrollStudent(classId, selectedId);
    if (!context.mounted) return;
    result.fold(
      (failure) {
        if (failure is ApiFailure && failure.code == 'CLASS_AT_CAPACITY') {
          _offerWaitlist(context, ref, selectedId);
        } else {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(failure.message)));
        }
      },
      (_) => ref.invalidate(classEnrollmentsProvider(classId)),
    );
  }

  Future<void> _offerWaitlist(BuildContext context, WidgetRef ref, String studentId) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Class is full'),
        content: const Text('Add this student to the waitlist instead?'),
        actions: [
          TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.of(context).pop(true), child: const Text('Add to waitlist')),
        ],
      ),
    );
    if (confirmed != true || !context.mounted) return;

    final result = await ref.read(classesRepositoryProvider).addToWaitlist(classId, studentId);
    if (!context.mounted) return;
    result.fold(
      (failure) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(failure.message))),
      (_) => ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Added to the waitlist.'))),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final classAsync = ref.watch(classDetailProvider(classId));

    return Scaffold(
      appBar: AppBar(title: const Text('Class')),
      body: classAsync.when(
        loading: () => const LoadingView(),
        error: (error, stackTrace) => ErrorView(
          failure: UnexpectedFailure(message: error.toString()),
          onRetry: () => ref.invalidate(classDetailProvider(classId)),
        ),
        data: (result) => result.fold(
          (failure) =>
              ErrorView(failure: failure, onRetry: () => ref.invalidate(classDetailProvider(classId))),
          (cls) => ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Text(cls.name, style: Theme.of(context).textTheme.titleLarge),
              if (cls.subjectOrActivity != null) Text(cls.subjectOrActivity!),
              Text(
                '${cls.mode} · ${cls.classType} · ${cls.status}',
                style: Theme.of(context).textTheme.bodySmall,
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: () => Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => QuickAttendanceScreen(classId: classId)),
                      ),
                      icon: const Icon(Icons.fact_check_outlined),
                      label: const Text('Take Attendance'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  OutlinedButton.icon(
                    onPressed: () => _openEdit(context, ref, cls),
                    icon: const Icon(Icons.edit_outlined),
                    label: const Text('Edit'),
                  ),
                ],
              ),
              const SizedBox(height: 24),
              _ScheduleSection(
                classId: classId,
                onSetSchedule: () => _openScheduleForm(context, ref, cls),
              ),
              const SizedBox(height: 16),
              _ConflictsSection(classId: classId),
              const SizedBox(height: 16),
              _EnrollmentsSection(
                classId: classId,
                onEnroll: (enrolled) => _openEnrollDialog(context, ref, enrolled),
              ),
              const SizedBox(height: 16),
              _NotesSection(classId: classId),
              const SizedBox(height: 16),
              _AssignmentsSection(classId: classId),
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

class _ScheduleSection extends ConsumerWidget {
  const _ScheduleSection({required this.classId, required this.onSetSchedule});

  final String classId;
  final VoidCallback onSetSchedule;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final scheduleAsync = ref.watch(classScheduleProvider(classId));

    return _Section(
      title: 'Schedule',
      trailing: TextButton(onPressed: onSetSchedule, child: const Text('Set / change')),
      child: scheduleAsync.when(
        loading: () => const LoadingView(),
        error: (error, stackTrace) => const Text('Could not load schedule.'),
        data: (result) => result.fold(
          (failure) => Text(failure.message),
          (schedule) => schedule == null
              ? const Text('No schedule set yet.')
              : Text('${schedule.recurrenceRule}\n${schedule.startTime} – ${schedule.endTime}'),
        ),
      ),
    );
  }
}

class _ConflictsSection extends ConsumerWidget {
  const _ConflictsSection({required this.classId});

  final String classId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final conflictsAsync = ref.watch(classConflictsProvider(classId));

    return _Section(
      title: 'Schedule conflicts (next 14 days)',
      trailing: IconButton(
        icon: const Icon(Icons.refresh, size: 20),
        onPressed: () => ref.invalidate(classConflictsProvider(classId)),
      ),
      child: conflictsAsync.when(
        loading: () => const LoadingView(),
        error: (error, stackTrace) => const Text('Could not check for conflicts.'),
        data: (result) => result.fold(
          (failure) => Text(failure.message),
          (conflicts) => conflicts.isEmpty
              ? const Text('No conflicts found.')
              : Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [for (final c in conflicts) _ConflictTile(conflict: c)],
                ),
        ),
      ),
    );
  }
}

class _ConflictTile extends StatelessWidget {
  const _ConflictTile({required this.conflict});

  final ScheduleConflict conflict;

  @override
  Widget build(BuildContext context) {
    final label = conflict.type == 'teacher_double_booking' ? 'Double-booked' : 'Location conflict';
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Icon(Icons.warning_amber, size: 18, color: Colors.orange.shade700),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              '$label with "${conflict.conflictingClassName}" on '
              '${conflict.occurrenceDate.toLocal().toString().substring(0, 16)}',
            ),
          ),
        ],
      ),
    );
  }
}

class _EnrollmentsSection extends ConsumerWidget {
  const _EnrollmentsSection({required this.classId, required this.onEnroll});

  final String classId;
  final void Function(List<EnrollmentSummary> enrolled) onEnroll;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final enrollmentsAsync = ref.watch(classEnrollmentsProvider(classId));

    return _Section(
      title: 'Students',
      trailing: enrollmentsAsync.maybeWhen(
        data: (result) => result.fold(
          (_) => const SizedBox.shrink(),
          (enrolled) => TextButton.icon(
            onPressed: () => onEnroll(enrolled),
            icon: const Icon(Icons.person_add_alt_outlined, size: 18),
            label: const Text('Enroll'),
          ),
        ),
        orElse: () => const SizedBox.shrink(),
      ),
      child: enrollmentsAsync.when(
        loading: () => const LoadingView(),
        error: (error, stackTrace) => const Text('Could not load the roster.'),
        data: (result) => result.fold(
          (failure) => Text(failure.message),
          (enrolled) => enrolled.isEmpty
              ? const EmptyState(message: 'No students enrolled yet.')
              : Column(children: [for (final e in enrolled) _EnrollmentTile(enrollment: e)]),
        ),
      ),
    );
  }
}

class _EnrollmentTile extends StatelessWidget {
  const _EnrollmentTile({required this.enrollment});

  final EnrollmentSummary enrollment;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: const Icon(Icons.person_outline),
      title: Text(enrollment.studentFullName),
      trailing: Chip(label: Text(enrollment.status), visualDensity: VisualDensity.compact),
    );
  }
}

/// docs/07 roadmap "Notes" — link-only in this pass, see add_link_note_dialog.dart for why.
class _NotesSection extends ConsumerWidget {
  const _NotesSection({required this.classId});

  final String classId;

  Future<void> _addLink(BuildContext context, WidgetRef ref) async {
    final added = await showDialog<bool>(
      context: context,
      builder: (_) => AddLinkNoteDialog(classId: classId),
    );
    if (added == true) {
      ref.invalidate(classLinkNotesProvider(classId));
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notesAsync = ref.watch(classLinkNotesProvider(classId));

    return _Section(
      title: 'Notes',
      trailing: TextButton.icon(
        onPressed: () => _addLink(context, ref),
        icon: const Icon(Icons.add_link, size: 18),
        label: const Text('Add link'),
      ),
      child: notesAsync.when(
        loading: () => const LoadingView(),
        error: (error, stackTrace) => const Text('Could not load notes.'),
        data: (result) => result.fold(
          (failure) => Text(failure.message),
          (notes) => notes.isEmpty
              ? const EmptyState(message: 'No notes shared with this class yet.')
              : Column(children: [for (final n in notes) _NoteTile(note: n)]),
        ),
      ),
    );
  }
}

class _NoteTile extends StatelessWidget {
  const _NoteTile({required this.note});

  final DocumentSummary note;

  Future<void> _copyLink(BuildContext context) async {
    if (note.externalUrl == null) return;
    await Clipboard.setData(ClipboardData(text: note.externalUrl!));
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Link copied.')),
    );
  }

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: Icon(note.isLink ? Icons.link : Icons.insert_drive_file_outlined),
      title: Text(note.title),
      subtitle: note.isLink
          ? Text(note.externalUrl ?? '', maxLines: 1, overflow: TextOverflow.ellipsis)
          : const Text("Can't be opened in the app yet"),
      trailing: note.isExpired
          ? const Chip(label: Text('Expired'), visualDensity: VisualDensity.compact)
          : note.isLink
              ? IconButton(
                  icon: const Icon(Icons.copy, size: 20),
                  tooltip: 'Copy link',
                  onPressed: () => _copyLink(context),
                )
              : null,
    );
  }
}

/// docs/07 roadmap Phase 5 step 1 "Assignments" — a class-scoped list + create action here,
/// matching the Fees/Notes precedent of a section on an existing detail screen rather than a new
/// tab. Reviewing submissions opens AssignmentReviewScreen.
class _AssignmentsSection extends ConsumerWidget {
  const _AssignmentsSection({required this.classId});

  final String classId;

  Future<void> _addAssignment(BuildContext context, WidgetRef ref) async {
    final created = await showDialog<bool>(
      context: context,
      builder: (_) => CreateAssignmentDialog(classId: classId),
    );
    if (created == true) {
      ref.invalidate(classAssignmentsProvider(classId));
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final assignmentsAsync = ref.watch(classAssignmentsProvider(classId));

    return _Section(
      title: 'Assignments',
      trailing: TextButton.icon(
        onPressed: () => _addAssignment(context, ref),
        icon: const Icon(Icons.add, size: 18),
        label: const Text('New'),
      ),
      child: assignmentsAsync.when(
        loading: () => const LoadingView(),
        error: (error, stackTrace) => const Text('Could not load assignments.'),
        data: (result) => result.fold(
          (failure) => Text(failure.message),
          (assignments) => assignments.isEmpty
              ? const EmptyState(message: 'No assignments yet.')
              : Column(children: [for (final a in assignments) _AssignmentTile(assignment: a)]),
        ),
      ),
    );
  }
}

class _AssignmentTile extends StatelessWidget {
  const _AssignmentTile({required this.assignment});

  final AssignmentSummary assignment;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: Icon(
        assignment.isPastDue ? Icons.assignment_late_outlined : Icons.assignment_outlined,
      ),
      title: Text(assignment.title),
      subtitle: Text('Due ${assignment.dueAt.toLocal().toString().substring(0, 10)}'),
      trailing: const Icon(Icons.chevron_right),
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => AssignmentReviewScreen(assignmentId: assignment.id, title: assignment.title),
        ),
      ),
    );
  }
}
