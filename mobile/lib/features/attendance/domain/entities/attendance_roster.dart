/// docs/04 §4.4 GET/POST .../attendance/:date. `status` null means "not yet marked" — the Quick
/// Attendance screen (docs/08 §8.3) defaults those to Present locally, without persisting
/// anything until Save.
class RosterEntry {
  const RosterEntry({required this.studentId, required this.studentFullName, this.status});

  final String studentId;
  final String studentFullName;
  final String? status;

  RosterEntry copyWith({String? status}) => RosterEntry(
        studentId: studentId,
        studentFullName: studentFullName,
        status: status ?? this.status,
      );
}

class AttendanceRoster {
  const AttendanceRoster({
    required this.classId,
    required this.occurrenceDate,
    required this.sessionId,
    required this.isCancelled,
    this.cancellationReason,
    required this.students,
    this.skippedStudentIds = const [],
  });

  final String classId;
  final String occurrenceDate;
  final String? sessionId;
  final bool isCancelled;
  final String? cancellationReason;
  final List<RosterEntry> students;
  final List<String> skippedStudentIds;
}
