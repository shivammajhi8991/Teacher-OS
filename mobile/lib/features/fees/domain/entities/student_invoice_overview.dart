/// Mirrors backend `StudentInvoiceOverviewItem` (fees.service.ts) — the same shape as
/// `InvoiceSummary`, plus who it belongs to. The only place this app ever mixes more than one
/// student's invoices into a single list, so it's the only invoice shape that needs a student
/// id/name on it at all.
class StudentInvoiceOverview {
  const StudentInvoiceOverview({
    required this.invoiceId,
    required this.studentId,
    required this.studentName,
    required this.billingPeriodStart,
    required this.billingPeriodEnd,
    required this.totalAmount,
    required this.paidTotal,
    required this.currency,
    required this.status,
    required this.dueDate,
  });

  final String invoiceId;
  final String studentId;
  final String studentName;
  final String billingPeriodStart;
  final String billingPeriodEnd;
  final double totalAmount;
  final double paidTotal;
  final String currency;
  final String status; // 'issued' | 'paid' | 'partial' | 'overdue' | 'void'
  final String dueDate; // ISO date (yyyy-MM-dd)

  double get amountDue => (totalAmount - paidTotal).clamp(0, double.infinity);

  /// Computed client-side from [dueDate] rather than sent by the server — same convention as
  /// [amountDue]. 0 or negative means not yet (or not currently) late.
  int daysLate(DateTime now) {
    final due = DateTime.parse(dueDate);
    return DateTime(now.year, now.month, now.day).difference(due).inDays;
  }
}
