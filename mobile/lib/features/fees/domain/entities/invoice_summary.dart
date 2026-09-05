/// Mirrors backend `InvoiceSummary` (fees.service.ts) — already net of credit notes, with the
/// paid-so-far total, so the mobile UI never has to re-derive "how much is actually owed."
class InvoiceSummary {
  const InvoiceSummary({
    required this.id,
    required this.billingPeriodStart,
    required this.billingPeriodEnd,
    required this.subtotal,
    required this.discountTotal,
    required this.creditNoteTotal,
    required this.totalAmount,
    required this.paidTotal,
    required this.currency,
    required this.status,
    required this.dueDate,
  });

  final String id;
  final String billingPeriodStart;
  final String billingPeriodEnd;
  final double subtotal;
  final double discountTotal;
  final double creditNoteTotal;
  final double totalAmount; // net of credit notes — what's actually owed in total
  final double paidTotal;
  final String currency;
  final String status; // 'issued' | 'paid' | 'partial' | 'overdue' | 'void'
  final String dueDate;

  double get amountDue => (totalAmount - paidTotal).clamp(0, double.infinity);
}
