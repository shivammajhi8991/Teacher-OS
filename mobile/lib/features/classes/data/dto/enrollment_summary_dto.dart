import '../../domain/entities/enrollment_summary.dart';

class EnrollmentSummaryDto {
  const EnrollmentSummaryDto({
    required this.id,
    required this.studentId,
    required this.studentFullName,
    required this.status,
    required this.enrolledFrom,
    this.enrolledTo,
  });

  factory EnrollmentSummaryDto.fromJson(Map<String, dynamic> json) => EnrollmentSummaryDto(
        id: json['id'] as String,
        studentId: json['studentId'] as String,
        studentFullName: json['studentFullName'] as String,
        status: json['status'] as String,
        enrolledFrom: json['enrolledFrom'] as String,
        enrolledTo: json['enrolledTo'] as String?,
      );

  final String id;
  final String studentId;
  final String studentFullName;
  final String status;
  final String enrolledFrom;
  final String? enrolledTo;

  EnrollmentSummary toEntity() => EnrollmentSummary(
        id: id,
        studentId: studentId,
        studentFullName: studentFullName,
        status: status,
        enrolledFrom: enrolledFrom,
        enrolledTo: enrolledTo,
      );
}
