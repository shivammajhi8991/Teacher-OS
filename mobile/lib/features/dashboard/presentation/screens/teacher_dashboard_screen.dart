import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../../students/presentation/screens/student_list_screen.dart';
import '../widgets/role_dashboard_scaffold.dart';

/// docs/08 §8.1 Teacher shell, §8.2 Teacher screen inventory, §8.7 layout regions.
class TeacherDashboardScreen extends ConsumerWidget {
  const TeacherDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return RoleDashboardScaffold(
      greeting: 'Dashboard',
      onLogout: () => ref.read(authNotifierProvider.notifier).logout(),
      tabs: const [
        (icon: Icons.dashboard_outlined, label: 'Dashboard'),
        (icon: Icons.class_outlined, label: 'Classes'),
        (icon: Icons.people_outline, label: 'Students'),
        (icon: Icons.payments_outlined, label: 'Fees'),
        (icon: Icons.more_horiz, label: 'More'),
      ],
      tabBuilders: {2: (context) => const StudentListScreen()}, // docs/07 Phase 4 step 3
      summaryTiles: const [
        (label: 'Total students', value: '0', icon: Icons.people_outline),
        (label: 'Pending fees', value: '₹0', icon: Icons.payments_outlined),
        (label: 'Attendance %', value: '—', icon: Icons.fact_check_outlined),
        (label: 'Pending assignments', value: '0', icon: Icons.assignment_outlined),
      ],
    );
  }
}
