import 'package:dio/dio.dart';
import '../error/failure.dart';

/// The one place a [DioException] becomes a domain [Failure] — docs/04 §4.1's error envelope
/// ({error: {code, message, details}}) is unpacked here so no repository has to know Dio exists.
Failure mapDioExceptionToFailure(DioException exception) {
  switch (exception.type) {
    case DioExceptionType.connectionTimeout:
    case DioExceptionType.sendTimeout:
    case DioExceptionType.receiveTimeout:
    case DioExceptionType.connectionError:
      return const NetworkFailure();
    default:
      break;
  }

  final data = exception.response?.data;
  if (data is Map && data['error'] is Map) {
    final error = data['error'] as Map;
    return ApiFailure(
      message: (error['message'] as String?) ?? 'Request failed',
      code: (error['code'] as String?) ?? 'UNEXPECTED_ERROR',
      statusCode: exception.response?.statusCode,
    );
  }

  return UnexpectedFailure(message: exception.message ?? 'Something went wrong');
}
