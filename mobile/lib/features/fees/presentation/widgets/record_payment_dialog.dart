import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';
import '../../domain/entities/invoice_summary.dart';
import '../providers/fees_providers.dart';

/// docs/08 §8.4 Fee Collection: "amount pre-filled with the exact pending total... method
/// selection is single-tap chips." Returns `true` via Navigator.pop on a successful record so the
/// caller can refresh. Receipt generation/sharing is a documented follow-up — this pass confirms
/// the payment was recorded and updates the invoice, but doesn't produce a shareable PDF yet.
class RecordPaymentDialog extends ConsumerStatefulWidget {
  const RecordPaymentDialog({super.key, required this.invoice});

  final InvoiceSummary invoice;

  @override
  ConsumerState<RecordPaymentDialog> createState() => _RecordPaymentDialogState();
}

class _RecordPaymentDialogState extends ConsumerState<RecordPaymentDialog> {
  late final _amountController = TextEditingController(text: widget.invoice.amountDue.toStringAsFixed(2));
  String _method = 'cash';
  bool _isSubmitting = false;
  String? _errorMessage;

  @override
  void dispose() {
    _amountController.dispose();
    super.dispose();
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

    final result = await ref.read(feesRepositoryProvider).recordPayment(
          invoiceId: widget.invoice.id,
          amount: amount,
          method: _method,
          idempotencyKey: const Uuid().v4(),
        );

    if (!mounted) return;
    result.fold(
      (failure) => setState(() {
        _isSubmitting = false;
        _errorMessage = failure.message;
      }),
      (_) => Navigator.of(context).pop(true),
    );
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Record payment'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Pending: ${widget.invoice.currency} ${widget.invoice.amountDue.toStringAsFixed(2)}',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _amountController,
            decoration: const InputDecoration(labelText: 'Amount'),
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            children: [
              ChoiceChip(
                label: const Text('Cash'),
                selected: _method == 'cash',
                onSelected: (_) => setState(() => _method = 'cash'),
              ),
              ChoiceChip(
                label: const Text('UPI'),
                selected: _method == 'upi',
                onSelected: (_) => setState(() => _method = 'upi'),
              ),
              ChoiceChip(
                label: const Text('Bank Transfer'),
                selected: _method == 'bank_transfer',
                onSelected: (_) => setState(() => _method = 'bank_transfer'),
              ),
            ],
          ),
          if (_errorMessage != null) ...[
            const SizedBox(height: 12),
            Text(_errorMessage!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
          ],
        ],
      ),
      actions: [
        TextButton(
          onPressed: _isSubmitting ? null : () => Navigator.of(context).pop(false),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: _isSubmitting ? null : _confirm,
          child: _isSubmitting
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Text('Confirm'),
        ),
      ],
    );
  }
}
