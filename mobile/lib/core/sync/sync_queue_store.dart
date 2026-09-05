import 'pending_action.dart';
import 'json_file_store.dart';

/// docs/05 §5.4 — the local `sync_queue` mirror. Stored as `{items: [...]}` under one JSON file
/// key rather than one-row-per-item, since the whole queue is read/written together anyway
/// (queue sizes here are small — a handful of pending attendance sessions at most).
class SyncQueueStore {
  SyncQueueStore() : _store = JsonFileStore('sync_queue.json');

  final JsonFileStore _store;

  Future<List<PendingAction>> readAll() async {
    final data = await _store.readMap();
    final items = (data['items'] as List<dynamic>?) ?? const [];
    return items.map((e) => PendingAction.fromJson(Map<String, dynamic>.from(e as Map))).toList();
  }

  Future<void> enqueue(PendingAction action) async {
    final items = await readAll();
    items.add(action);
    await _writeAll(items);
  }

  Future<void> remove(String id) async {
    final items = await readAll();
    items.removeWhere((item) => item.id == id);
    await _writeAll(items);
  }

  Future<void> updateError(String id, String error) async {
    final items = await readAll();
    final index = items.indexWhere((item) => item.id == id);
    if (index == -1) return;
    items[index] = items[index].withError(error);
    await _writeAll(items);
  }

  Future<void> _writeAll(List<PendingAction> items) {
    return _store.writeMap({'items': items.map((i) => i.toJson()).toList()});
  }
}
