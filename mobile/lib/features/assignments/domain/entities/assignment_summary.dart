/// Mirrors backend `AssignmentSummary` (assignments.service.ts). Exactly one of [classId]/
/// [studentId] is set, matching the backend's "exactly one target" rule.
class AssignmentSummary {
  const AssignmentSummary({
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

  bool get isPastDue => DateTime.now().isAfter(dueAt);
}
