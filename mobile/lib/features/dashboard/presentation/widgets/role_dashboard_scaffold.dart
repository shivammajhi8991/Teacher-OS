import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/sync/sync_engine.dart';
import '../../../../core/theme/modernist.dart';
import '../../../../core/widgets/empty_state.dart';
import '../../../../core/widgets/modernist_primitives.dart';
import '../../../../core/widgets/sync_status_chip.dart' as chip;
import '../../../notifications/presentation/providers/notifications_providers.dart';
import '../../../notifications/presentation/screens/notification_center_screen.dart';

/// docs/08 §8.7 — the shared region layout every role's dashboard reuses, redesigned.
///
/// The original API is intact: [greeting], [tabs], [summaryTiles], [onLogout], [tabBuilders],
/// [appBarBottom] and [dashboardExtra] all keep their types and meanings, so the Student,
/// Parent and Institute Admin dashboards compile against this file unchanged. Three optional
/// parameters are new ([dateKicker], [nextUp], [attention]) and every role that passes none
/// gets the old region order, minus the cards.
///
/// What changed, and why (see the handoff README for the audit this came from):
///  * **No cards.** Sections are separated by 2px rules and one filled band; nothing floats.
///  * **The day comes first.** [nextUp] puts the next class and its one action at the top,
///    where four dead summary tiles used to be. A dashboard should start a task.
///  * **[attention] replaces the tile grid as the second region** — only things that need the
///    user: money late, a session never marked, a schedule clash. Numbered, flush left.
///  * **[summaryTiles] survives, demoted.** It renders as one ruled modular grid at the foot
///    of the screen (three cells per row) rather than four floating tiles at the top: standing
///    totals are reference, not the reason the app was opened.
///  * **The bottom bar is [MBottomBar]** — flush-left labels, a 3px accent marker on the
///    active destination. `tabs[].icon` is still accepted so callers need no edit, but it is
///    deliberately not drawn: at four destinations the words are clearer than the glyphs.
class RoleDashboardScaffold extends ConsumerStatefulWidget {
  const RoleDashboardScaffold({
    super.key,
    required this.greeting,
    required this.tabs,
    required this.summaryTiles,
    this.onLogout,
    this.tabBuilders = const {},
    this.appBarBottom,
    this.dashboardExtra,
    this.dateKicker,
    this.nextUp,
    this.attention = const [],
  });

  final String greeting;
  final List<({IconData icon, String label})> tabs;
  final List<({String label, String value, IconData icon})> summaryTiles;
  final VoidCallback? onLogout;
  final Map<int, WidgetBuilder> tabBuilders;

  /// Rendered under the header on every tab — e.g. the Parent dashboard's child switcher.
  final PreferredSizeWidget? appBarBottom;

  /// An optional extra section on the Dashboard tab, after [attention].
  final Widget? dashboardExtra;

  /// Small all-caps line above the title, e.g. "TUESDAY 8 SEPTEMBER". Defaults to today.
  final String? dateKicker;

  /// The one thing the user is about to do. Rendered as the filled band with the screen's
  /// single primary action. Null renders no band.
  final ({String kicker, String title, String meta, String ctaLabel, VoidCallback onCta})? nextUp;

  /// Exceptions that need the user, in priority order. Empty renders no section.
  final List<({String kicker, String title, String sub, bool urgent, VoidCallback? onTap})>
      attention;

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

  static String _today() {
    final d = DateTime.now();
    const dows = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    return '${dows[d.weekday - 1]} ${d.day} ${months[d.month - 1]}';
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final syncState = ref.watch(syncEngineProvider);
    final unreadCountAsync = ref.watch(unreadNotificationCountProvider);
    final unreadCount = unreadCountAsync.maybeWhen(data: (count) => count, orElse: () => 0);

    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(M.gutter, M.s2, M.s3, M.s4),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          (widget.dateKicker ?? _today()).toUpperCase(),
                          style: M.kicker.copyWith(color: scheme.onSurfaceVariant),
                        ),
                        const SizedBox(height: M.s2),
                        Text(widget.greeting, style: M.screenTitle),
                      ],
                    ),
                  ),
                  chip.SyncStatusChip(
                    status: _mapSyncStatus(syncState.status),
                    count: syncState.pendingCount,
                  ),
                  const SizedBox(width: M.s1),
                  _HeaderIcon(
                    icon: Icons.notifications_none,
                    tooltip: 'Notifications',
                    badge: unreadCount > 0,
                    onPressed: () async {
                      await Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => const NotificationCenterScreen()),
                      );
                      if (!mounted) return;
                      ref.invalidate(unreadNotificationCountProvider);
                    },
                  ),
                  if (widget.onLogout != null) ...[
                    const SizedBox(width: M.s1),
                    _HeaderIcon(
                      icon: Icons.logout,
                      tooltip: 'Log out',
                      onPressed: widget.onLogout!,
                    ),
                  ],
                ],
              ),
            ),
            if (widget.appBarBottom != null) widget.appBarBottom!,
            Expanded(
              child: _selectedTab == 0
                  ? _DashboardTabContent(
                      summaryTiles: widget.summaryTiles,
                      extra: widget.dashboardExtra,
                      nextUp: widget.nextUp,
                      attention: widget.attention,
                    )
                  : (widget.tabBuilders[_selectedTab]?.call(context) ??
                      _ComingSoonTab(label: widget.tabs[_selectedTab].label)),
            ),
          ],
        ),
      ),
      bottomNavigationBar: MBottomBar(
        labels: [for (final tab in widget.tabs) tab.label],
        selectedIndex: _selectedTab,
        onSelected: (index) => setState(() => _selectedTab = index),
      ),
    );
  }
}

