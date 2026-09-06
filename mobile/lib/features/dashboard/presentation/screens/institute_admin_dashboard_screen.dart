import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../announcements/presentation/screens/announcements_list_screen.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../../auth/presentation/providers/auth_state.dart';
import '../../../institutes/presentation/screens/teacher_roster_screen.dart';
import '../widgets/role_dashboard_scaffold.dart';

/// docs/08 §8.1 Institute Admin shell, §8.2 Institute Admin screen inventory.
class InstituteAdminDashboardScreen extends ConsumerWidget {
  const InstituteAdminDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authNotifierProvider);
    final instituteId = authState is AuthAuthenticated ? authState.user.instituteId : null;

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
      tabBuilders: {
        // docs/07 Phase 5 step 4. No institute on this account yet (shouldn't happen for a real
        // institute_admin, but the type is nullable) falls back to the scaffold's own "coming
        // soon" rather than crashing on a null instituteId.
        if (instituteId != null) 1: (context) => TeacherRosterScreen(instituteId: instituteId),
      },
      dashboardExtra: instituteId == null
          ? null
          : _AnnouncementsQuickAction(instituteId: instituteId),
      summaryTiles: const [
        (label: 'Total teachers', value: '0', icon: Icons.school_outlined),
        (label: 'Total students', value: '0', icon: Icons.people_outline),
        (label: 'Attendance %', value: '—', icon: Icons.fact_check_outlined),
        (label: 'Pending fees', value: '₹0', icon: Icons.payments_outlined),
      ],
    );
  }
}

/// docs/08 §8.2 Institute Admin "Announcements | Institute-wide broadcast | Dashboard quick
/// action."
class _AnnouncementsQuickAction extends StatelessWidget {
  const _AnnouncementsQuickAction({required this.instituteId});

  final String instituteId;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        leading: const Icon(Icons.campaign_outlined),
        title: const Text('Announcements'),
        subtitle: const Text('Send an institute-wide broadcast'),
        trailing: const Icon(Icons.chevron_right),
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => const AnnouncementsListScreen(composeTargetType: 'institute'),
          ),
        ),
      ),
    );
  }
}
