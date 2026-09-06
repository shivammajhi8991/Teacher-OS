import 'dart:convert';
import 'package:dio/dio.dart';
import '../../../../core/error/failure.dart';
import '../../../../core/network/api_exception_mapper.dart';
import '../../../../core/utils/result.dart';
import '../../domain/entities/generated_report.dart';
import '../../domain/repositories/reports_repository.dart';
import '../datasources/reports_remote_data_source.dart';

class ReportsRepositoryImpl implements ReportsRepository {
  const ReportsRepositoryImpl(this._remoteDataSource);

  final ReportsRemoteDataSource _remoteDataSource;

  @override
  Future<Result<GeneratedReport>> generateAttendanceReport({
    required String from,
    required String to,
    required String format,
  }) {
    return _run(() => _remoteDataSource.generateAttendanceReport(from: from, to: to, format: format));
  }

  @override
  Future<Result<GeneratedReport>> generateFeesReport({
    required String from,
    required String to,
    required String format,
  }) {
    return _run(() => _remoteDataSource.generateFeesReport(from: from, to: to, format: format));
  }

  @override
  Future<Result<GeneratedReport>> generateStudentReport(String studentId) {
    return _run(() => _remoteDataSource.generateStudentReport(studentId));
  }

  Future<Result<GeneratedReport>> _run(Future<RawFileResponse> Function() call) async {
    try {
      final response = await call();
      return Ok(
        GeneratedReport(
          bytes: response.bytes,
          filename: response.filename,
          contentType: response.contentType,
        ),
      );
    } on DioException catch (e) {
      return Err(_mapBytesError(e));
    }
  }

  /// A request made with `ResponseType.bytes` (required to read a file response at all) means an
  /// *error* response's body arrives as raw bytes too, not the decoded JSON envelope
  /// `mapDioExceptionToFailure` expects — so a real `{code, message}` from the server would
  /// otherwise be silently downgraded to a generic "Something went wrong". Decoded here, once,
  /// rather than teaching the shared mapper about a response type only this feature ever uses.
  Failure _mapBytesError(DioException e) {
    final data = e.response?.data;
    if (data is List<int>) {
      try {
        final decoded = jsonDecode(utf8.decode(data));
        if (decoded is Map && decoded['error'] is Map) {
          final error = decoded['error'] as Map;
          return ApiFailure(
            message: (error['message'] as String?) ?? 'Request failed',
            code: (error['code'] as String?) ?? 'UNEXPECTED_ERROR',
            statusCode: e.response?.statusCode,
          );
        }
      } catch (_) {
        // Not decodable JSON — fall through to the generic mapper below.
      }
    }
    return mapDioExceptionToFailure(e);
  }
}
