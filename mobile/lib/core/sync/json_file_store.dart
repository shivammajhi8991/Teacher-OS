import 'dart:convert';
import 'dart:io';
import 'package:path_provider/path_provider.dart';

/// Shared JSON-file persistence for [SyncQueueStore] and [OfflineCacheStore]. Deliberately not
/// Drift/SQLite — docs/05 §5.4 originally planned a Drift-backed local mirror, but Drift needs
/// `build_runner` codegen this environment can't run (no Flutter SDK available while this was
/// authored). A plain JSON file behind the same read/write shape is a straightforward swap-in
/// once codegen is available — nothing above this class needs to change.
class JsonFileStore {
  JsonFileStore(this._fileName);

  final String _fileName;
  File? _cachedFile;

  Future<File> _file() async {
    if (_cachedFile != null) return _cachedFile!;
    final dir = await getApplicationDocumentsDirectory();
    _cachedFile = File('${dir.path}/$_fileName');
    return _cachedFile!;
  }

  Future<Map<String, dynamic>> readMap() async {
    final file = await _file();
    if (!await file.exists()) return {};
    try {
      final content = await file.readAsString();
      if (content.trim().isEmpty) return {};
      return Map<String, dynamic>.from(jsonDecode(content) as Map);
    } catch (_) {
      // Corrupt/partial write (e.g. app killed mid-write) — start clean rather than crash the
      // app on every launch; the queue/cache is recoverable data, not a source of truth.
      return {};
    }
  }

  Future<void> writeMap(Map<String, dynamic> data) async {
    final file = await _file();
    await file.writeAsString(jsonEncode(data));
  }
}
