import 'dart:typed_data';
import 'package:dio/dio.dart';

class RawFileResponse {
  const RawFileResponse({required this.bytes, required this.filename, required this.contentType});

  final Uint8List bytes;
  final String filename;
  final String contentType;
}

class ReportsRemoteDataSource {
  const ReportsRemoteDataSource(this._dio);

  final Dio _dio;

  Future<RawFileResponse> generateAttendanceReport({
    required String from,
    required String to,
    required String format,
  }) {
    return _getFile('/reports/attendance', {'from': from, 'to': to, 'format': format});
  }

  Future<RawFileResponse> generateFeesReport({
    required String from,
    required String to,
    required String format,
  }) {
    return _getFile('/reports/fees', {'from': from, 'to': to, 'format': format});
  }

  Future<RawFileResponse> generateStudentReport(String studentId) {
    return _getFile('/reports/students/$studentId', {'format': 'pdf'});
  }

  Future<RawFileResponse> _getFile(String path, Map<String, dynamic> query) async {
    final response = await _dio.get<List<int>>(
      path,
      queryParameters: query,
      options: Options(responseType: ResponseType.bytes),
    );
    final contentType = response.headers.value('content-type') ?? 'application/octet-stream';
    final disposition = response.headers.value('content-disposition');
    final filename = _filenameFrom(disposition) ?? 'report';
    return RawFileResponse(
      bytes: Uint8List.fromList(response.data ?? const []),
      filename: filename,
      contentType: contentType.split(';').first.trim(),
    );
  }

  String? _filenameFrom(String? contentDisposition) {
    if (contentDisposition == null) return null;
    final match = RegExp('filename="?([^"]+)"?').firstMatch(contentDisposition);
    return match?.group(1);
  }
}
