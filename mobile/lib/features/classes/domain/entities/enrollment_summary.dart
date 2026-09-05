/// Mirrors backend `EnrollmentSummary` (classes.service.ts).
class EnrollmentSummary {
  const EnrollmentSummary({
    required this.id,
    required this.studentId,
    required this.studentFullName,
    required this.status,
    required this.enrolledFrom,
    this.enrolledTo,
  });

  final String id;
  final String studentId;
  final String studentFullName;
  final String status;
  final String enrolledFrom;
  final String? enrolledTo;
}
