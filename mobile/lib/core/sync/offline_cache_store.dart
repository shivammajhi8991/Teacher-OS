import 'json_file_store.dart';

/// docs/05 §5.4 read path — "screens read from local cache first... instant, works offline."
/// Keyed by an arbitrary string the caller picks (e.g. `'roster:<classId>:<date>'`); this store
/// doesn't know or care what's cached, only how to get a JSON-encodable map back for a key.
class OfflineCacheStore {
  OfflineCacheStore() : _store = JsonFileStore('offline_cache.json');

  final JsonFileStore _store;

  Future<Map<String, dynamic>?> read(String key) async {
    final data = await _store.readMap();
    final entry = data[key];
    return entry == null ? null : Map<String, dynamic>.from(entry as Map);
  }

  Future<void> write(String key, Map<String, dynamic> value) async {
    final data = await _store.readMap();
    data[key] = value;
    await _store.writeMap(data);
  }
}
