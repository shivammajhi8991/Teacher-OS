import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/error/failure.dart';
import '../../../../core/theme/modernist.dart';
import '../../../../core/widgets/error_view.dart';
import '../../../../core/widgets/loading_view.dart';
import '../../../../core/widgets/modernist_primitives.dart';
import '../../../attendance/presentation/providers/attendance_providers.dart';
import '../../../fees/domain/entities/invoice_summary.dart';
import '../../../fees/presentation/providers/fees_providers.dart';
import '../../../fees/presentation/screens/record_payment_screen.dart';
import '../../../performance/domain/entities/performance_record.dart';
import '../../../performance/presentation/providers/performance_providers.dart';
import '../../../performance/presentation/widgets/record_performance_dialog.dart';
import '../../domain/entities/guardian_input.dart';
import '../../domain/entities/student_detail.dart';
import '../providers/students_providers.dart';
import 'student_form_screen.dart';

/// docs/08 §8.2 "Student detail" — profile, guardians, teacher assignments, and (docs/08 §8.4)
/// the Fees section: "Teacher opens student → sees pending amount → records payment → receipt."
///
/// Modernist redesign (design_handoff_modernist/README.md): "No new data" — every value here
/// already existed in `StudentDetail`/`studentInvoicesProvider`/`studentPerformanceProvider`,
/// including `studentAttendanceHistoryProvider` for the attendance stat cell (added for the
/// Parent dashboard, Phase 5 step 3 — this screen's own class comment used to say no screen
/// consumed it yet; that was already stale before this pass). The header's three tags, the
/// Attendance/Outstanding/Records `MStatCells`, the accent "owes" band with its one
/// `MPrimaryAction`, and LEDGER/PROGRESS/GUARDIAN as `MSectionLabel` + `MRow` lists all come
/// straight from the handoff's spec for this screen. Details (dob/medical notes/emergency
/// contact) and Teachers aren't in that spec — dropping real safety-relevant data (medical
/// notes, emergency contact) to match a spec that simply doesn't mention it isn't the right
/// call, so both keep the same MSectionLabel/MRow treatment as everything else here instead.
/// Record payment still opens the existing `RecordPaymentDialog` unchanged — the handoff's own
/// "not implemented in Dart" table lists a redesigned Record Payment/Receipt flow as later,
/// separate work, not part of this screen's pass.
class StudentDetailScreen extends ConsumerWidget {
  const StudentDetailScreen({super.key, required this.studentId});

  final String studentId;

  Future<void> _openEdit(BuildContext context, WidgetRef ref, StudentDetail detail) async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => StudentFormScreen(studentId: studentId, initial: detail.student),
      ),
    );
  }

  Future<void> _confirmArchive(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Archive student?'),
        content: const Text(
          'Attendance and fee history is kept — you can restore this student later. '
          'This does not delete anything.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.of(context).pop(true), child: const Text('Archive')),
        ],
      ),
    );
    if (confirmed != true) return;

    final result = await ref.read(archiveStudentUseCaseProvider).call(studentId);
    if (!context.mounted) return;
    result.fold(
      (failure) =>
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(failure.message))),
      (_) {
        ref.invalidate(studentListProvider);
        Navigator.of(context).pop();
      },
    );
  }

  Future<void> _openAddGuardian(BuildContext context, WidgetRef ref) async {
    final result = await showDialog<GuardianInput>(
      context: context,
      builder: (context) => const _AddGuardianDialog(),
    );
    if (result == null) return;

    final addResult = await ref.read(addGuardianUseCaseProvider).call(studentId, result);
    if (!context.mounted) return;
    addResult.fold(
      (failure) =>
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(failure.message))),
      (_) => ref.invalidate(studentDetailProvider(studentId)),
    );
  }

  Future<void> _openRecordPayment(
    BuildContext context,
    WidgetRef ref,
    StudentDetail detail,
    InvoiceSummary invoice,
  ) async {
    final primaryGuardian =
        detail.guardians.where((g) => g.isPrimary).firstOrNull ?? detail.guardians.firstOrNull;
    final recorded = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => RecordPaymentScreen(
          invoice: invoice,
          studentName: detail.student.fullName,
          guardianName: primaryGuardian?.fullName,
        ),
      ),
    );
    if (recorded == true) ref.invalidate(studentInvoicesProvider(studentId));
  }

  Future<void> _openRecordPerformance(BuildContext context, WidgetRef ref) async {
    final recorded = await showDialog<bool>(
      context: context,
      builder: (_) => RecordPerformanceDialog(studentId: studentId),
    );
    if (recorded == true) ref.invalidate(studentPerformanceProvider(studentId));
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detailAsync = ref.watch(studentDetailProvider(studentId));

    return Scaffold(
      body: SafeArea(
        child: detailAsync.when(
          loading: () => const LoadingView(),
          error: (error, stackTrace) => ErrorView(
            failure: UnexpectedFailure(message: error.toString()),
            onRetry: () => ref.invalidate(studentDetailProvider(studentId)),
          ),
          data: (result) => result.fold(
            (failure) => ErrorView(
              failure: failure,
              onRetry: () => ref.invalidate(studentDetailProvider(studentId)),
            ),
            (detail) => _StudentDetailBody(
              studentId: studentId,
              detail: detail,
              onEdit: () => _openEdit(context, ref, detail),
              onArchive: () => _confirmArchive(context, ref),
              onAddGuardian: () => _openAddGuardian(context, ref),
              onRecordPayment: (invoice) => _openRecordPayment(context, ref, detail, invoice),
              onRecordPerformance: () => _openRecordPerformance(context, ref),
            ),
          ),
        ),
      ),
    );
  }
}

