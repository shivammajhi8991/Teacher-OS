import 'package:dio/dio.dart';
import '../../../../core/network/api_exception_mapper.dart';
import '../../../../core/utils/result.dart';
import '../../domain/entities/invoice_summary.dart';
import '../../domain/repositories/fees_repository.dart';
import '../datasources/fees_remote_data_source.dart';
import '../dto/invoice_summary_dto.dart';

class FeesRepositoryImpl implements FeesRepository {
  const FeesRepositoryImpl(this._remoteDataSource);

  final FeesRemoteDataSource _remoteDataSource;

  @override
  Future<Result<List<InvoiceSummary>>> getStudentInvoices(String studentId) async {
    try {
      final json = await _remoteDataSource.getStudentInvoices(studentId);
      final invoices = json
          .map((item) => InvoiceSummaryDto.fromJson(item as Map<String, dynamic>).toEntity())
          .toList();
      return Ok(invoices);
    } on DioException catch (e) {
      return Err(mapDioExceptionToFailure(e));
    }
  }

  @override
  Future<Result<void>> recordPayment({
    required String invoiceId,
    required double amount,
    required String method,
    required String idempotencyKey,
  }) async {
    try {
      await _remoteDataSource.recordPayment(
        invoiceId: invoiceId,
        amount: amount,
        method: method,
        idempotencyKey: idempotencyKey,
      );
      return const Ok(null);
    } on DioException catch (e) {
      return Err(mapDioExceptionToFailure(e));
    }
  }
}
