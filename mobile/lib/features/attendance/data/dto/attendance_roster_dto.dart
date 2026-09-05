import '../../domain/entities/attendance_roster.dart';

class AttendanceRosterDto {
  const AttendanceRosterDto({
    required this.classId,
    required this.occurrenceDate,
    required this.sessionId,
    required this.isCancelled,
    this.cancellationReason,
    required this.students,
    this.skippedStudentIds = const [],
  });

  factory AttendanceRosterDto.fromJson(Map<String, dynamic> json) => AttendanceRosterDto(
        classId: json['classId'] as String,
        occurrenceDate: json['occurrenceDate'] as String,
        sessionId: json['sessionId'] as String?,
        isCancelled: json['isCancelled'] as bool? ?? false,
        cancellationReason: json['cancellationReason'] as String?,
        students: ((json['students'] as List?) ?? const [])
            .cast<Map<String, dynamic>>()
            .map(
              (s) => RosterEntry(
                studentId: s['studentId'] as String,
                studentFullName: s['studentFullName'] as String,
                status: s['status'] as String?,
              ),
            )
            .toList(),
        skippedStudentIds: ((json['skippedStudentIds'] as List?) ?? const []).cast<String>(),
      );

  final String classId;
  final String occurrenceDate;
  final String? sessionId;
  final bool isCancelled;
  final String? cancellationReason;
  final List<RosterEntry> students;
  final List<String> skippedStudentIds;

  /// The exact JSON shape this class parses — used both to cache a successful network response
  /// verbatim and to serialize an offline-optimistic merge back to the same shape (see
  /// AttendanceRepositoryImpl._applyOptimisticMerge), so one `fromJson` covers both origins.
  Map<String, dynamic> toJson() => {
        'classId': classId,
        'occurrenceDate': occurrenceDate,
        'sessionId': sessionId,
        'isCancelled': isCancelled,
        'cancellationReason': cancellationReason,
        'students': [
          for (final s in students)
            {'studentId': s.studentId, 'studentFullName': s.studentFullName, 'status': s.status},
        ],
        'skippedStudentIds': skippedStudentIds,
      };

  AttendanceRoster toEntity() => AttendanceRoster(
        classId: classId,
        occurrenceDate: occurrenceDate,
        sessionId: sessionId,
        isCancelled: isCancelled,
        cancellationReason: cancellationReason,
        students: students,
        skippedStudentIds: skippedStudentIds,
      );
}
