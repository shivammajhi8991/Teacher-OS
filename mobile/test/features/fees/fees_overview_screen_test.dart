import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:teacheros/core/utils/result.dart';
import 'package:teacheros/features/fees/domain/entities/invoice_summary.dart';
import 'package:teacheros/features/fees/domain/entities/student_invoice_overview.dart';
import 'package:teacheros/features/fees/domain/repositories/fees_repository.dart';
import 'package:teacheros/features/fees/presentation/providers/fees_providers.dart';
import 'package:teacheros/features/fees/presentation/screens/fees_overview_screen.dart';

class _FakeFeesRepository implements FeesRepository {
  _FakeFeesRepository(this.overview);

  final List<StudentInvoiceOverview> overview;

  @override
  Future<Result<List<StudentInvoiceOverview>>> getInvoiceOverview({
    String status = 'outstanding',
  }) async =>
      Ok(overview);

  @override
  Future<Result<List<InvoiceSummary>>> getStudentInvoices(String studentId) =>
      throw UnimplementedError();

  @override
  Future<Result<void>> recordPayment({
    required String invoiceId,
    required double amount,
    required String method,
    required String idempotencyKey,
  }) =>
      throw UnimplementedError();
}

StudentInvoiceOverview _invoice({
  required String studentId,
  required String studentName,
  required double totalAmount,
  required String dueDate,
}) =>
    StudentInvoiceOverview(
      invoiceId: 'invoice-$studentId',
      studentId: studentId,
      studentName: studentName,
      billingPeriodStart: '2026-01-01',
      billingPeriodEnd: '2026-01-31',
      totalAmount: totalAmount,
      paidTotal: 0,
      currency: 'INR',
      status: 'overdue',
      dueDate: dueDate,
    );

// docs/08 §8.2 "Fees overview" — the cross-student list a teacher actually opens this screen
// for: the outstanding total, an overdue-first framing, and per-student amount + a real
// days-late/due-in tag computed client-side from dueDate (server sends no such field).
void main() {
  testWidgets('shows the outstanding total and a days-late tag on an overdue row', (
    tester,
  ) async {
    final now = DateTime.now();
    final overdueDate = now.subtract(const Duration(days: 12));
    final dueSoonDate = now.add(const Duration(days: 3));
    final fakeRepository = _FakeFeesRepository([
      _invoice(
        studentId: 'student-1',
        studentName: 'Aarav Shah',
        totalAmount: 1000,
        dueDate: overdueDate.toIso8601String().substring(0, 10),
      ),
      _invoice(
        studentId: 'student-2',
        studentName: 'Diya Mehta',
        totalAmount: 500,
        dueDate: dueSoonDate.toIso8601String().substring(0, 10),
      ),
    ]);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [feesRepositoryProvider.overrideWithValue(fakeRepository)],
        child: const MaterialApp(home: Scaffold(body: FeesOverviewScreen())),
      ),
    );
    await tester.pumpAndSettle();

    // Outstanding total sums both students; sub-line names the overdue count.
    expect(find.text('INR 1500'), findsOneWidget);
    expect(find.text('2 students · 1 overdue'), findsOneWidget);

    expect(find.text('Aarav Shah'), findsOneWidget);
    expect(find.text('Diya Mehta'), findsOneWidget);
    expect(find.text('12 DAYS LATE'), findsOneWidget);
    expect(find.text('DUE IN 3 DAYS'), findsOneWidget);
  });

  testWidgets('shows a paid-up empty state when nothing is outstanding', (tester) async {
    final fakeRepository = _FakeFeesRepository(const []);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [feesRepositoryProvider.overrideWithValue(fakeRepository)],
        child: const MaterialApp(home: Scaffold(body: FeesOverviewScreen())),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Everyone is paid up.'), findsOneWidget);
  });
}
