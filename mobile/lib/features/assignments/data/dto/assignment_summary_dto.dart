import '../../domain/entities/assignment_summary.dart';

class AssignmentSummaryDto {
  const AssignmentSummaryDto({
    required this.id,
    required this.title,
    required this.description,
    required this.classId,
    required this.studentId,
    required this.dueAt,
    required this.allowLateSubmission,
    required this.allowResubmission,
    required this.attachmentUrls,
    required this.createdAt,
  });

  factory AssignmentSummaryDto.fromJson(Map<String, dynamic> json) => AssignmentSummaryDto(
        id: json['id'] as String,
        title: json['title'] as String,
        description: json['description'] as String?,
        classId: json['classId'] as String?,
        studentId: json['studentId'] as String?,
        dueAt: DateTime.parse(json['dueAt'] as String),
        allowLateSubmission: json['allowLateSubmission'] as bool,
        allowResubmission: json['allowResubmission'] as bool,
        attachmentUrls: (json['attachmentUrls'] as List<dynamic>).cast<String>(),
        createdAt: DateTime.parse(json['createdAt'] as String),
      );

  final String id;
  final String title;
  final String? description;
  final String? classId;
  final String? studentId;
  final DateTime dueAt;
  final bool allowLateSubmission;
  final bool allowResubmission;
  final List<String> attachmentUrls;
  final DateTime createdAt;

  AssignmentSummary toEntity() => AssignmentSummary(
        id: id,
        title: title,
        description: description,
        classId: classId,
        studentId: studentId,
        dueAt: dueAt,
        allowLateSubmission: allowLateSubmission,
        allowResubmission: allowResubmission,
        attachmentUrls: attachmentUrls,
        createdAt: createdAt,
      );
}
