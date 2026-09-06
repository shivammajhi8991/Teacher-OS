import '../../../../core/utils/result.dart';
import '../entities/attendance_roster.dart';
import '../entities/student_attendance_history.dart';

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

  /// docs/07 roadmap Phase 4 step 5's own deferred item, picked up by Phase 5 step 3 (Parent
  /// dashboard) — the natural first consumer of a per-student attendance history view. Plain
  /// online read, no offline cache — unlike the roster, there's no "mark while offline" case to
  /// support here.
  Future<Result<StudentAttendanceHistory>> getStudentAttendanceHistory(String studentId);
}
