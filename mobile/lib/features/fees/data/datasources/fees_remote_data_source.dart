import 'package:dio/dio.dart';

class FeesRemoteDataSource {
  const FeesRemoteDataSource(this._dio);

  final Dio _dio;

  Future<List<dynamic>> getStudentInvoices(String studentId) async {
    final response = await _dio.get('/students/$studentId/invoices');
    return response.data as List<dynamic>;
  }

  /// docs/08 §8.2 "Fees overview" — the cross-student list `GET /students/:id/invoices` can't
  /// give. Scoping (which students' invoices come back) is entirely server-side, same as every
  /// other role-scoped list in this app (`GET /students`, `GET /calendar`) — this call carries no
  /// owner filter, only `status`.
  Future<List<dynamic>> getInvoiceOverview({String status = 'outstanding'}) async {
    final response = await _dio.get('/invoices', queryParameters: {'status': status});
    return response.data as List<dynamic>;
  }

  Future<void> recordPayment({
    required String invoiceId,
    required double amount,
    required String method,
    required String idempotencyKey,
  }) {
    return _dio.post('/payments', data: {
      'invoiceId': invoiceId,
      'amount': amount,
      'method': method,
      'idempotencyKey': idempotencyKey,
    });
  }
}
