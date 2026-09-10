import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../../core/theme/modernist.dart';
import '../../../../core/widgets/modernist_primitives.dart';
import '../../../announcements/presentation/screens/announcements_list_screen.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../../auth/presentation/screens/account_settings_screen.dart';
import '../../../attendance/presentation/providers/attendance_providers.dart';
import '../../../calendar/domain/entities/calendar_event.dart';
import '../../../calendar/presentation/providers/calendar_providers.dart';
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
///
/// Modernist redesign (design_handoff_modernist/README.md's "Parent home" row): "Child switcher
/// as two flush-left 20px/800 tabs with a 3px accent underline (replacing the ChoiceChip row);
/// then the fee band with MPrimaryAction 'Pay ₹2,400', MStatCells, next classes, and the
/// teacher's note." The switcher redesign is `child_switcher_bar.dart`. The rest replaces
/// `_DetailLinks` with [_ParentHomeExtra] below.
///
/// Two adaptations from the prototype, both because the thing it shows doesn't exist in this
/// app:
///  - **"Pay ₹2,400"** — parents can't pay through this app. That's not a gap, it's a documented
///    product decision: docs/06 §6.2 gives Parent "O (linked child)" for *viewing* invoices but
///    "–" for recording a payment, and `parent_fees_tab.dart`'s own class comment says so
///    explicitly ("Read-only by design, not an oversight... fee collection stays the
///    teacher's/institute's authoritative record"). The fee band keeps its visual weight — the
///    amount owed is real and worth surfacing — but its one action is "View fee details",
///    pushing the same read-only `ParentFeesTab` already reachable from the Fees tab, not a
///    payment flow that was never built.
///  - **"From the teacher" note** — there is no concept anywhere in this system of a private,
///    per-child note a teacher leaves for a parent. `Announcement.targetType` is
///    'class' | 'institute' | 'platform' — broadcast, not personal — so reusing it here would
///    misrepresent what it is. Left out rather than invented.
///
/// "Next classes" is real but knowingly imperfect: `GET /calendar`'s parent-role scope
/// aggregates *every* linked child (same limitation the old `_DetailLinks`' Calendar link already
/// documented), and `CalendarEvent` carries a class id, not a student id, so there's no way to
/// filter it to just the currently-switched child. Shown anyway, since an aggregate "what's
/// coming up" is still real, useful data — just not the strictly per-child list the prototype's
/// mock implies.
class ParentDashboardScreen extends ConsumerWidget {
  const ParentDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final childrenAsync = ref.watch(linkedChildrenProvider);
    final selected = ref.watch(selectedChildIdProvider);

    return childrenAsync.when(
      loading: () => _shell(ref),
      error: (error, stackTrace) => _shell(ref),
      data: (result) => result.fold(
        (failure) => _shell(ref),
        (children) {
          final childId = effectiveChildId(children, selected);
          final childMatches = children.where((c) => c.id == childId);
          final childName = childMatches.isEmpty ? null : childMatches.first.fullName;

          return _shell(
            ref,
            appBarBottom: children.length > 1 && childId != null
                ? ChildSwitcherBar(children: children, selectedId: childId)
                : null,
            dashboardExtra: childId == null || childName == null
                ? null
                : _ParentHomeExtra(studentId: childId, childName: childName),
          );
        },
      ),
    );
  }

  Widget _shell(
    WidgetRef ref, {
    PreferredSizeWidget? appBarBottom,
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
        3: (context) => const AccountSettingsScreen(), // docs/01 §1.3 data export/deletion
      },
      appBarBottom: appBarBottom,
      dashboardExtra: dashboardExtra,
      summaryTiles: const [], // folded into _ParentHomeExtra's own MStatCells below
    );
  }
}

class _ParentHomeExtra extends ConsumerWidget {
  const _ParentHomeExtra({required this.studentId, required this.childName});

  final String studentId;
  final String childName;

