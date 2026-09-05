import '../../../../core/utils/result.dart';
import '../entities/attendance_roster.dart';

abstract interface class AttendanceRepository {
  /// docs/05 §5.4 read path — falls back to the last cached roster when offline rather than
  /// erroring, per docs/08 §8.6 ("Couldn't refresh — showing saved data").
  Future<Result<AttendanceRoster>> getRoster(String classId, String occurrenceDate);

  /// docs/08 §8.3 Quick Attendance's Save. When offline, this queues the mutation and returns an
  /// optimistically-merged roster immediately (docs/05 §5.4) rather than failing — see
  /// AttendanceRepositoryImpl for the exact policy.
  Future<Result<AttendanceRoster>> bulkMark(
    String classId,
    String occurrenceDate,
    List<({String studentId, String status, String? notes})> records,
  );
}
