import '../../domain/entities/invoice_summary.dart';

class InvoiceSummaryDto {
  const InvoiceSummaryDto({
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

  factory InvoiceSummaryDto.fromJson(Map<String, dynamic> json) => InvoiceSummaryDto(
        id: json['id'] as String,
        billingPeriodStart: json['billingPeriodStart'] as String,
        billingPeriodEnd: json['billingPeriodEnd'] as String,
        subtotal: (json['subtotal'] as num).toDouble(),
        discountTotal: (json['discountTotal'] as num).toDouble(),
        creditNoteTotal: (json['creditNoteTotal'] as num).toDouble(),
        totalAmount: (json['totalAmount'] as num).toDouble(),
        paidTotal: (json['paidTotal'] as num).toDouble(),
        currency: json['currency'] as String,
        status: json['status'] as String,
        dueDate: json['dueDate'] as String,
      );

  final String id;
  final String billingPeriodStart;
  final String billingPeriodEnd;
  final double subtotal;
  final double discountTotal;
  final double creditNoteTotal;
  final double totalAmount;
  final double paidTotal;
  final String currency;
  final String status;
  final String dueDate;

  InvoiceSummary toEntity() => InvoiceSummary(
        id: id,
        billingPeriodStart: billingPeriodStart,
        billingPeriodEnd: billingPeriodEnd,
        subtotal: subtotal,
        discountTotal: discountTotal,
        creditNoteTotal: creditNoteTotal,
        totalAmount: totalAmount,
        paidTotal: paidTotal,
        currency: currency,
        status: status,
        dueDate: dueDate,
      );
}
