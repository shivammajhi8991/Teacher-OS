import '../../../../core/utils/result.dart';
import '../entities/invoice_summary.dart';

abstract interface class FeesRepository {
  /// docs/04 §4.4 GET /students/:id/invoices.
  Future<Result<List<InvoiceSummary>>> getStudentInvoices(String studentId);

  /// docs/08 §8.4 Fee Collection's Record Payment step. `idempotencyKey` is client-generated
  /// (docs/01 §1.5 "duplicate payment") — a retry with the same key is always safe.
  Future<Result<void>> recordPayment({
    required String invoiceId,
    required double amount,
    required String method, // 'cash' | 'upi' | 'bank_transfer'
    required String idempotencyKey,
  });
}
