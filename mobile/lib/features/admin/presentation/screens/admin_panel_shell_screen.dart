import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/widgets/empty_state.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import 'admin_institutes_screen.dart';
import 'admin_teacher_categories_screen.dart';
import 'admin_users_screen.dart';
import 'admin_verification_queue_screen.dart';

/// docs/02 §2.8 "Admin web panel ... sharing the mobile app's domain/data layer (same Riverpod
/// providers, same API client)... Presentation layer (widgets/routes) is separate from mobile's."
/// This shell is that separate presentation layer: a `NavigationRail` side-nav (the standard
/// web/desktop pattern) rather than mobile's bottom `NavigationBar`/`RoleDashboardScaffold` — the
/// four screens it hosts (`AdminUsersScreen` etc.) reuse the exact same repositories/providers
/// every other feature does, nothing about the *data* layer is web-specific.
///
/// Actually running this as a distinct Flutter Web build target needs `flutter create
/// --platforms web .` to generate the `web/` platform scaffolding — that needs the Flutter SDK,
/// not available in this environment (the same honest limitation this whole app has been built
/// under). This shell is the presentation-layer source that target would serve; today it's simply
/// the route a super_admin's mobile session lands on.
///
/// docs/08 §8.2's full Admin Web Panel list has seven screens; four have real backend support
/// this pass (Users, Institutes, Teacher categories, Verification queue). The remaining three —
/// Reported content, System config, Audit log viewer — have no backing data model anywhere in
/// this codebase (no flagging mechanism, no system-config table, and `audit_logs` was never
/// actually built beyond seeding its own `audit_log.read` permission back in Phase 4 step 1) and
/// are not invented here; they show as real nav destinations with an honest "coming soon" rather
/// than being silently hidden, so the gap stays visible instead of vanishing.
class AdminPanelShellScreen extends ConsumerStatefulWidget {
  const AdminPanelShellScreen({super.key});

  @override
  ConsumerState<AdminPanelShellScreen> createState() => _AdminPanelShellScreenState();
}

enum _AdminDestination {
  users('Users', Icons.people_outline, AdminUsersScreen()),
  institutes('Institutes', Icons.apartment_outlined, AdminInstitutesScreen()),
  teacherCategories('Teacher categories', Icons.category_outlined, AdminTeacherCategoriesScreen()),
  verificationQueue('Verification queue', Icons.verified_outlined, AdminVerificationQueueScreen()),
  reportedContent('Reported content', Icons.flag_outlined, null),
  systemConfig('System config', Icons.tune, null),
  auditLog('Audit log', Icons.history, null);

  const _AdminDestination(this.label, this.icon, this.screen);

  final String label;
  final IconData icon;
  final Widget? screen;
}

class _AdminPanelShellScreenState extends ConsumerState<AdminPanelShellScreen> {
  int _selected = 0;

  @override
  Widget build(BuildContext context) {
    final destination = _AdminDestination.values[_selected];
    return Scaffold(
      body: Row(
        children: [
          NavigationRail(
            extended: MediaQuery.of(context).size.width > 900,
            selectedIndex: _selected,
            onDestinationSelected: (index) => setState(() => _selected = index),
            leading: Column(
              children: [
                const SizedBox(height: 12),
                const Icon(Icons.admin_panel_settings_outlined, size: 32),
                const SizedBox(height: 12),
                IconButton(
                  icon: const Icon(Icons.logout),
                  tooltip: 'Log out',
                  onPressed: () => ref.read(authNotifierProvider.notifier).logout(),
                ),
                const SizedBox(height: 8),
              ],
            ),
            destinations: [
              for (final d in _AdminDestination.values)
                NavigationRailDestination(icon: Icon(d.icon), label: Text(d.label)),
            ],
          ),
          const VerticalDivider(width: 1),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Text(destination.label, style: Theme.of(context).textTheme.headlineSmall),
                ),
                const Divider(height: 1),
                Expanded(
                  child: destination.screen ??
                      EmptyState(icon: destination.icon, message: '${destination.label} — coming soon'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
