import '../../../../core/utils/result.dart';
import '../entities/invoice_summary.dart';
import '../entities/student_invoice_overview.dart';

abstract interface class FeesRepository {
  /// docs/04 §4.4 GET /students/:id/invoices.
  Future<Result<List<InvoiceSummary>>> getStudentInvoices(String studentId);

  /// docs/08 §8.2 "Fees overview" — GET /invoices, scoped server-side to the caller's own
  /// students (teacher), institute (institute_admin), or everything (super_admin).
  /// `status: 'outstanding'` (the default) excludes invoices with nothing left owed.
  Future<Result<List<StudentInvoiceOverview>>> getInvoiceOverview({
    String status = 'outstanding',
  });

  /// docs/08 §8.4 Fee Collection's Record Payment step. `idempotencyKey` is client-generated
  /// (docs/01 §1.5 "duplicate payment") — a retry with the same key is always safe.
  Future<Result<void>> recordPayment({
    required String invoiceId,
    required double amount,
    required String method, // 'cash' | 'upi' | 'bank_transfer'
    required String idempotencyKey,
  });
}
