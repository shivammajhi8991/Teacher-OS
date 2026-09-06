/// Mirrors backend `SubmissionSummary` (assignments.service.ts).
class SubmissionSummary {
  const SubmissionSummary({
    required this.id,
    required this.assignmentId,
    required this.studentId,
    required this.attachmentUrls,
    required this.submittedAt,
    required this.isLate,
    required this.attemptNumber,
    required this.status,
    required this.grade,
    required this.feedback,
    required this.reviewedAt,
  });

  final String id;
  final String assignmentId;
  final String studentId;
  final List<String> attachmentUrls;
  final DateTime submittedAt;
  final bool isLate;
  final int attemptNumber;
  final String status; // 'submitted' | 'reviewed'
  final String? grade;
  final String? feedback;
  final DateTime? reviewedAt;

  bool get isReviewed => status == 'reviewed';
}
