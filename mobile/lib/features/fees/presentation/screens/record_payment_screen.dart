import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';
import '../../../../core/theme/modernist.dart';
import '../../../../core/widgets/modernist_primitives.dart';
import '../../domain/entities/invoice_summary.dart';
import '../providers/fees_providers.dart';
import 'receipt_screen.dart';

/// docs/08 §8.4 Fee Collection: "amount pre-filled with the exact pending total... method
/// selection is single-tap chips."
///
/// Modernist redesign (design_handoff_modernist/README.md, "Record payment" row of the "Not
/// implemented in Dart" table): the old `RecordPaymentDialog` becomes a full screen — "Pending
/// amount at M.display on M.surface; amount field at M.data; Full / Half / Other quick chips;
/// MSegmented for Cash / UPI / Bank transfer; MPrimaryAction 'Confirm cash payment'." Same
/// repository call as before (`feesRepositoryProvider.recordPayment`, same client-generated
/// idempotency key), same validation — this is a visual/layout change, not a new flow. The one
/// addition: a successful record now replaces this screen with [ReceiptScreen] instead of just
/// popping `true` — "a receipt is generated on confirm" per both the README and the prototype's
/// own footnote text below the Confirm button.
class RecordPaymentScreen extends ConsumerStatefulWidget {
  const RecordPaymentScreen({
    super.key,
    required this.invoice,
    required this.studentName,
    this.guardianName,
  });

  final InvoiceSummary invoice;
  final String studentName;

  /// The primary (or first) guardian on file, if any — used only for the footnote copy and to
  /// pass through to [ReceiptScreen]'s "send receipt" action. Never fabricated when null; the
  /// copy and that action adjust instead of naming a guardian that doesn't exist.
  final String? guardianName;

  @override
  ConsumerState<RecordPaymentScreen> createState() => _RecordPaymentScreenState();
}

class _RecordPaymentScreenState extends ConsumerState<RecordPaymentScreen> {
  late final _amountController =
      TextEditingController(text: widget.invoice.amountDue.toStringAsFixed(2));
  final _amountFocusNode = FocusNode();
  String _method = 'cash';
  bool _isSubmitting = false;
  String? _errorMessage;

  @override
  void dispose() {
    _amountController.dispose();
    _amountFocusNode.dispose();
    super.dispose();
  }

  void _setAmount(double value) {
    setState(() => _amountController.text = value.toStringAsFixed(2));
  }

  void _pickOtherAmount() {
    _amountController.clear();
    _amountFocusNode.requestFocus();
  }

