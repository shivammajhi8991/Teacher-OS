import 'package:dio/dio.dart';

class FeesRemoteDataSource {
  const FeesRemoteDataSource(this._dio);

  final Dio _dio;

  Future<List<dynamic>> getStudentInvoices(String studentId) async {
    final response = await _dio.get('/students/$studentId/invoices');
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
