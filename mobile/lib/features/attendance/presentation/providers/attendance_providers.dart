import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/sync/sync_engine.dart';
import '../../../../core/utils/result.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../data/datasources/attendance_remote_data_source.dart';
import '../../data/repositories/attendance_repository_impl.dart';
import '../../domain/entities/attendance_roster.dart';
import '../../domain/repositories/attendance_repository.dart';

final attendanceRemoteDataSourceProvider = Provider<AttendanceRemoteDataSource>((ref) {
  return AttendanceRemoteDataSource(ref.watch(apiClientProvider).dio);
});

/// Also registers this feature's offline-replay handler with the sync engine the first time
/// this provider is read — see core/sync/sync_engine.dart's class comment for why registration
/// lives here rather than inside SyncEngine itself.
final attendanceRepositoryProvider = Provider<AttendanceRepository>((ref) {
  final remoteDataSource = ref.watch(attendanceRemoteDataSourceProvider);
  final syncEngine = ref.read(syncEngineProvider.notifier);

  syncEngine.registerReplayer('attendance_bulk_mark', (payload) async {
    try {
      await remoteDataSource.bulkMarkRaw(
        payload['classId'] as String,
        payload['date'] as String,
        (payload['records'] as List).cast<Map<String, dynamic>>(),
      );
      return true; // synced — drop from the queue
    } on DioException catch (e) {
      return !_isTransientNetworkError(e); // transient → keep queued; anything else → give up
    }
  });

  return AttendanceRepositoryImpl(
    remoteDataSource: remoteDataSource,
    cacheStore: ref.watch(offlineCacheStoreProvider),
    enqueueAction: (action) => ref.read(syncEngineProvider.notifier).enqueueAndTryNow(action),
  );
});

bool _isTransientNetworkError(DioException e) {
  return e.type == DioExceptionType.connectionError ||
      e.type == DioExceptionType.connectionTimeout ||
      e.type == DioExceptionType.receiveTimeout ||
      e.type == DioExceptionType.sendTimeout;
}

typedef RosterKey = ({String classId, String date});

final rosterProvider = FutureProvider.autoDispose.family<Result<AttendanceRoster>, RosterKey>((
  ref,
  key,
) {
  return ref.watch(attendanceRepositoryProvider).getRoster(key.classId, key.date);
});

final studentAttendanceHistoryProvider = FutureProvider.autoDispose.family((ref, String studentId) {
  return ref.watch(attendanceRepositoryProvider).getStudentAttendanceHistory(studentId);
});
