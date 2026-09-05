import 'package:dio/dio.dart';

class NotesRemoteDataSource {
  const NotesRemoteDataSource(this._dio);

  final Dio _dio;

  /// GET /documents — every doc.manage app-role sees: their own uploads plus anything shared
  /// with them (institute/class/student targets, resolved server-side). No `classId` filter
  /// exists on this endpoint (docs/03 §3.8's `folder_name` is a plain tag, not a queryable
  /// class relation) — see notes_repository_impl.dart for how the class-scoped view is built
  /// from this.
  Future<List<dynamic>> listDocuments() async {
    final response = await _dio.get('/documents');
    return response.data as List<dynamic>;
  }

  Future<Map<String, dynamic>> createDocument({
    required String title,
    required String externalUrl,
    String? folderName,
    String? expiryDate,
  }) async {
    final response = await _dio.post('/documents', data: {
      'title': title,
      'fileType': 'link',
      'externalUrl': externalUrl,
      if (folderName != null) 'folderName': folderName,
      if (expiryDate != null) 'expiryDate': expiryDate,
    });
    return response.data as Map<String, dynamic>;
  }

  Future<void> createShare({
    required String documentId,
    required String sharedWithType,
    required String sharedWithId,
    bool allowDownload = true,
  }) {
    return _dio.post('/documents/$documentId/share', data: {
      'sharedWithType': sharedWithType,
      'sharedWithId': sharedWithId,
      'allowDownload': allowDownload,
    });
  }
}
