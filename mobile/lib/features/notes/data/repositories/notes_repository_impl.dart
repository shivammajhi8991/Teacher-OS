import 'package:dio/dio.dart';
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
}
