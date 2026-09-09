import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:teacheros/core/utils/result.dart';
import 'package:teacheros/features/fees/domain/entities/invoice_summary.dart';
import 'package:teacheros/features/fees/domain/entities/student_invoice_overview.dart';
import 'package:teacheros/features/fees/domain/repositories/fees_repository.dart';
import 'package:teacheros/features/fees/presentation/providers/fees_providers.dart';
import 'package:teacheros/features/fees/presentation/screens/receipt_screen.dart';
import 'package:teacheros/features/fees/presentation/screens/record_payment_screen.dart';

class _FakeFeesRepository implements FeesRepository {
  ({String invoiceId, double amount, String method, String idempotencyKey})? lastCall;

  @override
  Future<Result<List<InvoiceSummary>>> getStudentInvoices(String studentId) =>
      throw UnimplementedError();

  @override
  Future<Result<List<StudentInvoiceOverview>>> getInvoiceOverview({
    String status = 'outstanding',
  }) =>
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
//
// Modernist redesign (design_handoff_modernist/README.md): RecordPaymentDialog became a full
// screen (RecordPaymentScreen), and a successful record now pushes ReceiptScreen instead of just
// popping `true` — both rewritten below against that: method selection taps an `MSegmented`
// option instead of a `ChoiceChip`, "Confirm" is found by its dynamic "Confirm ... payment" text
// instead of a fixed "Confirm" label, and the test asserts the repository call directly rather
// than a pop result, then confirms ReceiptScreen actually renders with the paid amount.
void main() {
  testWidgets('pre-fills the amount with the pending total and submits the selected method', (
    tester,
  ) async {
    final fakeRepository = _FakeFeesRepository();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [feesRepositoryProvider.overrideWithValue(fakeRepository)],
        child: const MaterialApp(
          home: RecordPaymentScreen(invoice: _invoice, studentName: 'Aarav Shah'),
        ),
      ),
    );

    // amountDue = totalAmount(1000) - paidTotal(400) = 600.
    expect(find.text('600.00'), findsOneWidget);

    await tester.tap(find.text('UPI'));
    await tester.pumpAndSettle();

    await tester.tap(find.widgetWithText(ElevatedButton, 'Confirm UPI payment'));
    await tester.pumpAndSettle();

    expect(fakeRepository.lastCall?.invoiceId, 'invoice-1');
    expect(fakeRepository.lastCall?.amount, 600);
    expect(fakeRepository.lastCall?.method, 'upi');

    // A successful record replaces this screen with the receipt, not a pop.
    expect(find.byType(ReceiptScreen), findsOneWidget);
    expect(find.text('INR 600.00'), findsOneWidget);
  });
}
