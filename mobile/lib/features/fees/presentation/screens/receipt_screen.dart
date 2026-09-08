import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../../core/theme/modernist.dart';
import '../../../../core/widgets/modernist_primitives.dart';

/// docs/08 §8.4 Fee Collection's documented follow-up, now built: a confirmation screen shown
/// immediately after `RecordPaymentScreen` records a payment successfully.
///
/// design_handoff_modernist/README.md's "Receipt" row: "accent poster block with the amount at
/// M.display, then MRow facts (student, method, receipt no., recorded at, balance), then 'Send
/// receipt to <guardian>' as an ink MPrimaryAction." The accent-filled poster block is this
/// system's one documented exception to "one red action per screen" — README: "Red as a field
/// only for a poster statement (login hero, receipt confirmation)" — so the two buttons below it
/// are deliberately ink and outline, not accent.
///
/// Two adaptations from the prototype, both because the underlying capability doesn't exist yet
/// and nothing here should pretend it does:
///  - **Receipt no.** — `POST /payments` does return the saved `Payment` row, but only as the
///    raw TypeORM entity (no response DTO the way `GET .../invoices` has one), so its exact JSON
///    shape — numeric fields as strings vs. numbers, whether relations serialize — isn't
///    something this pass can verify without a running backend. The client already holds a
///    server-unique value for this exact payment: the idempotency key it generated and sent
///    (`payments.idempotency_key` is a unique column — docs/01 §1.5). Showing that key as the
///    receipt reference is real and durable, not invented, and sidesteps depending on an
///    unverified response contract.
///  - **"Send receipt"** — there's no share package in this project and no endpoint to
///    (re-)send a receipt on demand; the backend already pushes a `payment_confirmed`
///    notification to the guardian automatically inside `recordPayment` itself
///    (`fees.service.ts`'s `notifyStudentParty` call), with no separate teacher-triggered action
///    needed. So this button keeps the spec's label and position but, on tap, says exactly that
///    instead of silently doing nothing or pretending to send something new.
///  - **"Back to fees"** → **"Back to student"** — the prototype's Fees-overview-first flow
///    assumes a screen this app doesn't have yet (`fees_overview_screen.dart` is still a
///    separate, blocked item in this same README table). The real screen below this one in the
///    stack is Student detail, so the button is renamed to say where it actually goes.
class ReceiptScreen extends StatelessWidget {
  const ReceiptScreen({
    super.key,
    required this.studentName,
    required this.invoicePeriodLabel,
    required this.methodLabel,
    required this.receiptRef,
    required this.recordedAt,
    required this.currency,
    required this.paidAmount,
    required this.balance,
    this.guardianName,
  });

  final String studentName;
  final String invoicePeriodLabel;
  final String methodLabel;
  final String receiptRef;
  final DateTime recordedAt;
  final String currency;
  final double paidAmount;
  final double balance;
  final String? guardianName;

  void _done(BuildContext context) {
    // The payment is already recorded server-side by the time this screen is reachable — there
    // is no "cancel" state here, so every way off this screen (button or system back) reports
    // the same success result to whoever pushed RecordPaymentScreen.
    Navigator.of(context).pop(true);
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final recordedLabel = DateFormat('d MMM y, HH:mm').format(recordedAt);
    final fullyPaid = balance <= 0;

    return PopScope<bool>(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop) _done(context);
      },
      child: Scaffold(
        body: SafeArea(
          child: ListView(
            padding: EdgeInsets.zero,
            children: [
              const MSectionLabel('Payment recorded'),
              Container(
                color: M.accent,
                padding: const EdgeInsets.fromLTRB(M.gutter, M.s6, M.gutter, M.s8),
                child: Text(
                  '$currency ${paidAmount.toStringAsFixed(2)}',
                  style: M.display.copyWith(color: M.onAccent),
                ),
              ),
              _FactRow('Student', '$studentName · $invoicePeriodLabel'),
              _FactRow('Method', methodLabel),
              _FactRow('Receipt no.', receiptRef),
              _FactRow('Recorded', recordedLabel),
              _FactRow(
                'Balance',
                '$currency ${balance.toStringAsFixed(2)}',
                emphasize: true,
                heavyRule: true,
              ),
              Padding(
                padding: const EdgeInsets.all(M.gutter),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _InkAction(
                      label: guardianName != null
                          ? 'Send receipt to $guardianName'
                          : 'Send receipt',
                      marker: '↗',
                      onPressed: () => ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text(
                            guardianName != null
                                ? '$guardianName was notified automatically when this payment was recorded.'
                                : 'No guardian is on file to notify.',
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: M.s2),
                    SizedBox(
                      width: double.infinity,
                      height: M.actionHeight,
                      child: OutlinedButton(
                        onPressed: () => _done(context),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: scheme.onSurface,
                          padding: const EdgeInsets.symmetric(horizontal: M.s4),
                          alignment: Alignment.centerLeft,
                        ),
                        child: const Text('Back to student', style: M.actionLabel),
                      ),
                    ),
                    const SizedBox(height: M.s3),
                    Text(
                      fullyPaid
                          ? 'This invoice is now fully paid.'
                          : '$currency ${balance.toStringAsFixed(2)} remains outstanding on this invoice.',
                      style: M.meta.copyWith(color: scheme.onSurfaceVariant),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// A label/value fact row — label as an all-caps kicker on the left, plain value on the right.
/// The mirror image of `MRow`'s own title-left/value-right shape, matching this screen's own
/// prototype layout; [heavyRule] switches the row's bottom border from 1px (`MRowRule`'s weight)
/// to 2px (`MRule`'s) for the Balance row, which the prototype treats as the list's close, not
/// just another fact.
class _FactRow extends StatelessWidget {
  const _FactRow(this.label, this.value, {this.emphasize = false, this.heavyRule = false});

  final String label;
  final String value;
  final bool emphasize;
  final bool heavyRule;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(
            color: heavyRule ? scheme.outline : scheme.outlineVariant,
            width: heavyRule ? 2 : 1,
          ),
        ),
      ),
      padding: const EdgeInsets.symmetric(horizontal: M.gutter, vertical: M.s3),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label.toUpperCase(),
              style: M.kicker.copyWith(letterSpacing: 1.1, color: scheme.onSurfaceVariant),
            ),
          ),
          const SizedBox(width: M.s3),
          Text(value, style: emphasize ? M.dataSmall : M.body.copyWith(fontSize: 15)),
        ],
      ),
    );
  }
}

/// The same full-width, flush-left, marker-right shape as `MPrimaryAction`, but ink-filled
/// instead of accent — this screen's poster block above is already this system's one accent
/// element (README: "Red as a field only for a poster statement... receipt confirmation"), so
/// the button below it deliberately isn't a second `MPrimaryAction`.
class _InkAction extends StatelessWidget {
  const _InkAction({required this.label, required this.onPressed, this.marker = '→'});

  final String label;
  final VoidCallback onPressed;
  final String marker;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: M.actionHeight,
      child: ElevatedButton(
        onPressed: onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: M.ink,
          foregroundColor: M.ground,
          padding: const EdgeInsets.symmetric(horizontal: M.s4),
        ),
        child: Row(
          children: [
            Expanded(child: Text(label, style: M.actionLabel, overflow: TextOverflow.ellipsis)),
            Text(marker, style: M.actionLabel.copyWith(fontSize: 18)),
          ],
        ),
      ),
    );
  }
}
