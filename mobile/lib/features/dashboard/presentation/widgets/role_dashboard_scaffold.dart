import 'package:flutter/material.dart';
import '../../../../core/widgets/empty_state.dart';
import '../../../../core/widgets/sync_status_chip.dart';

/// docs/08 §8.7 — the shared region layout (alert zone → today's-classes → summary tiles →
/// recent activity → bottom nav) every role's dashboard reuses, so the four dashboards stay
/// visually consistent for a user holding multiple roles (docs/06 §6.1).
///
/// The "Dashboard" tab (index 0) is always wired up. Other tabs render a "coming soon" empty
/// state (docs/08 §8.1) unless the caller supplies a builder for that index in [tabBuilders] —
/// e.g. the Teacher dashboard passes one for the Students tab now that that feature exists.
class RoleDashboardScaffold extends StatefulWidget {
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
  State<RoleDashboardScaffold> createState() => _RoleDashboardScaffoldState();
}

class _RoleDashboardScaffoldState extends State<RoleDashboardScaffold> {
  int _selectedTab = 0;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.greeting),
        actions: [
          const SyncStatusChip(status: SyncStatus.synced),
          const SizedBox(width: 8),
          IconButton(
            icon: const Icon(Icons.notifications_outlined),
            tooltip: 'Notifications',
            onPressed: () {},
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

class _DashboardTabContent extends StatelessWidget {
  const _DashboardTabContent({required this.summaryTiles});

  final List<({String label, String value, IconData icon})> summaryTiles;

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: () async {}, // wired once each feature's data layer lands
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
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Recent activity', style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 8),
                  const EmptyState(
                    icon: Icons.notifications_none,
                    message: 'Nothing new yet.',
                  ),
                ],
              ),
            ),
          ),
        ],
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
