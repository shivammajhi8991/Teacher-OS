import '../../domain/entities/submission_summary.dart';

class SubmissionSummaryDto {
  const SubmissionSummaryDto({
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

  factory SubmissionSummaryDto.fromJson(Map<String, dynamic> json) => SubmissionSummaryDto(
        id: json['id'] as String,
        assignmentId: json['assignmentId'] as String,
        studentId: json['studentId'] as String,
        attachmentUrls: (json['attachmentUrls'] as List<dynamic>).cast<String>(),
        submittedAt: DateTime.parse(json['submittedAt'] as String),
        isLate: json['isLate'] as bool,
        attemptNumber: json['attemptNumber'] as int,
        status: json['status'] as String,
        grade: json['grade'] as String?,
        feedback: json['feedback'] as String?,
        reviewedAt: json['reviewedAt'] == null ? null : DateTime.parse(json['reviewedAt'] as String),
      );

  final String id;
  final String assignmentId;
  final String studentId;
  final List<String> attachmentUrls;
  final DateTime submittedAt;
  final bool isLate;
  final int attemptNumber;
  final String status;
  final String? grade;
  final String? feedback;
  final DateTime? reviewedAt;

  SubmissionSummary toEntity() => SubmissionSummary(
        id: id,
        assignmentId: assignmentId,
        studentId: studentId,
        attachmentUrls: attachmentUrls,
        submittedAt: submittedAt,
        isLate: isLate,
        attemptNumber: attemptNumber,
        status: status,
        grade: grade,
        feedback: feedback,
        reviewedAt: reviewedAt,
      );
}