  Future<void> _confirm() async {
    final amount = double.tryParse(_amountController.text.trim());
    if (amount == null || amount <= 0) {
      setState(() => _errorMessage = 'Enter a valid amount');
      return;
    }
    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    final idempotencyKey = const Uuid().v4();
    final result = await ref.read(feesRepositoryProvider).recordPayment(
          invoiceId: widget.invoice.id,
          amount: amount,
          method: _method,
          idempotencyKey: idempotencyKey,
        );

    if (!mounted) return;
    result.fold(
      (failure) => setState(() {
        _isSubmitting = false;
        _errorMessage = failure.message;
      }),
      (_) {
        final double balance = (widget.invoice.amountDue - amount).clamp(0, double.infinity);
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(
            builder: (_) => ReceiptScreen(
              studentName: widget.studentName,
              invoicePeriodLabel:
                  '${widget.invoice.billingPeriodStart} – ${widget.invoice.billingPeriodEnd}',
              methodLabel: _methodLabel(_method),
              receiptRef: idempotencyKey,
              recordedAt: DateTime.now(),
              currency: widget.invoice.currency,
              paidAmount: amount,
              balance: balance,
              guardianName: widget.guardianName,
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final invoice = widget.invoice;

    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(M.gutter, M.s1, M.gutter, M.s4),
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
                        Text(
                          '${widget.studentName} · ${invoice.billingPeriodStart} – ${invoice.billingPeriodEnd}',
                          style: M.kicker.copyWith(letterSpacing: 1.32, color: scheme.onSurfaceVariant),
                        ),
                        const SizedBox(height: 7),
                        const Text('Record payment', style: M.sectionTitle),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const MRule(),
            Container(
              color: scheme.surfaceContainerLow,
              padding: const EdgeInsets.fromLTRB(M.gutter, M.s4, M.gutter, M.s4),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Pending'.toUpperCase(), style: M.kicker.copyWith(letterSpacing: 1.32)),
                  const SizedBox(height: M.s2),
                  Text(
                    '${invoice.currency} ${invoice.amountDue.toStringAsFixed(2)}',
                    style: M.display,
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Due ${invoice.dueDate}',
                    style: M.body.copyWith(fontSize: 13, color: scheme.onSurfaceVariant),
                  ),
                ],
              ),
            ),
            const MRule(),
            Padding(
              padding: const EdgeInsets.fromLTRB(M.gutter, M.s4, M.gutter, 0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Amount received'.toUpperCase(),
                    style: M.kicker.copyWith(letterSpacing: 1.32, color: scheme.onSurfaceVariant),
                  ),
                  const SizedBox(height: M.s2),
                  Container(
                    height: 60,
                    alignment: Alignment.centerLeft,
                    padding: const EdgeInsets.symmetric(horizontal: M.s4),
                    decoration: BoxDecoration(border: Border.all(color: scheme.outline)),
                    child: TextField(
                      controller: _amountController,
                      focusNode: _amountFocusNode,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      style: M.data.copyWith(color: scheme.onSurface),
                      decoration: const InputDecoration(
                        border: InputBorder.none,
                        isDense: true,
                        contentPadding: EdgeInsets.zero,
                      ),
                    ),
                  ),
                  const SizedBox(height: M.s3),
                  Row(
                    children: [
                      _QuickAmountChip(
                        label: 'Full amount',
                        filled: true,
                        onPressed: () => _setAmount(invoice.amountDue),
                      ),
                      const SizedBox(width: M.s2),
                      _QuickAmountChip(
                        label: 'Half',
                        onPressed: () => _setAmount(invoice.amountDue / 2),
                      ),
                      const SizedBox(width: M.s2),
                      _QuickAmountChip(label: 'Other', onPressed: _pickOtherAmount),
                    ],
                  ),
                  const SizedBox(height: M.s6),
                  Text(
                    'Method'.toUpperCase(),
                    style: M.kicker.copyWith(letterSpacing: 1.32, color: scheme.onSurfaceVariant),
                  ),
                  const SizedBox(height: M.s2),
                  MSegmented<String>(
                    options: const [
                      (value: 'cash', label: 'Cash'),
                      (value: 'upi', label: 'UPI'),
                      (value: 'bank_transfer', label: 'Bank transfer'),
                    ],
                    value: _method,
                    onChanged: (v) => setState(() => _method = v),
                  ),
                  if (_errorMessage != null) ...[
                    const SizedBox(height: M.s3),
                    Text(_errorMessage!, style: M.body.copyWith(color: scheme.error)),
                  ],
                  const SizedBox(height: M.s6),
                  MPrimaryAction(
                    label: 'Confirm ${_methodPhrase(_method)} payment',
                    onPressed: _isSubmitting ? null : _confirm,
                    busy: _isSubmitting,
                  ),
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: M.s3),
                    child: Text(
                      widget.guardianName != null
                          ? 'A receipt is generated on confirm and can be sent to ${widget.guardianName} straight away.'
                          : 'A receipt is generated on confirm.',
                      style: M.meta.copyWith(color: scheme.onSurfaceVariant),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Title-cased for the Method segmented control's option labels and the Receipt screen's own
/// "Method" fact.
String _methodLabel(String method) => switch (method) {
      'cash' => 'Cash',
      'upi' => 'UPI',
      'bank_transfer' => 'Bank transfer',
      _ => method,
    };

/// Lower-cased for "Confirm … payment" — matches the prototype's own dynamic button text.
String _methodPhrase(String method) => switch (method) {
      'cash' => 'cash',
      'upi' => 'UPI',
      'bank_transfer' => 'bank transfer',
      _ => method,
    };

/// A 44px quick-amount preset. The prototype specs these at 40px, but this system's own stated
/// deviation from the web spec ("Minimum tap target is 44px, not the sheet's 36px") applies here
/// too — these are still primary interactive controls, just secondary in emphasis to the amount
/// field itself, so they get the system's floor rather than the prototype's un-adapted figure.
class _QuickAmountChip extends StatelessWidget {
  const _QuickAmountChip({required this.label, required this.onPressed, this.filled = false});

  final String label;
  final VoidCallback onPressed;
  final bool filled;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return SizedBox(
      height: M.tapMin,
      child: filled
          ? ElevatedButton(
              onPressed: onPressed,
              style: ElevatedButton.styleFrom(
                backgroundColor: M.ink,
                foregroundColor: M.ground,
                padding: const EdgeInsets.symmetric(horizontal: M.s3),
              ),
              child: Text(label, style: M.label),
            )
          : OutlinedButton(
              onPressed: onPressed,
              style: OutlinedButton.styleFrom(
                foregroundColor: scheme.onSurface,
                padding: const EdgeInsets.symmetric(horizontal: M.s3),
              ),
              child: Text(label, style: M.label),
            ),
    );
  }
}

/// Same shape as `student_detail_screen.dart`'s own `_SquareIconButton` — screen-local by the
/// same precedent set there, not promoted into `modernist_primitives.dart`.
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
