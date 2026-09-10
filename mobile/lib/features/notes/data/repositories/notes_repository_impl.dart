import 'dart:convert';
import 'dart:typed_data';
import 'package:dio/dio.dart';
import '../../../../core/error/failure.dart';
import '../../../../core/network/api_exception_mapper.dart';
import '../../../../core/utils/result.dart';
import '../../domain/entities/document_summary.dart';
import '../../domain/repositories/notes_repository.dart';
import '../datasources/notes_remote_data_source.dart';
import '../dto/document_summary_dto.dart';

class NotesRepositoryImpl implements NotesRepository {
  const NotesRepositoryImpl(this._remoteDataSource);

  final NotesRemoteDataSource _remoteDataSource;

  @override
  Future<Result<List<DocumentSummary>>> getClassLinkNotes(String classId) async {
    try {
      final json = await _remoteDataSource.listDocuments();
      final documents = json
          .map((item) => DocumentSummaryDto.fromJson(item as Map<String, dynamic>).toEntity())
          .where((d) => d.folderName == classId)
          .toList()
        ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
      return Ok(documents);
    } on DioException catch (e) {
      return Err(mapDioExceptionToFailure(e));
    }
  }

  @override
  Future<Result<void>> shareLinkWithClass({
    required String classId,
    required String title,
    required String url,
    DateTime? expiryDate,
  }) async {
    // Two sequential calls, not one atomic backend operation — if createShare fails after
    // createDocument already succeeded, the document exists (owned by the caller, visible to
    // them under "own uploads") but isn't shared with the class yet. There's no mobile retry UI
    // for that partial state in this pass; the caller sees the failure and can just try again,
    // which creates a second document rather than resuming the first — an acceptable rough edge
    // for now, not a silent data-loss risk.
    try {
      final created = await _remoteDataSource.createDocument(
        title: title,
        externalUrl: url,
        folderName: classId,
        expiryDate: expiryDate?.toIso8601String(),
      );
      await _remoteDataSource.createShare(
        documentId: created['id'] as String,
        sharedWithType: 'class',
        sharedWithId: classId,
      );
      return const Ok(null);
    } on DioException catch (e) {
      return Err(mapDioExceptionToFailure(e));
    }
  }

  @override
  Future<Result<Uint8List>> downloadFile(String documentId) async {
    try {
      return Ok(await _remoteDataSource.downloadFile(documentId));
    } on DioException catch (e) {
      return Err(_mapBytesError(e));
    }
  }

  /// Matching `reports_repository_impl.dart`'s identical precedent: a `ResponseType.bytes`
  /// request means an *error* response also arrives as raw bytes, not the decoded JSON envelope
  /// `mapDioExceptionToFailure` expects, so a real `{code, message}` (e.g. "This shared content
  /// has expired") would otherwise be silently downgraded to a generic "Something went wrong".
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
