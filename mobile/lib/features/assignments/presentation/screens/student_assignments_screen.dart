import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/error/failure.dart';
import '../../../../core/widgets/empty_state.dart';
import '../../../../core/widgets/error_view.dart';
import '../../../../core/widgets/loading_view.dart';
import '../../domain/entities/assignment_summary.dart';
import '../providers/assignments_providers.dart';
import 'assignment_submit_screen.dart';

/// docs/08 §8.2 Student "Assignments list | Open/submitted/reviewed, deadline countdown" —
/// wired into the Student dashboard's Assignments tab (student_dashboard_screen.dart), which
/// previously showed "coming soon". `GET /assignments` scopes to the caller automatically (own
/// direct-target assignments + assignments for classes they're actively enrolled in), so this
/// screen passes no filter at all.
class StudentAssignmentsScreen extends ConsumerWidget {
  const StudentAssignmentsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final assignmentsAsync = ref.watch(myAssignmentsProvider);

    // Matches ClassListScreen/StudentListScreen's own-Scaffold-as-tab-content convention
    // (role_dashboard_scaffold.dart renders a tabBuilder's widget directly as its body).
    return Scaffold(
      appBar: AppBar(title: const Text('Assignments')),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(myAssignmentsProvider),
        child: assignmentsAsync.when(
          loading: () => const LoadingView(),
          error: (error, stackTrace) => ErrorView(
            failure: UnexpectedFailure(message: error.toString()),
            onRetry: () => ref.invalidate(myAssignmentsProvider),
          ),
          data: (result) => result.fold(
            (failure) => ErrorView(failure: failure, onRetry: () => ref.invalidate(myAssignmentsProvider)),
            (assignments) => assignments.isEmpty
                ? ListView(
                    children: const [
                      SizedBox(height: 80),
                      EmptyState(icon: Icons.assignment_outlined, message: 'No assignments yet.'),
                    ],
                  )
                : ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: assignments.length,
                    separatorBuilder: (_, __) => const Divider(),
                    itemBuilder: (context, index) => _AssignmentTile(assignment: assignments[index]),
                  ),
          ),
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
      leading: Icon(
        assignment.isPastDue ? Icons.assignment_late_outlined : Icons.assignment_outlined,
        color: assignment.isPastDue ? Theme.of(context).colorScheme.error : null,
      ),
      title: Text(assignment.title),
      subtitle: Text('Due ${assignment.dueAt.toLocal().toString().substring(0, 16)}'),
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => AssignmentSubmitScreen(assignmentId: assignment.id)),
      ),
    );
  }
}
