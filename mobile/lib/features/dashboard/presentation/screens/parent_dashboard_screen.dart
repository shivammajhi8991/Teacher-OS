import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../widgets/role_dashboard_scaffold.dart';

/// docs/08 §8.1 Parent shell, §8.2 Parent screen inventory. The child-switcher (only shown for
/// >1 linked child, per docs/08 §8.1) lands with the students/guardian-links module (docs/07
/// Phase 4 step 3) — this pass renders a single-child layout.
class ParentDashboardScreen extends ConsumerWidget {
  const ParentDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return RoleDashboardScaffold(
      greeting: 'Dashboard',
      onLogout: () => ref.read(authNotifierProvider.notifier).logout(),
      tabs: const [
        (icon: Icons.dashboard_outlined, label: 'Dashboard'),
        (icon: Icons.payments_outlined, label: 'Fees'),
        (icon: Icons.campaign_outlined, label: 'Announcements'),
        (icon: Icons.person_outline, label: 'Profile'),
      ],
      summaryTiles: const [
        (label: "Child's attendance", value: '—', icon: Icons.fact_check_outlined),
        (label: 'Fee status', value: '—', icon: Icons.payments_outlined),
        (label: 'Upcoming classes', value: '0', icon: Icons.event_outlined),
        (label: 'Performance', value: '—', icon: Icons.insights_outlined),
      ],
    );
  }
}