class _StudentDetailBody extends ConsumerWidget {
  const _StudentDetailBody({
    required this.studentId,
    required this.detail,
    required this.onEdit,
    required this.onArchive,
    required this.onAddGuardian,
    required this.onRecordPayment,
    required this.onRecordPerformance,
  });

  final String studentId;
  final StudentDetail detail;
  final VoidCallback onEdit;
  final VoidCallback onArchive;
  final VoidCallback onAddGuardian;
  final ValueChanged<InvoiceSummary> onRecordPayment;
  final VoidCallback onRecordPerformance;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final scheme = Theme.of(context).colorScheme;
    final attendanceAsync = ref.watch(studentAttendanceHistoryProvider(studentId));
    final invoicesAsync = ref.watch(studentInvoicesProvider(studentId));
    final performanceAsync = ref.watch(studentPerformanceProvider(studentId));

    final attendanceLabel = attendanceAsync.maybeWhen(
      data: (result) => result.fold(
        (_) => '—',
        (history) => history.percentage != null ? '${history.percentage!.round()}%' : '—',
      ),
      orElse: () => '—',
    );

    final invoices = invoicesAsync.maybeWhen(
      data: (result) => result.fold((_) => const <InvoiceSummary>[], (list) => list),
      orElse: () => const <InvoiceSummary>[],
    );
    final outstanding = invoices.fold<double>(0, (sum, i) => sum + i.amountDue);
    // The one aggregate action below targets whichever invoice actually owes something — in the
    // overwhelmingly common case there's exactly one, matching how the previous per-row "Record
    // payment" buttons were used in practice; a student with several distinct open invoices at
    // once is a real but rare edge case the redesign's single action doesn't split out further.
    final oldestUnpaid = invoices.where((i) => i.amountDue > 0).firstOrNull;

    final performanceRecords = performanceAsync.maybeWhen(
      data: (result) => result.fold((_) => const <PerformanceRecord>[], (list) => list),
      orElse: () => const <PerformanceRecord>[],
    );

    final primaryAssignment =
        detail.teacherAssignments.where((a) => a.isOngoing).firstOrNull ??
            detail.teacherAssignments.firstOrNull;