  Future<void> _openFees(BuildContext context) {
    return Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => Scaffold(
          appBar: AppBar(title: const Text('Fees')),
          body: const ParentFeesTab(),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final scheme = Theme.of(context).colorScheme;
    final now = DateTime.now();

    final attendanceLabel = ref.watch(studentAttendanceHistoryProvider(studentId)).maybeWhen(
          data: (result) => result.fold(
            (_) => '—',
            (history) => history.percentage != null ? '${history.percentage!.round()}%' : '—',
          ),
          orElse: () => '—',
        );

    final invoices = ref.watch(studentInvoicesProvider(studentId)).maybeWhen(
          data: (result) => result.fold((_) => const [], (list) => list),
          orElse: () => const [],
        );
    final outstanding = invoices.fold<double>(0, (sum, i) => sum + i.amountDue);
    final currency = invoices.firstOrNull?.currency ?? '₹';
    final nextDueDates = invoices.where((i) => i.amountDue > 0).map((i) => i.dueDate).toList()
      ..sort();
    final feeStatusLabel = invoices.isEmpty
        ? '—'
        : (outstanding > 0 ? '$currency ${outstanding.toStringAsFixed(0)} due' : 'Paid up');

    final performanceCount = ref.watch(studentPerformanceProvider(studentId)).maybeWhen(
          data: (result) => result.fold((_) => '—', (records) => '${records.length}'),
          orElse: () => '—',
        );

    final calendarAsync = ref.watch(
      calendarProvider((
        from: DateTime(now.year, now.month, now.day).toIso8601String().substring(0, 10),
        to: now.add(const Duration(days: 7)).toIso8601String().substring(0, 10),
      )),
    );
    final upcomingClasses = calendarAsync.maybeWhen(
      data: (result) => result.fold((_) => const <CalendarEvent>[], (list) => list),
      orElse: () => const <CalendarEvent>[],
    ).where((e) => e.eventType == 'class_occurrence' && e.startsAt.isAfter(now)).toList()
      ..sort((a, b) => a.startsAt.compareTo(b.startsAt));
    final nextTwoClasses = upcomingClasses.take(2).toList();

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (outstanding > 0) ...[
          Container(
            color: scheme.surfaceContainerLow,
            padding: const EdgeInsets.fromLTRB(M.gutter, M.s4, M.gutter, M.s6),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Fees due'.toUpperCase(),
                  style: M.kicker.copyWith(letterSpacing: 1.32, color: M.accent),
                ),
                const SizedBox(height: M.s3),
                Text(
                  '$currency ${outstanding.toStringAsFixed(0)}',
                  style: M.sectionTitle.copyWith(fontSize: 36),
                ),
                const SizedBox(height: 6),
                if (nextDueDates.isNotEmpty)
                  Text(
                    'Next due ${nextDueDates.first}',
                    style: M.body.copyWith(fontSize: 13, color: scheme.onSurfaceVariant),
                  ),
                const SizedBox(height: M.s4),
                MPrimaryAction(label: 'View fee details', onPressed: () => _openFees(context)),
              ],
            ),
          ),
          const MRule(),
        ],
        MStatCells(
          cells: [
            (label: "$childName's attendance", value: attendanceLabel, tone: null),
            (
              label: 'Fee status',
              value: feeStatusLabel,
              tone: outstanding > 0 ? M.accent700 : null,
            ),
            (label: 'Performance records', value: performanceCount, tone: null),
          ],
        ),
        const MRule(),
        const MSectionLabel('Next classes'),
        if (nextTwoClasses.isEmpty)
          Padding(
            padding: const EdgeInsets.fromLTRB(M.gutter, M.s2, M.gutter, M.s4),
            child: Text(
              'Nothing scheduled in the next week.',
              style: M.meta.copyWith(color: scheme.onSurfaceVariant),
            ),
          )
        else
          for (final (i, event) in nextTwoClasses.indexed) ...[
            if (i > 0) const MRowRule(),
            MRow(
              leading: SizedBox(
                width: 68,
                child: Text(
                  DateFormat('EEE HH:mm').format(event.startsAt.toLocal()),
                  style: M.dataSmall.copyWith(fontSize: 14),
                ),
              ),
              title: event.title,
            ),
          ],
        const MRule(),
        const MSectionLabel('More about this child'),
        MRow(
          title: 'Attendance history',
          onTap: () => Navigator.of(context).push(
            MaterialPageRoute(
              builder: (_) => ChildAttendanceScreen(studentId: studentId, childName: childName),
            ),
          ),
        ),
        const MRowRule(),
        MRow(
          title: 'Performance history',
          onTap: () => Navigator.of(context).push(
            MaterialPageRoute(
              builder: (_) => ChildPerformanceScreen(studentId: studentId, childName: childName),
            ),
          ),
        ),
        const MRowRule(),
        // Aggregates every linked child, not just this one — see the class doc comment above.
        MRow(
          title: 'Calendar',
          onTap: () => Navigator.of(context).push(
            MaterialPageRoute(builder: (_) => const CalendarScreen()),
          ),
        ),
      ],
    );
  }
}
