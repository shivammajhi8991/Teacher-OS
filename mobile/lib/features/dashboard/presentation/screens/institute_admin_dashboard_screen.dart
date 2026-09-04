import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../widgets/role_dashboard_scaffold.dart';

/// docs/08 §8.1 Institute Admin shell, §8.2 Institute Admin screen inventory.
class InstituteAdminDashboardScreen extends ConsumerWidget {
  const InstituteAdminDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return RoleDashboardScaffold(
      greeting: 'Dashboard',
      onLogout: () => ref.read(authNotifierProvider.notifier).logout(),
      tabs: const [
        (icon: Icons.dashboard_outlined, label: 'Dashboard'),
        (icon: Icons.school_outlined, label: 'Teachers'),
        (icon: Icons.people_outline, label: 'Students'),
        (icon: Icons.bar_chart_outlined, label: 'Reports'),
        (icon: Icons.settings_outlined, label: 'Settings'),
      ],
      summaryTiles: const [
        (label: 'Total teachers', value: '0', icon: Icons.school_outlined),
        (label: 'Total students', value: '0', icon: Icons.people_outline),
        (label: 'Attendance %', value: '—', icon: Icons.fact_check_outlined),
        (label: 'Pending fees', value: '₹0', icon: Icons.payments_outlined),
      ],
    );
  }
}
