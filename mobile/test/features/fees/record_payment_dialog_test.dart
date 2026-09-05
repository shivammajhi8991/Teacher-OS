import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:teacheros/core/utils/result.dart';
import 'package:teacheros/features/fees/domain/entities/invoice_summary.dart';
import 'package:teacheros/features/fees/domain/repositories/fees_repository.dart';
import 'package:teacheros/features/fees/presentation/providers/fees_providers.dart';
import 'package:teacheros/features/fees/presentation/widgets/record_payment_dialog.dart';

class _FakeFeesRepository implements FeesRepository {
  ({String invoiceId, double amount, String method, String idempotencyKey})? lastCall;

  @override
  Future<Result<List<InvoiceSummary>>> getStudentInvoices(String studentId) =>
      throw UnimplementedError();

  @override
  Future<Result<void>> recordPayment({
    required String invoiceId,
    required double amount,
    required String method,
    required String idempotencyKey,
  }) async {
    lastCall = (invoiceId: invoiceId, amount: amount, method: method, idempotencyKey: idempotencyKey);
    return const Ok(null);
  }
}

const _invoice = InvoiceSummary(
  id: 'invoice-1',
  billingPeriodStart: '2026-01-01',
  billingPeriodEnd: '2026-01-31',
  subtotal: 1000,
  discountTotal: 0,
  creditNoteTotal: 0,
  totalAmount: 1000,
  paidTotal: 400,
  currency: 'INR',
  status: 'partial',
  dueDate: '2026-02-05',
);

// docs/08 §8.4 Fee Collection: "amount pre-filled with the exact pending total... method
// selection is single-tap chips."
void main() {
  testWidgets('pre-fills the amount with the pending total and submits the selected method', (
    tester,
  ) async {
    final fakeRepository = _FakeFeesRepository();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [feesRepositoryProvider.overrideWithValue(fakeRepository)],
        child: MaterialApp(
          home: Builder(
            builder: (context) => Scaffold(
              body: Center(
                child: ElevatedButton(
                  onPressed: () =>
                      showDialog<bool>(context: context, builder: (_) => const RecordPaymentDialog(invoice: _invoice)),
                  child: const Text('Open'),
                ),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('Open'));
    await tester.pumpAndSettle();

    // amountDue = totalAmount(1000) - paidTotal(400) = 600.
    expect(find.text('600.00'), findsOneWidget);

    await tester.tap(find.widgetWithText(ChoiceChip, 'UPI'));
    await tester.pumpAndSettle();

    await tester.tap(find.widgetWithText(FilledButton, 'Confirm'));
    await tester.pumpAndSettle();

    expect(fakeRepository.lastCall?.invoiceId, 'invoice-1');
    expect(fakeRepository.lastCall?.amount, 600);
    expect(fakeRepository.lastCall?.method, 'upi');
  });
}
