/// Mirrors backend `StudentAttendanceEntry`/`StudentAttendanceResult` (attendance.service.ts).
class AttendanceHistoryEntry {
  const AttendanceHistoryEntry({
    required this.id,
    required this.classId,
    required this.className,
    required this.occurrenceDate,
    required this.status,
  });

  final String id;
  final String classId;
  final String className;
  final String occurrenceDate; // ISO date (yyyy-MM-dd)
  final String status; // 'present' | 'absent' | 'late' | 'excused'
}

class StudentAttendanceHistory {
  const StudentAttendanceHistory({required this.studentId, required this.percentage, required this.records});

  final String studentId;
  final double? percentage; // null when there's nothing applicable to compute a percentage from
  final List<AttendanceHistoryEntry> records;
}
