import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/error/failure.dart';
import '../../../../core/widgets/empty_state.dart';
import '../../../../core/widgets/error_view.dart';
import '../../../../core/widgets/loading_view.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../../auth/presentation/providers/auth_state.dart';
import '../../domain/entities/student.dart';
import '../providers/students_providers.dart';
import 'student_detail_screen.dart';
import 'student_form_screen.dart';
import 'student_import_screen.dart';

/// docs/08 §8.2 "Student list" — search + status filter chips, sorted by name; overdue-first
/// sorting is a Fees-module concern (docs/08 §8.4), not this screen's. Shared by the Teacher
/// dashboard's Students tab and (now) Institute Admin's — `GET /students` already scopes both
/// roles correctly server-side (own students vs. the whole institute), matching how every other
/// "one screen, the backend decides scope" pattern in this app already works.
///
/// Add/Invite/Import are hidden for anyone who isn't a teacher, not just de-emphasized: all
/// three ultimately call `StudentsService.create` (Invite and CSV import use it per-invite/
/// per-row too), which has its own real, pre-existing gate —
/// `TEACHER_PROFILE_REQUIRED` when the caller has no teacher profile, which every institute_admin
/// account genuinely doesn't — tracked on the backend as its own TODO ("an institute_admin adding
/// a student on behalf of one of their teachers needs its own path once institute-scoped teacher
/// lookup exists"), not something to build as a side effect of wiring up this tab. Everything
/// else here — view, search, filter, and (via Student Detail) edit/archive/guardians for an
/// *existing* student — already works for institute_admin today (`assertWriteAccess` explicitly
/// permits it), so only the three creation-shaped actions are gated, not the whole screen.
class StudentListScreen extends ConsumerStatefulWidget {
  const StudentListScreen({super.key});

  @override
  ConsumerState<StudentListScreen> createState() => _StudentListScreenState();
}

class _StudentListScreenState extends ConsumerState<StudentListScreen> {
  final _searchController = TextEditingController();

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _openAddStudent() async {
    final created = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => const StudentFormScreen()),
    );
    if (created == true) ref.invalidate(studentListProvider);
  }

  Future<void> _openImport() async {
    final imported = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => const StudentImportScreen()),
    );
    if (imported == true) ref.invalidate(studentListProvider);
  }

  Future<void> _showInviteDialog() async {
    final result = await ref.read(createInviteUseCaseProvider).call(expiresInDays: 30);
    if (!mounted) return;
    result.fold(
      (failure) => ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(failure.message))),
      (invite) => showDialog<void>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Invite code'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Share this code with the student: ', style: Theme.of(context).textTheme.bodyMedium),
              const SizedBox(height: 8),
              SelectableText(invite.code, style: Theme.of(context).textTheme.headlineSmall),
              const SizedBox(height: 8),
              Text(
                'Valid for 30 days. Redemption inside the app is coming in a later update — '
                'for now, share the code and add the student manually once they reach out.',
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Done')),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final studentsAsync = ref.watch(studentListProvider);
    final filter = ref.watch(studentListFilterProvider);
    final authState = ref.watch(authNotifierProvider);
    final canCreateStudents =
        authState is AuthAuthenticated && authState.user.activeRole == 'teacher';

    return Scaffold(
      appBar: AppBar(
        title: const Text('Students'),
        actions: canCreateStudents
            ? [
                IconButton(
                  icon: const Icon(Icons.upload_file_outlined),
                  tooltip: 'Import CSV',
                  onPressed: _openImport,
                ),
                IconButton(
                  icon: const Icon(Icons.person_add_alt_outlined),
                  tooltip: 'Invite student',
                  onPressed: _showInviteDialog,
                ),
              ]
            : null,
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
            child: TextField(
              controller: _searchController,
              decoration: const InputDecoration(
                prefixIcon: Icon(Icons.search),
                hintText: 'Search students',
                isDense: true,
              ),
              onSubmitted: (value) => ref
                  .read(studentListFilterProvider.notifier)
                  .update((f) => f.copyWith(q: value.trim())),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  _StatusChip(label: 'All', selected: filter.status == null, onSelected: () {
                    ref.read(studentListFilterProvider.notifier).update((f) => f.copyWith(clearStatus: true));
                  }),
                  const SizedBox(width: 8),
                  for (final status in const ['active', 'inactive', 'left', 'archived'])
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: _StatusChip(
                        label: status[0].toUpperCase() + status.substring(1),
                        selected: filter.status == status,
                        onSelected: () => ref
                            .read(studentListFilterProvider.notifier)
                            .update((f) => f.copyWith(status: status)),
                      ),
                    ),
                ],
              ),
            ),
          ),
          Expanded(
            child: studentsAsync.when(
              loading: () => const LoadingView(),
              error: (error, stackTrace) => ErrorView(
                failure: UnexpectedFailure(message: error.toString()),
                onRetry: () => ref.invalidate(studentListProvider),
              ),
              data: (result) => result.fold(
                (failure) => ErrorView(failure: failure, onRetry: () => ref.invalidate(studentListProvider)),
                (students) => students.isEmpty
                    ? EmptyState(
                        message: canCreateStudents
                            ? 'No students yet — add your first student to get started.'
                            : 'No students yet.',
                        actionLabel: canCreateStudents ? 'Add Student' : null,
                        onAction: canCreateStudents ? _openAddStudent : null,
                      )
                    : RefreshIndicator(
                        onRefresh: () async => ref.invalidate(studentListProvider),
                        child: ListView.separated(
                          itemCount: students.length,
                          separatorBuilder: (_, __) => const Divider(height: 1),
                          itemBuilder: (context, index) => _StudentTile(student: students[index]),
                        ),
                      ),
              ),
            ),
          ),
        ],
      ),
      floatingActionButton: canCreateStudents
          ? FloatingActionButton(
              onPressed: _openAddStudent,
              child: const Icon(Icons.add),
            )
          : null,
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.label, required this.selected, required this.onSelected});

  final String label;
  final bool selected;
  final VoidCallback onSelected;

  @override
  Widget build(BuildContext context) {
    return ChoiceChip(label: Text(label), selected: selected, onSelected: (_) => onSelected());
  }
}

class _StudentTile extends StatelessWidget {
  const _StudentTile({required this.student});

  final Student student;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: CircleAvatar(child: Text(student.fullName.isNotEmpty ? student.fullName[0] : '?')),
      title: Text(student.fullName),
      subtitle: Text('Joined ${student.joinDate}'),
      trailing: _StatusBadge(status: student.enrollmentStatus),
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => StudentDetailScreen(studentId: student.id)),
      ),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final color = switch (status) {
      'active' => Colors.green.shade600,
      'inactive' => Colors.orange.shade700,
      'left' => colorScheme.onSurfaceVariant,
      'archived' => colorScheme.error,
      _ => colorScheme.onSurfaceVariant,
    };
    return Chip(
      label: Text(status, style: TextStyle(color: color, fontSize: 12)),
      backgroundColor: color.withValues(alpha: 0.1),
      side: BorderSide.none,
      visualDensity: VisualDensity.compact,
    );
  }
}
