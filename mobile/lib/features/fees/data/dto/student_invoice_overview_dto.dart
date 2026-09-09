import '../../domain/entities/student_invoice_overview.dart';

class StudentInvoiceOverviewDto {
  const StudentInvoiceOverviewDto({
    required this.id,
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

  factory StudentInvoiceOverviewDto.fromJson(Map<String, dynamic> json) =>
      StudentInvoiceOverviewDto(
        id: json['id'] as String,
        studentId: json['studentId'] as String,
        studentName: json['studentName'] as String,
        billingPeriodStart: json['billingPeriodStart'] as String,
        billingPeriodEnd: json['billingPeriodEnd'] as String,
        totalAmount: (json['totalAmount'] as num).toDouble(),
        paidTotal: (json['paidTotal'] as num).toDouble(),
        currency: json['currency'] as String,
        status: json['status'] as String,
        dueDate: json['dueDate'] as String,
      );

  final String id;
  final String studentId;
  final String studentName;
  final String billingPeriodStart;
  final String billingPeriodEnd;
  final double totalAmount;
  final double paidTotal;
  final String currency;
  final String status;
  final String dueDate;

  StudentInvoiceOverview toEntity() => StudentInvoiceOverview(
        invoiceId: id,
        studentId: studentId,
        studentName: studentName,
        billingPeriodStart: billingPeriodStart,
        billingPeriodEnd: billingPeriodEnd,
        totalAmount: totalAmount,
        paidTotal: paidTotal,
        currency: currency,
        status: status,
        dueDate: dueDate,
      );
}