    return ListView(
      padding: EdgeInsets.zero,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(M.gutter, M.s2, M.gutter, M.s4),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _SquareIconButton(
                icon: Icons.arrow_back,
                tooltip: 'Back',
                onPressed: () => Navigator.of(context).maybePop(),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(detail.student.fullName, style: M.sectionTitle),
                    const SizedBox(height: M.s3),
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: [
                        MTag(detail.student.enrollmentStatus),
                        if (primaryAssignment != null)
                          MTag(primaryAssignment.subjectOrSkill ?? 'General'),
                        MTag('Since ${detail.student.joinDate}'),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: M.gutter),
          child: Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: onEdit,
                  icon: const Icon(Icons.edit_outlined, size: 18),
                  label: const Text('Edit'),
                ),
              ),
              const SizedBox(width: M.s2),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: onArchive,
                  icon: const Icon(Icons.archive_outlined, size: 18),
                  label: const Text('Archive'),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: M.s4),
        const MRule(),
        MStatCells(
          filled: true,
          cells: [
            (label: 'Attendance', value: attendanceLabel, tone: null),
            (
              label: 'Outstanding',
              value: outstanding > 0 ? '₹${outstanding.toStringAsFixed(0)}' : '₹0',
              tone: outstanding > 0 ? M.accent700 : null,
            ),
            (label: 'Records', value: '${performanceRecords.length}', tone: null),
          ],
        ),
        const MRule(),
        if (oldestUnpaid != null) ...[
          Container(
            color: scheme.surfaceContainerLow,
            padding: const EdgeInsets.fromLTRB(M.gutter, M.s4, M.gutter, M.s6),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Payment due'.toUpperCase(),
                  style: M.kicker.copyWith(letterSpacing: 1.32, color: M.accent),
                ),
                const SizedBox(height: M.s3),
                Text(
                  '₹${oldestUnpaid.amountDue.toStringAsFixed(2)}',
                  style: M.sectionTitle.copyWith(fontSize: 30),
                ),
                const SizedBox(height: 6),
                Text(
                  '${oldestUnpaid.billingPeriodStart} – ${oldestUnpaid.billingPeriodEnd} · '
                  'due ${oldestUnpaid.dueDate}',
                  style: M.body.copyWith(fontSize: 13, color: scheme.onSurfaceVariant),
                ),
                const SizedBox(height: M.s4),
                MPrimaryAction(
                  label: 'Record payment',
                  onPressed: () => onRecordPayment(oldestUnpaid),
                ),
              ],
            ),
          ),
          const MRule(),
        ],
        MSectionLabel(
          'Ledger',
          trailing: invoicesAsync.isLoading
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : null,
        ),
        if (invoices.isEmpty)
          const _EmptyRow('No invoices yet.')
        else
          for (final (i, invoice) in invoices.indexed) ...[
            if (i > 0) const MRowRule(),
            MRow(
              title: '${invoice.billingPeriodStart} – ${invoice.billingPeriodEnd}',
              sub: 'Due ${invoice.dueDate}',
              trailingValue: '${invoice.currency} ${invoice.totalAmount.toStringAsFixed(2)}',
              trailingLabel: invoice.status,
              trailingTone: invoice.status == 'overdue' ? M.accent700 : null,
            ),
          ],
        const MRule(),
        MSectionLabel(
          'Progress',
          trailing: TextButton(onPressed: onRecordPerformance, child: const Text('RECORD')),
        ),
        if (performanceRecords.isEmpty)
          const _EmptyRow('No performance records yet.')
        else
          for (final (i, record) in performanceRecords.indexed) ...[
            if (i > 0) const MRowRule(),
            MRow(
              title: record.metricName,
              sub: record.recordedAt.toLocal().toString().substring(0, 10),
              trailingValue: record.unit != null ? '${record.value} ${record.unit}' : record.value,
            ),
          ],
        const MRule(),
        MSectionLabel(
          'Guardians',
          trailing: TextButton(onPressed: onAddGuardian, child: const Text('ADD')),
        ),
        if (detail.guardians.isEmpty)
          const _EmptyRow('No guardians linked yet.')
        else
          for (final (i, guardian) in detail.guardians.indexed) ...[
            if (i > 0) const MRowRule(),
            MRow(
              title: guardian.fullName,
              sub: [
                if (guardian.relationship != null) guardian.relationship!,
                if (guardian.phone != null) guardian.phone!,
              ].join(' · '),
              trailing: guardian.isPrimary ? const MTag('Primary') : null,
            ),
          ],
        const MRule(),
        const MSectionLabel('Teachers'),
        if (detail.teacherAssignments.isEmpty)
          const _EmptyRow('No teacher assignments.')
        else
          for (final (i, assignment) in detail.teacherAssignments.indexed) ...[
            if (i > 0) const MRowRule(),
            MRow(
              title: assignment.subjectOrSkill ?? 'General',
              sub: assignment.isOngoing ? 'Ongoing' : 'Ended',
            ),
          ],
        const MRule(),
        const MSectionLabel('Details'),
        _DetailRow('Date of birth', detail.student.dob),
        _DetailRow('Gender', detail.student.gender),
        _DetailRow('Emergency contact', detail.student.emergencyContactName),
        _DetailRow('Emergency phone', detail.student.emergencyContactPhone),
        _DetailRow('Medical notes', detail.student.medicalNotes),
        const SizedBox(height: M.s6),
      ],
    );
  }
}

