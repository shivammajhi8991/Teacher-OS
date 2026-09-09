import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/error/failure.dart';
import '../../../../core/theme/modernist.dart';
import '../../../../core/widgets/empty_state.dart';
import '../../../../core/widgets/error_view.dart';
import '../../../../core/widgets/loading_view.dart';
import '../../../../core/widgets/modernist_primitives.dart';
import '../../../students/presentation/screens/student_detail_screen.dart';
import '../../domain/entities/student_invoice_overview.dart';
import '../providers/fees_providers.dart';

/// docs/08 §8.2 "Fees overview" — the one screen design_handoff_modernist/README.md named as
/// blocked and left for last: "needs a teacher-scoped invoice list (GET /invoices?status=…) and
/// a provider for it." That's `feesOverviewProvider`, landed separately; this is the screen
/// itself, wired to the Teacher shell's Fees tab (previously "coming soon").
///
/// Design: "M.surface band with the outstanding total at M.display 40px, 'OVERDUE FIRST' accent
/// kicker, then MRow per student — name + period, amount right at M.dataSmall with an
/// MTag(emphasis: true) reading '12 DAYS LATE'. Row tap → student detail." Built as tab content
/// (no Scaffold/AppBar of its own, matching `ParentFeesTab`'s own shape) rather than a pushed
/// screen — the prototype's own "Fees" title has no back arrow either, since it's a primary
/// destination there too, not something navigated into.
///
/// One line from the prototype is deliberately not here: "Send reminders to N overdue." Unlike
/// the Receipt screen's "send receipt" (where the backend already sends a real notification
/// automatically, so there was something true to say instead), there is no reminder-sending
/// capability anywhere in this system — automatic or manual — to point this at. Left out rather
/// than wired to nothing.
class FeesOverviewScreen extends ConsumerWidget {
  const FeesOverviewScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final overviewAsync = ref.watch(feesOverviewProvider);

    return RefreshIndicator(
      onRefresh: () async => ref.invalidate(feesOverviewProvider),
      child: overviewAsync.when(
        loading: () => const LoadingView(),
        error: (error, stackTrace) => ErrorView(
          failure: UnexpectedFailure(message: error.toString()),
          onRetry: () => ref.invalidate(feesOverviewProvider),
        ),
        data: (result) => result.fold(
          (failure) => ErrorView(failure: failure, onRetry: () => ref.invalidate(feesOverviewProvider)),
          (items) => _FeesOverviewBody(items: items),
        ),
      ),
    );
  }
}

class _FeesOverviewBody extends StatelessWidget {
  const _FeesOverviewBody({required this.items});

  final List<StudentInvoiceOverview> items;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final now = DateTime.now();

    if (items.isEmpty) {
      return ListView(
        children: const [
          SizedBox(height: 80),
          EmptyState(icon: Icons.payments_outlined, message: 'Everyone is paid up.'),
        ],
      );
    }

    final outstanding = items.fold<double>(0, (sum, i) => sum + i.amountDue);
    final currency = items.first.currency;
    final overdueCount = items.where((i) => i.daysLate(now) > 0).length;
    final studentCount = items.map((i) => i.studentId).toSet().length;

    return ListView(
      padding: EdgeInsets.zero,
      children: [
        const Padding(
          padding: EdgeInsets.fromLTRB(M.gutter, M.s1, M.gutter, M.s4),
          child: Text('Fees', style: M.screenTitle),
        ),
        Container(
          color: scheme.surfaceContainerLow,
          padding: const EdgeInsets.fromLTRB(M.gutter, M.s4, M.gutter, M.s6),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Outstanding this cycle'.toUpperCase(),
                style: M.kicker.copyWith(letterSpacing: 1.32, color: scheme.onSurfaceVariant),
              ),
              const SizedBox(height: M.s3),
              Text(
                '$currency ${outstanding.toStringAsFixed(0)}',
                style: M.display.copyWith(fontSize: 40),
              ),
              const SizedBox(height: 6),
              Text(
                studentCount == 1
                    ? '1 student · ${overdueCount == 0 ? 'none overdue' : '$overdueCount overdue'}'
                    : '$studentCount students · ${overdueCount == 0 ? 'none overdue' : '$overdueCount overdue'}',
                style: M.body.copyWith(fontSize: 13, color: scheme.onSurfaceVariant),
              ),
            ],
          ),
        ),
        const MSectionLabel('Overdue first', accent: true),
        for (final (i, item) in items.indexed) ...[
          if (i > 0) const MRowRule(),
          _InvoiceOverviewRow(item: item, now: now),
        ],
        const SizedBox(height: M.s6),
      ],
    );
  }
}

class _InvoiceOverviewRow extends StatelessWidget {
  const _InvoiceOverviewRow({required this.item, required this.now});

  final StudentInvoiceOverview item;
  final DateTime now;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final daysLate = item.daysLate(now);
    final isLate = daysLate > 0;
    final tagLabel = switch (daysLate) {
      > 1 => '$daysLate days late',
      1 => '1 day late',
      0 => 'Due today',
      -1 => 'Due in 1 day',
      _ => 'Due in ${-daysLate} days',
    };

    return MRow(
      title: item.studentName,
      sub: '${item.billingPeriodStart} – ${item.billingPeriodEnd}',
      trailing: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Text(
            '${item.currency} ${item.amountDue.toStringAsFixed(0)}',
            style: M.dataSmall.copyWith(color: isLate ? M.accent700 : scheme.onSurface),
          ),
          const SizedBox(height: 6),
          MTag(tagLabel, emphasis: isLate),
        ],
      ),
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => StudentDetailScreen(studentId: item.studentId)),
      ),
    );
  }
}
