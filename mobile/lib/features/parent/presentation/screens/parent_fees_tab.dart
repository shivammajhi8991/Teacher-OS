import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/error/failure.dart';
import '../../../../core/widgets/empty_state.dart';
import '../../../../core/widgets/error_view.dart';
import '../../../../core/widgets/loading_view.dart';
import '../../../fees/domain/entities/invoice_summary.dart';
import '../../../fees/presentation/providers/fees_providers.dart';
import '../providers/parent_providers.dart';

/// docs/08 §8.2 Parent "Fees | ... | Tab bar." Read-only by design, not an oversight: docs/06
/// §6.2 gives Parent "O (linked child)" for viewing invoices but "–" for recording a payment —
/// fee collection stays the teacher's/institute's authoritative record. Scopes to whichever
/// child the switcher (role_dashboard_scaffold.dart's `appBarBottom`) currently has selected.
class ParentFeesTab extends ConsumerWidget {
  const ParentFeesTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final childrenAsync = ref.watch(linkedChildrenProvider);
    final selected = ref.watch(selectedChildIdProvider);

    return childrenAsync.when(
      loading: () => const LoadingView(),
      error: (error, stackTrace) => ErrorView(
        failure: UnexpectedFailure(message: error.toString()),
        onRetry: () => ref.invalidate(linkedChildrenProvider),
      ),
      data: (result) => result.fold(
        (failure) => ErrorView(failure: failure, onRetry: () => ref.invalidate(linkedChildrenProvider)),
        (children) {
          final childId = effectiveChildId(children, selected);
          if (childId == null) {
            return const EmptyState(icon: Icons.family_restroom_outlined, message: 'No linked children yet.');
          }
          return _InvoicesList(studentId: childId);
        },
      ),
    );
  }
}

class _InvoicesList extends ConsumerWidget {
  const _InvoicesList({required this.studentId});

  final String studentId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final invoicesAsync = ref.watch(studentInvoicesProvider(studentId));

    return RefreshIndicator(
      onRefresh: () async => ref.invalidate(studentInvoicesProvider(studentId)),
      child: invoicesAsync.when(
        loading: () => const LoadingView(),
        error: (error, stackTrace) => ErrorView(
          failure: UnexpectedFailure(message: error.toString()),
          onRetry: () => ref.invalidate(studentInvoicesProvider(studentId)),
        ),
        data: (result) => result.fold(
          (failure) => ErrorView(failure: failure, onRetry: () => ref.invalidate(studentInvoicesProvider(studentId))),
          (invoices) => invoices.isEmpty
              ? ListView(
                  children: const [
                    SizedBox(height: 80),
                    EmptyState(icon: Icons.payments_outlined, message: 'No invoices yet.'),
                  ],
                )
              : ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: invoices.length,
                  separatorBuilder: (_, __) => const Divider(),
                  itemBuilder: (context, index) => _InvoiceTile(invoice: invoices[index]),
                ),
        ),
      ),
    );
  }
}

class _InvoiceTile extends StatelessWidget {
  const _InvoiceTile({required this.invoice});

  final InvoiceSummary invoice;

  @override
  Widget build(BuildContext context) {
    final color = switch (invoice.status) {
      'paid' => Colors.green.shade600,
      'overdue' => Theme.of(context).colorScheme.error,
      'partial' => Colors.orange.shade700,
      _ => Theme.of(context).colorScheme.onSurfaceVariant,
    };
    return ListTile(
      title: Text('${invoice.billingPeriodStart} – ${invoice.billingPeriodEnd}'),
      subtitle: Text(
        'Due ${invoice.dueDate} · ${invoice.currency} ${invoice.totalAmount.toStringAsFixed(2)} '
        '(paid ${invoice.paidTotal.toStringAsFixed(2)})',
      ),
      trailing: Chip(
        label: Text(invoice.status, style: TextStyle(color: color, fontSize: 12)),
        visualDensity: VisualDensity.compact,
        side: BorderSide.none,
      ),
    );
  }
}