class _EmptyRow extends StatelessWidget {
  const _EmptyRow(this.message);

  final String message;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.fromLTRB(M.gutter, M.s2, M.gutter, M.s4),
      child: Text(message, style: M.meta.copyWith(color: scheme.onSurfaceVariant)),
    );
  }
}

/// A flush-left label/value fact — the same shape as the original `_DetailRow`, restyled to
/// Modernist's own type tokens (M.meta label, M.row value) rather than the theme's default
/// bodySmall/bodyMedium. Not in the handoff's spec for this screen (its "no new data" scope
/// covers what's already fetched, not which existing fields to drop), so it keeps the same
/// hide-when-empty behaviour as before.
class _DetailRow extends StatelessWidget {
  const _DetailRow(this.label, this.value);

  final String label;
  final String? value;

  @override
  Widget build(BuildContext context) {
    if (value == null || value!.isEmpty) return const SizedBox.shrink();
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.fromLTRB(M.gutter, M.s2, M.gutter, M.s2),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 140,
            child: Text(label, style: M.meta.copyWith(color: scheme.onSurfaceVariant)),
          ),
          Expanded(child: Text(value!, style: M.row)),
        ],
      ),
    );
  }
}

/// A 44px square icon button with a 1px rule — same shape as
/// `quick_attendance_screen.dart`'s own `_SquareIconButton` (screen-local by the same precedent,
/// not promoted into `modernist_primitives.dart` — the handoff itself keeps this pattern
/// per-screen rather than shared).
class _SquareIconButton extends StatelessWidget {
  const _SquareIconButton({required this.icon, required this.onPressed, this.tooltip});

  final IconData icon;
  final VoidCallback onPressed;
  final String? tooltip;

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
          child: Icon(icon, size: 20, color: scheme.onSurface),
        ),
      ),
    );
  }
}

class _AddGuardianDialog extends StatefulWidget {
  const _AddGuardianDialog();

  @override
  State<_AddGuardianDialog> createState() => _AddGuardianDialogState();
}

class _AddGuardianDialogState extends State<_AddGuardianDialog> {
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _emailController = TextEditingController();
  final _relationshipController = TextEditingController();
  bool _consent = false;

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _emailController.dispose();
    _relationshipController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Add guardian'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: _nameController,
              decoration: const InputDecoration(labelText: 'Full name'),
              onChanged: (_) => setState(() {}), // keeps the Add button's enabled state live
            ),
            TextField(
              controller: _phoneController,
              decoration: const InputDecoration(labelText: 'Phone'),
              keyboardType: TextInputType.phone,
            ),
            TextField(
              controller: _emailController,
              decoration: const InputDecoration(labelText: 'Email'),
              keyboardType: TextInputType.emailAddress,
            ),
            TextField(
              controller: _relationshipController,
              decoration: const InputDecoration(labelText: 'Relationship'),
            ),
            CheckboxListTile(
              contentPadding: EdgeInsets.zero,
              controlAffinity: ListTileControlAffinity.leading,
              title: const Text('Consents to data sharing'),
              value: _consent,
              onChanged: (v) => setState(() => _consent = v ?? false),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Cancel')),
        FilledButton(
          onPressed: _nameController.text.trim().isEmpty
              ? null
              : () => Navigator.of(context).pop(
                    GuardianInput(
                      fullName: _nameController.text.trim(),
                      phone: _phoneController.text.trim().isEmpty ? null : _phoneController.text.trim(),
                      email: _emailController.text.trim().isEmpty ? null : _emailController.text.trim(),
                      relationship: _relationshipController.text.trim().isEmpty
                          ? null
                          : _relationshipController.text.trim(),
                      consentDataSharing: _consent,
                    ),
                  ),
          child: const Text('Add'),
        ),
      ],
    );
  }
}
