import 'dart:async';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'offline_cache_store.dart';
import 'pending_action.dart';
import 'sync_queue_store.dart';

/// Returns true once a queued action should be removed from the queue — either it succeeded, or
/// it failed in a way that will never succeed on retry (e.g. the class was cancelled server-side
/// in the meantime). Returns false for a transient failure (still offline, timeout) so the item
/// stays queued for the next drain.
typedef ActionReplayer = Future<bool> Function(Map<String, dynamic> payload);

enum SyncEngineStatus { synced, syncing, pending, error }

class SyncEngineState {
  const SyncEngineState({required this.status, required this.pendingCount});
  final SyncEngineStatus status;
  final int pendingCount;
}

/// docs/05 §5.4 — drains the offline queue on reconnect and periodically. Deliberately
/// feature-agnostic: it knows nothing about attendance specifically, only a map of
/// actionType → replay function that each offline-capable feature registers once (see
/// features/attendance/presentation/providers — the only registration that exists today).
/// A fancier multi-feature registry earns its complexity once a second offline-capable feature
/// exists; for now there's exactly one actionType, so a plain Map is the honest amount of code.
class SyncEngine extends Notifier<SyncEngineState> {
  final Map<String, ActionReplayer> _replayers = {};
  StreamSubscription<List<ConnectivityResult>>? _connectivitySub;
  Timer? _periodicTimer;

  @override
  SyncEngineState build() {
    ref.onDispose(() {
      _connectivitySub?.cancel();
      _periodicTimer?.cancel();
    });

    _connectivitySub = Connectivity().onConnectivityChanged.listen((results) {
      if (!results.contains(ConnectivityResult.none)) {
        drain();
      }
    });
    _periodicTimer = Timer.periodic(const Duration(minutes: 2), (_) => drain());
    Future.microtask(_refreshPendingCount);

    return const SyncEngineState(status: SyncEngineStatus.synced, pendingCount: 0);
  }

  /// Called once by an offline-capable feature's repository provider (e.g. on first read of
  /// `attendanceRepositoryProvider`) — by the time anything could enqueue an action, the handler
  /// for it is already registered.
  void registerReplayer(String actionType, ActionReplayer replayer) {
    _replayers[actionType] = replayer;
  }

  Future<void> enqueueAndTryNow(PendingAction action) async {
    await ref.read(syncQueueStoreProvider).enqueue(action);
    await _refreshPendingCount();
    unawaited(drain());
  }

  Future<void> drain() async {
    final store = ref.read(syncQueueStoreProvider);
    var items = await store.readAll();
    if (items.isEmpty) {
      state = const SyncEngineState(status: SyncEngineStatus.synced, pendingCount: 0);
      return;
    }
    state = SyncEngineState(status: SyncEngineStatus.syncing, pendingCount: items.length);

    var hadError = false;
    for (final item in items) {
      final replayer = _replayers[item.actionType];
      if (replayer == null) continue; // no handler registered yet — leave queued, retry later
      try {
        final handled = await replayer(item.payload);
        if (handled) await store.remove(item.id);
      } catch (e) {
        hadError = true;
        await store.updateError(item.id, e.toString());
      }
    }

    items = await store.readAll();
    state = SyncEngineState(
      status: items.isEmpty
          ? SyncEngineStatus.synced
          : (hadError ? SyncEngineStatus.error : SyncEngineStatus.pending),
      pendingCount: items.length,
    );
  }

  Future<void> _refreshPendingCount() async {
    final items = await ref.read(syncQueueStoreProvider).readAll();
    state = SyncEngineState(
      status: items.isEmpty ? SyncEngineStatus.synced : SyncEngineStatus.pending,
      pendingCount: items.length,
    );
  }
}

final syncQueueStoreProvider = Provider<SyncQueueStore>((ref) => SyncQueueStore());
final offlineCacheStoreProvider = Provider<OfflineCacheStore>((ref) => OfflineCacheStore());
final syncEngineProvider = NotifierProvider<SyncEngine, SyncEngineState>(SyncEngine.new);
