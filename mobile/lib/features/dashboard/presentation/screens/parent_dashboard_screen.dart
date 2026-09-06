import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../announcements/presentation/screens/announcements_list_screen.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../../attendance/presentation/providers/attendance_providers.dart';
import '../../../calendar/presentation/screens/calendar_screen.dart';
import '../../../fees/presentation/providers/fees_providers.dart';
import '../../../parent/presentation/providers/parent_providers.dart';
import '../../../parent/presentation/screens/child_attendance_screen.dart';
import '../../../parent/presentation/screens/child_performance_screen.dart';
import '../../../parent/presentation/screens/parent_fees_tab.dart';
import '../../../parent/presentation/widgets/child_switcher_bar.dart';
import '../../../performance/presentation/providers/performance_providers.dart';
import '../widgets/role_dashboard_scaffold.dart';

/// docs/08 §8.1 Parent shell, §8.2 Parent screen inventory. The child switcher (only shown for
/// >1 linked child) is now real, backed by `GET /students`' parent-role branch
/// (StudentsService.findAll) added alongside this screen.
class ParentDashboardScreen extends ConsumerWidget {
  const ParentDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final childrenAsync = ref.watch(linkedChildrenProvider);
    final selected = ref.watch(selectedChildIdProvider);

    return childrenAsync.when(
      loading: () => _shell(ref, summaryTiles: _placeholderTiles),
      error: (error, stackTrace) => _shell(ref, summaryTiles: _placeholderTiles),
      data: (result) => result.fold(
        (failure) => _shell(ref, summaryTiles: _placeholderTiles),
        (children) {
          final childId = effectiveChildId(children, selected);
          final childMatches = children.where((c) => c.id == childId);
          final childName = childMatches.isEmpty ? null : childMatches.first.fullName;

          return _shell(
            ref,
            appBarBottom: children.length > 1 && childId != null
                ? ChildSwitcherBar(children: children, selectedId: childId)
                : null,
            summaryTiles: childId == null
                ? _placeholderTiles
                : _ParentSummaryTiles(studentId: childId).build(ref),
            dashboardExtra: childId == null || childName == null
                ? null
                : _DetailLinks(studentId: childId, childName: childName),
          );
        },
      ),
    );
  }

  Widget _shell(
    WidgetRef ref, {
    PreferredSizeWidget? appBarBottom,
    required List<({String label, String value, IconData icon})> summaryTiles,
    Widget? dashboardExtra,
  }) {
    return RoleDashboardScaffold(
      greeting: 'Dashboard',
      onLogout: () => ref.read(authNotifierProvider.notifier).logout(),
      tabs: const [
        (icon: Icons.dashboard_outlined, label: 'Dashboard'),
        (icon: Icons.payments_outlined, label: 'Fees'),
        (icon: Icons.campaign_outlined, label: 'Announcements'),
        (icon: Icons.person_outline, label: 'Profile'),
      ],
      tabBuilders: {
        1: (context) => const ParentFeesTab(), // docs/07 Phase 5 step 3
        2: (context) => const AnnouncementsListScreen(), // docs/07 Phase 5 step 4 — read-only
      },
      appBarBottom: appBarBottom,
      dashboardExtra: dashboardExtra,
      summaryTiles: summaryTiles,
    );
  }
}

const _placeholderTiles = [
  (label: "Child's attendance", value: '—', icon: Icons.fact_check_outlined),
  (label: 'Fee status', value: '—', icon: Icons.payments_outlined),
  (label: 'Upcoming classes', value: '0', icon: Icons.event_outlined),
  (label: 'Performance', value: '—', icon: Icons.insights_outlined),
];

/// Computes real tile values for the selected child from three independent, already-built
/// endpoints (attendance history, invoices, performance records) — "Upcoming classes" stays
/// static; Calendar (Phase 5 step 6, below in `_DetailLinks`) is the real navigable view of
/// what's upcoming, this tile was never wired to it (a count here would just duplicate that).
class _ParentSummaryTiles {
  const _ParentSummaryTiles({required this.studentId});

  final String studentId;

  List<({String label, String value, IconData icon})> build(WidgetRef ref) {
    final attendance = ref.watch(studentAttendanceHistoryProvider(studentId)).maybeWhen(
          data: (result) => result.fold(
            (_) => '—',
            (history) => history.percentage != null ? '${history.percentage!.round()}%' : '—',
          ),
          orElse: () => '—',
        );

    final feeStatus = ref.watch(studentInvoicesProvider(studentId)).maybeWhen(
          data: (result) => result.fold((_) => '—', (invoices) {
            if (invoices.isEmpty) return '—';
            final totalDue = invoices.fold<double>(0, (sum, i) => sum + i.amountDue);
            return totalDue > 0 ? '₹${totalDue.toStringAsFixed(0)} due' : 'Paid up';
          }),
          orElse: () => '—',
        );

    final performanceCount = ref.watch(studentPerformanceProvider(studentId)).maybeWhen(
          data: (result) => result.fold((_) => '—', (records) => records.isEmpty ? '—' : '${records.length}'),
          orElse: () => '—',
        );

    return [
      (label: "Child's attendance", value: attendance, icon: Icons.fact_check_outlined),
      (label: 'Fee status', value: feeStatus, icon: Icons.payments_outlined),
      (label: 'Upcoming classes', value: '0', icon: Icons.event_outlined),
      (label: 'Performance', value: performanceCount, icon: Icons.insights_outlined),
    ];
  }
}

class _DetailLinks extends StatelessWidget {
  const _DetailLinks({required this.studentId, required this.childName});

  final String studentId;
  final String childName;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Column(
        children: [
          ListTile(
            leading: const Icon(Icons.fact_check_outlined),
            title: const Text('Attendance history'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => ChildAttendanceScreen(studentId: studentId, childName: childName),
              ),
            ),
          ),
          const Divider(height: 1),
          ListTile(
            leading: const Icon(Icons.insights_outlined),
            title: const Text('Performance history'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => ChildPerformanceScreen(studentId: studentId, childName: childName),
              ),
            ),
          ),
          const Divider(height: 1),
          // docs/08 §8.2 Parent "Calendar" — aggregates *every* linked child's classes/
          // assignments/fees due (`GET /calendar`'s own parent-role scope), not just whichever
          // child is currently selected in the switcher above, so this needs neither param.
          ListTile(
            leading: const Icon(Icons.calendar_month_outlined),
            title: const Text('Calendar'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const CalendarScreen()),
            ),
          ),
        ],
      ),
    );
  }
}