class _DashboardTabContent extends ConsumerWidget {
  const _DashboardTabContent({
    required this.summaryTiles,
    required this.attention,
    this.extra,
    this.nextUp,
  });

  final List<({String label, String value, IconData icon})> summaryTiles;
  final List<({String kicker, String title, String sub, bool urgent, VoidCallback? onTap})>
      attention;
  final Widget? extra;
  final ({String kicker, String title, String meta, String ctaLabel, VoidCallback onCta})? nextUp;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final scheme = Theme.of(context).colorScheme;

    return RefreshIndicator(
      onRefresh: () async => ref.invalidate(notificationsListProvider),
      child: ListView(
        padding: EdgeInsets.zero,
        children: [
          if (nextUp != null) ...[
            const MRule(),
            Container(
              color: scheme.surfaceContainerLow,
              padding: const EdgeInsets.fromLTRB(M.gutter, M.s4, M.gutter, M.s6),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Expanded(
                        child: Text(
                          nextUp!.kicker.toUpperCase(),
                          style: M.kicker.copyWith(
                            letterSpacing: 1.32,
                            color: scheme.onSurfaceVariant,
                          ),
                        ),
                      ),
                      Text(nextUp!.meta, style: M.dataSmall.copyWith(fontSize: 15)),
                    ],
                  ),
                  const SizedBox(height: M.s3),
                  Text(nextUp!.title, style: M.sectionTitle),
                  const SizedBox(height: M.s4),
                  MPrimaryAction(label: nextUp!.ctaLabel, onPressed: nextUp!.onCta),
                ],
              ),
            ),
          ],
          if (attention.isNotEmpty) ...[
            const MRule(),
            MSectionLabel('Needs you · ${attention.length}', accent: true),
            for (final (i, item) in attention.indexed) ...[
              if (i > 0) const MRowRule(),
              InkWell(
                onTap: item.onTap,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(M.gutter, 14, M.gutter, 14),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      SizedBox(
                        width: 24,
                        child: Text('${i + 1}', style: M.dataSmall.copyWith(
                          fontSize: 22, color: M.inkGhost,
                        )),
                      ),
                      const SizedBox(width: M.s2),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              item.kicker.toUpperCase(),
                              style: M.kicker.copyWith(
                                fontSize: 10.5,
                                letterSpacing: 1.05,
                                color: item.urgent ? M.accent : scheme.onSurfaceVariant,
                              ),
                            ),
                            const SizedBox(height: 5),
                            Text(item.title, style: M.body.copyWith(fontSize: 15.5)),
                            if (item.sub.isNotEmpty) ...[
                              const SizedBox(height: 3),
                              Text(
                                item.sub,
                                style: M.meta.copyWith(color: scheme.onSurfaceVariant),
                              ),
                            ],
                          ],
                        ),
                      ),
                      if (item.onTap != null)
                        Text('→', style: M.actionLabel.copyWith(fontSize: 18, color: M.inkGhost)),
                    ],
                  ),
                ),
              ),
            ],
            const MRowRule(),
          ],
          if (extra != null) ...[const MRule(), extra!],
          const MRule(),
          const _RecentActivitySection(),
          if (summaryTiles.isNotEmpty) ...[
            const MRule(),
            MStatCells(
              cells: [
                for (final tile in summaryTiles)
                  (label: tile.label, value: tile.value, tone: null),
              ],
            ),
          ],
          const SizedBox(height: M.s6),
        ],
      ),
    );
  }
}

/// docs/08 §8.7: "Recent activity / notifications feed — last 5, 'see all' → notif center."
class _RecentActivitySection extends ConsumerWidget {
  const _RecentActivitySection();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final scheme = Theme.of(context).colorScheme;
    final notificationsAsync = ref.watch(notificationsListProvider);

    Widget empty() => Padding(
          padding: const EdgeInsets.fromLTRB(M.gutter, 0, M.gutter, M.s4),
          child: Text(
            'Nothing new yet.',
            style: M.meta.copyWith(color: scheme.onSurfaceVariant),
          ),
        );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        MSectionLabel(
          'Recent activity',
          trailing: TextButton(
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const NotificationCenterScreen()),
            ),
            child: const Text('SEE ALL'),
          ),
        ),
        notificationsAsync.when(
          loading: () => const Padding(
            padding: EdgeInsets.symmetric(horizontal: M.gutter, vertical: M.s2),
            child: LinearProgressIndicator(),
          ),
          error: (_, __) => empty(),
          data: (result) => result.fold(
            (_) => empty(),
            (notifications) => notifications.isEmpty
                ? empty()
                : Column(
                    children: [
                      for (final (i, n) in notifications.take(5).indexed) ...[
                        if (i > 0) const MRowRule(),
                        MRow(
                          title: n.title,
                          sub: n.body,
                          trailing: n.isRead ? null : Container(width: 8, height: 8, color: M.accent),
                        ),
                      ],
                    ],
                  ),
          ),
        ),
      ],
    );
  }
}

class _HeaderIcon extends StatelessWidget {
  const _HeaderIcon({
    required this.icon,
    required this.onPressed,
    this.tooltip,
    this.badge = false,
  });

  final IconData icon;
  final VoidCallback onPressed;
  final String? tooltip;
  final bool badge;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Tooltip(
      message: tooltip ?? '',
      child: InkWell(
        onTap: onPressed,
        child: Container(
          width: M.tapMin,
          height: M.tapMin,
          decoration: BoxDecoration(border: Border.all(color: scheme.outline)),
          child: Stack(
            children: [
              Center(child: Icon(icon, size: 20, color: scheme.onSurface)),
              if (badge)
                const Positioned(
                  top: -1,
                  right: -1,
                  child: SizedBox(
                    width: 8,
                    height: 8,
                    child: ColoredBox(color: M.accent),
                  ),
                ),
            ],
          ),
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
