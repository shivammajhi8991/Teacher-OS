import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/sync/sync_engine.dart';
import '../../../../core/widgets/empty_state.dart';
import '../../../../core/widgets/sync_status_chip.dart' as chip;
import '../../../notifications/presentation/providers/notifications_providers.dart';
import '../../../notifications/presentation/screens/notification_center_screen.dart';

/// docs/08 §8.7 — the shared region layout (alert zone → today's-classes → summary tiles →
/// recent activity → bottom nav) every role's dashboard reuses, so the four dashboards stay
/// visually consistent for a user holding multiple roles (docs/06 §6.1).
///
/// The "Dashboard" tab (index 0) is always wired up. Other tabs render a "coming soon" empty
/// state (docs/08 §8.1) unless the caller supplies a builder for that index in [tabBuilders] —
/// e.g. the Teacher dashboard passes one for the Students tab now that that feature exists.
class RoleDashboardScaffold extends ConsumerStatefulWidget {
  const RoleDashboardScaffold({
    super.key,
    required this.greeting,
    required this.tabs,
    required this.summaryTiles,
    this.onLogout,
    this.tabBuilders = const {},
  });

  final String greeting;
  final List<({IconData icon, String label})> tabs;
  final List<({String label, String value, IconData icon})> summaryTiles;
  final VoidCallback? onLogout;
  final Map<int, WidgetBuilder> tabBuilders;

  @override
  ConsumerState<RoleDashboardScaffold> createState() => _RoleDashboardScaffoldState();
}

class _RoleDashboardScaffoldState extends ConsumerState<RoleDashboardScaffold> {
  int _selectedTab = 0;

  chip.SyncStatus _mapSyncStatus(SyncEngineStatus status) => switch (status) {
        SyncEngineStatus.synced => chip.SyncStatus.synced,
        SyncEngineStatus.syncing => chip.SyncStatus.syncing,
        SyncEngineStatus.pending => chip.SyncStatus.pending,
        SyncEngineStatus.error => chip.SyncStatus.conflict,
      };

  @override
  Widget build(BuildContext context) {
    final syncState = ref.watch(syncEngineProvider);
    final unreadCountAsync = ref.watch(unreadNotificationCountProvider);
    final unreadCount = unreadCountAsync.maybeWhen(data: (count) => count, orElse: () => 0);

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.greeting),
        actions: [
          chip.SyncStatusChip(
            status: _mapSyncStatus(syncState.status),
            count: syncState.pendingCount,
          ),
          const SizedBox(width: 8),
          IconButton(
            icon: Badge(
              isLabelVisible: unreadCount > 0,
              label: Text('$unreadCount'),
              child: const Icon(Icons.notifications_outlined),
            ),
            tooltip: 'Notifications',
            onPressed: () async {
              await Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const NotificationCenterScreen()),
              );
              if (!mounted) return;
              ref.invalidate(unreadNotificationCountProvider);
            },
          ),
          if (widget.onLogout != null)
            IconButton(
              icon: const Icon(Icons.logout),
              tooltip: 'Log out',
              onPressed: widget.onLogout,
            ),
        ],
      ),
      body: _selectedTab == 0
          ? _DashboardTabContent(summaryTiles: widget.summaryTiles)
          : (widget.tabBuilders[_selectedTab]?.call(context) ??
              _ComingSoonTab(label: widget.tabs[_selectedTab].label)),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _selectedTab,
        onDestinationSelected: (index) => setState(() => _selectedTab = index),
        destinations: [
          for (final tab in widget.tabs)
            NavigationDestination(icon: Icon(tab.icon), label: tab.label),
        ],
      ),
    );
  }
}

class _DashboardTabContent extends ConsumerWidget {
  const _DashboardTabContent({required this.summaryTiles});

  final List<({String label, String value, IconData icon})> summaryTiles;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return RefreshIndicator(
      // "Today's classes" and the summary tiles are still static (wired once each feature's own
      // dashboard-summary endpoint lands) — Recent activity is real, backed by
      // notificationsListProvider.
      onRefresh: () async => ref.invalidate(notificationsListProvider),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text("Today's classes", style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 8),
                  const EmptyState(
                    icon: Icons.event_available_outlined,
                    message: 'No classes today.',
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 12,
            crossAxisSpacing: 12,
            childAspectRatio: 1.6,
            children: [for (final tile in summaryTiles) _SummaryTile(tile: tile)],
          ),
          const SizedBox(height: 16),
          const _RecentActivityCard(),
        ],
      ),
    );
  }
}

/// docs/08 §8.7 layout diagram: "Recent activity / notifications feed │ ← last 5, 'see all' →
/// notif center."
class _RecentActivityCard extends ConsumerWidget {
  const _RecentActivityCard();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notificationsAsync = ref.watch(notificationsListProvider);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Recent activity', style: Theme.of(context).textTheme.titleMedium),
                TextButton(
                  onPressed: () => Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const NotificationCenterScreen()),
                  ),
                  child: const Text('See all'),
                ),
              ],
            ),
            notificationsAsync.when(
              loading: () => const Padding(
                padding: EdgeInsets.symmetric(vertical: 8),
                child: LinearProgressIndicator(),
              ),
              error: (_, __) => const EmptyState(icon: Icons.notifications_none, message: 'Nothing new yet.'),
              data: (result) => result.fold(
                (_) => const EmptyState(icon: Icons.notifications_none, message: 'Nothing new yet.'),
                (notifications) => notifications.isEmpty
                    ? const EmptyState(icon: Icons.notifications_none, message: 'Nothing new yet.')
                    : Column(
                        children: [
                          for (final n in notifications.take(5))
                            ListTile(
                              contentPadding: EdgeInsets.zero,
                              dense: true,
                              leading: Icon(
                                n.isRead ? Icons.notifications_none : Icons.notifications_active_outlined,
                              ),
                              title: Text(
                                n.title,
                                style: TextStyle(fontWeight: n.isRead ? FontWeight.normal : FontWeight.bold),
                              ),
                              subtitle: Text(n.body, maxLines: 1, overflow: TextOverflow.ellipsis),
                            ),
                        ],
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SummaryTile extends StatelessWidget {
  const _SummaryTile({required this.tile});

  final ({String label, String value, IconData icon}) tile;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(tile.icon, color: colorScheme.primary),
            const Spacer(),
            Text(tile.value, style: Theme.of(context).textTheme.headlineSmall),
            Text(
              tile.label,
              style: Theme.of(context).textTheme.bodySmall,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
}

class _ComingSoonTab extends StatelessWidget {
  const _ComingSoonTab({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return EmptyState(icon: Icons.construction_outlined, message: '$label — coming soon');
  }
}
