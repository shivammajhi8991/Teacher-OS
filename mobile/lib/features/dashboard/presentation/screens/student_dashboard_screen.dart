import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../assignments/presentation/screens/student_assignments_screen.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../../calendar/presentation/widgets/calendar_quick_action_card.dart';
import '../widgets/role_dashboard_scaffold.dart';

/// docs/08 §8.1 Student shell, §8.2 Student screen inventory.
class StudentDashboardScreen extends ConsumerWidget {
  const StudentDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return RoleDashboardScaffold(
      greeting: 'Dashboard',
      onLogout: () => ref.read(authNotifierProvider.notifier).logout(),
      tabs: const [
        (icon: Icons.dashboard_outlined, label: 'Dashboard'),
        (icon: Icons.class_outlined, label: 'Classes'),
        (icon: Icons.assignment_outlined, label: 'Assignments'),
        (icon: Icons.folder_outlined, label: 'Notes'),
        (icon: Icons.person_outline, label: 'Profile'),
      ],
      tabBuilders: {
        2: (context) => const StudentAssignmentsScreen(), // docs/07 Phase 5 step 1
      },
      dashboardExtra: const CalendarQuickActionCard(), // docs/07 Phase 5 step 6
      summaryTiles: const [
        (label: 'Attendance %', value: '—', icon: Icons.fact_check_outlined),
        (label: 'Assignments due', value: '0', icon: Icons.assignment_late_outlined),
        (label: 'Fee status', value: '—', icon: Icons.payments_outlined),
        (label: 'Classes this week', value: '0', icon: Icons.event_outlined),
      ],
    );
  }
}
