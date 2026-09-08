import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../attendance/presentation/screens/quick_attendance_screen.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../../calendar/domain/entities/calendar_event.dart';
import '../../../calendar/presentation/providers/calendar_providers.dart';
import '../../../calendar/presentation/screens/calendar_screen.dart';
import '../../../classes/presentation/screens/class_list_screen.dart';
import '../../../students/presentation/screens/student_list_screen.dart';
import '../widgets/role_dashboard_scaffold.dart';
import 'more_menu_screen.dart';

/// docs/08 §8.1 Teacher shell, §8.2 Teacher screen inventory, §8.7 layout regions.
///
/// The redesign fills the two new scaffold regions from an endpoint that already exists:
/// `GET /calendar` (docs/07 Phase 5 step 6) returns today's `class_occurrence`,
/// `assignment_due` and `fee_due` events already scoped to the caller, with `conflict` flagged
/// and `sourceId` carrying the class id — enough for both "Next up" and "Needs you" with no new
/// backend work and no new provider.
///
/// What is still static, and what it needs (unchanged from before this redesign, but now
/// visibly demoted to the reference grid at the foot of the screen rather than presented as
/// the dashboard's headline):
///   * Total students — `GET /students` returns a paginated list, not a count; needs either a
///     `meta.total` read or a summary endpoint.
///   * Pending fees / Attendance % / Pending assignments — each needs its own feature's
///     dashboard-summary endpoint (none exist yet). The aggregate overdue-fee figure the
///     "Needs you" section wants is the most valuable of the four: the Fees module supports it
///     server-side, but mobile has no invoice-list provider beyond
///     `studentInvoicesProvider(studentId)`.
class TeacherDashboardScreen extends ConsumerWidget {
  const TeacherDashboardScreen({super.key});

  static String _hhmm(DateTime d) {
    final l = d.toLocal();
    return '${l.hour.toString().padLeft(2, '0')}:${l.minute.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final today = DateTime.now().toIso8601String().substring(0, 10);
    final todayAsync = ref.watch(calendarProvider((from: today, to: today)));

    final events = todayAsync.maybeWhen(
      data: (result) => result.fold((_) => const <CalendarEvent>[], (list) => list),
      orElse: () => const <CalendarEvent>[],
    );

    final now = DateTime.now();
    final classes = events.where((e) => e.eventType == 'class_occurrence').toList()
      ..sort((a, b) => a.startsAt.compareTo(b.startsAt));
    final next = classes.where((e) => e.endsAt.isAfter(now)).firstOrNull ?? classes.firstOrNull;

    return RoleDashboardScaffold(
      greeting: 'Today',
      onLogout: () => ref.read(authNotifierProvider.notifier).logout(),
      tabs: const [
        (icon: Icons.dashboard_outlined, label: 'Today'),
        (icon: Icons.class_outlined, label: 'Classes'),
        (icon: Icons.people_outline, label: 'Students'),
        (icon: Icons.payments_outlined, label: 'Fees'),
        (icon: Icons.more_horiz, label: 'More'),
      ],
      tabBuilders: {
        1: (context) => const ClassListScreen(), // docs/07 Phase 4 step 4
        2: (context) => const StudentListScreen(), // docs/07 Phase 4 step 3
        4: (context) => const MoreMenuScreen(), // docs/07 Phase 5 step 5
      },
      nextUp: next == null
          ? null
          : (
              kicker: 'Next up',
              title: next.title,
              meta: '${_hhmm(next.startsAt)} — ${_hhmm(next.endsAt)}',
              ctaLabel: 'Take attendance',
              onCta: () => Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => QuickAttendanceScreen(
                    classId: next.sourceId,
                    className: next.title,
                    scheduleLabel: '${_hhmm(next.startsAt)} — ${_hhmm(next.endsAt)}',
                  ),
                ),
              ),
            ),
      attention: [
        for (final e in events.where((e) => e.conflict))
          (
            kicker: 'Clash',
            title: e.title,
            sub: switch (e.conflictReason) {
              'teacher_double_booking' => 'Double-booked at ${_hhmm(e.startsAt)}',
              'location_conflict' => 'Same room as another class at ${_hhmm(e.startsAt)}',
              _ => 'Overlaps another class at ${_hhmm(e.startsAt)}',
            },
            urgent: true,
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const CalendarScreen()),
            ),
          ),
        for (final e in events.where((e) => e.eventType == 'fee_due'))
          (
            kicker: 'Fees due',
            title: e.title,
            sub: 'Due today',
            urgent: true,
            onTap: null, // needs the aggregate invoice list — see the class comment above
          ),
        for (final e in events.where((e) => e.eventType == 'assignment_due'))
          (
            kicker: 'Assignment due',
            title: e.title,
            sub: 'Closes ${_hhmm(e.endsAt)}',
            urgent: false,
            onTap: null, // AssignmentReviewScreen needs the assignment id, not the occurrence id
          ),
      ],
      summaryTiles: const [
        (label: 'Total students', value: '—', icon: Icons.people_outline),
        (label: 'Pending fees', value: '—', icon: Icons.payments_outlined),
        (label: 'Attendance %', value: '—', icon: Icons.fact_check_outlined),
      ],
    );
  }
}
