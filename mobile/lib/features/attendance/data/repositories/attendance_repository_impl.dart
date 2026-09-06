import 'package:dio/dio.dart';
import 'package:uuid/uuid.dart';
import '../../../../core/error/failure.dart';
import '../../../../core/network/api_exception_mapper.dart';
import '../../../../core/sync/offline_cache_store.dart';
import '../../../../core/sync/pending_action.dart';
import '../../../../core/utils/result.dart';
import '../../domain/entities/attendance_roster.dart';
import '../../domain/entities/student_attendance_history.dart';
import '../../domain/repositories/attendance_repository.dart';
import '../datasources/attendance_remote_data_source.dart';
import '../dto/attendance_roster_dto.dart';
import '../dto/student_attendance_history_dto.dart';

/// docs/05 §5.4 — the one repository in this codebase with a real offline write path so far.
/// `bulkMark`'s upsert-by-(session,student) semantics on the backend (attendance-record.entity.ts)
/// make a queued replay always safe, which is what makes this design sound: no idempotency-key
/// header is needed on top, and no client-side conflict UI either — the server just converges.
class AttendanceRepositoryImpl implements AttendanceRepository {
  AttendanceRepositoryImpl({
    required AttendanceRemoteDataSource remoteDataSource,
    required OfflineCacheStore cacheStore,
    required Future<void> Function(PendingAction action) enqueueAction,
  })  : _remoteDataSource = remoteDataSource,
        _cacheStore = cacheStore,
        _enqueueAction = enqueueAction;

  final AttendanceRemoteDataSource _remoteDataSource;
  final OfflineCacheStore _cacheStore;
  final Future<void> Function(PendingAction action) _enqueueAction;

  @override
  Future<Result<AttendanceRoster>> getRoster(String classId, String occurrenceDate) async {
    final cacheKey = _cacheKey(classId, occurrenceDate);
    try {
      final json = await _remoteDataSource.getRoster(classId, occurrenceDate);
      await _cacheStore.write(cacheKey, json);
      return Ok(AttendanceRosterDto.fromJson(json).toEntity());
    } on DioException catch (e) {
      final failure = mapDioExceptionToFailure(e);
      if (failure is NetworkFailure) {
        // docs/05 §5.4, docs/08 §8.6 — show saved data rather than a blocking error when offline.
        final cached = await _cacheStore.read(cacheKey);
        if (cached != null) return Ok(AttendanceRosterDto.fromJson(cached).toEntity());
      }
      return Err(failure);
    }
  }

  @override
  Future<Result<AttendanceRoster>> bulkMark(
    String classId,
    String occurrenceDate,
    List<({String studentId, String status, String? notes})> records,
  ) async {
    final cacheKey = _cacheKey(classId, occurrenceDate);
    final recordMaps = [
      for (final r in records)
        {'studentId': r.studentId, 'status': r.status, if (r.notes != null) 'notes': r.notes},
    ];

    try {
      final json = await _remoteDataSource.bulkMarkRaw(classId, occurrenceDate, recordMaps);
      await _cacheStore.write(cacheKey, json);
      return Ok(AttendanceRosterDto.fromJson(json).toEntity());
    } on DioException catch (e) {
      final failure = mapDioExceptionToFailure(e);
      if (failure is! NetworkFailure) return Err(failure);

      // Offline: queue for later and merge optimistically into the cache so Save feels instant
      // (docs/01 §1.6, docs/05 §5.4) even though the server hasn't confirmed yet.
      await _enqueueAction(
        PendingAction(
          id: const Uuid().v4(),
          actionType: 'attendance_bulk_mark',
          payload: {'classId': classId, 'date': occurrenceDate, 'records': recordMaps},
          createdAt: DateTime.now(),
        ),
      );

      final cached = await _cacheStore.read(cacheKey);
      final merged = _applyOptimisticMerge(cached, classId, occurrenceDate, recordMaps);
      await _cacheStore.write(cacheKey, merged);
      return Ok(AttendanceRosterDto.fromJson(merged).toEntity());
    }
  }

  Map<String, dynamic> _applyOptimisticMerge(
    Map<String, dynamic>? cached,
    String classId,
    String occurrenceDate,
    List<Map<String, dynamic>> recordMaps,
  ) {
    final existing = ((cached?['students'] as List?) ?? const [])
        .cast<Map<String, dynamic>>()
        .map((s) => Map<String, dynamic>.from(s))
        .toList();
    final byId = {for (final s in existing) s['studentId'] as String: s};
    for (final record in recordMaps) {
      final studentId = record['studentId'] as String;
      if (byId.containsKey(studentId)) {
        byId[studentId]!['status'] = record['status'];
      }
    }
    return {
      'classId': classId,
      'occurrenceDate': occurrenceDate,
      'sessionId': cached?['sessionId'],
      'isCancelled': cached?['isCancelled'] ?? false,
      'cancellationReason': cached?['cancellationReason'],
      'students': byId.values.toList(),
      'skippedStudentIds': const <String>[],
    };
  }

  @override
  Future<Result<StudentAttendanceHistory>> getStudentAttendanceHistory(String studentId) async {
    try {
      final json = await _remoteDataSource.getStudentAttendanceHistory(studentId);
      return Ok(StudentAttendanceHistoryDto.fromJson(json).toEntity());
    } on DioException catch (e) {
      return Err(mapDioExceptionToFailure(e));
    }
  }

  String _cacheKey(String classId, String occurrenceDate) =>
      'attendance_roster:$classId:$occurrenceDate';
}
