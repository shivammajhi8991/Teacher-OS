import '../../domain/entities/student_attendance_history.dart';

class AttendanceHistoryEntryDto {
  const AttendanceHistoryEntryDto({
    required this.id,
    required this.classId,
    required this.className,
    required this.occurrenceDate,
    required this.status,
  });

  factory AttendanceHistoryEntryDto.fromJson(Map<String, dynamic> json) => AttendanceHistoryEntryDto(
        id: json['id'] as String,
        classId: json['classId'] as String,
        className: json['className'] as String,
        occurrenceDate: json['occurrenceDate'] as String,
        status: json['status'] as String,
      );

  final String id;
  final String classId;
  final String className;
  final String occurrenceDate;
  final String status;

  AttendanceHistoryEntry toEntity() =>
      AttendanceHistoryEntry(id: id, classId: classId, className: className, occurrenceDate: occurrenceDate, status: status);
}

class StudentAttendanceHistoryDto {
  const StudentAttendanceHistoryDto({required this.studentId, required this.percentage, required this.records});

  factory StudentAttendanceHistoryDto.fromJson(Map<String, dynamic> json) => StudentAttendanceHistoryDto(
        studentId: json['studentId'] as String,
        percentage: (json['percentage'] as num?)?.toDouble(),
        records: (json['records'] as List<dynamic>)
            .map((item) => AttendanceHistoryEntryDto.fromJson(item as Map<String, dynamic>))
            .toList(),
      );

  final String studentId;
  final double? percentage;
  final List<AttendanceHistoryEntryDto> records;

  StudentAttendanceHistory toEntity() => StudentAttendanceHistory(
        studentId: studentId,
        percentage: percentage,
        records: records.map((r) => r.toEntity()).toList(),
      );
}
