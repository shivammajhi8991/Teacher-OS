/// docs/03 §3.4 `student_teacher_assignments` — `assignedTo == null` means ongoing/current.
class TeacherAssignmentInfo {
  const TeacherAssignmentInfo({
    required this.id,
    required this.teacherProfileId,
    this.subjectOrSkill,
    required this.assignedFrom,
    this.assignedTo,
  });

  final String id;
  final String teacherProfileId;
  final String? subjectOrSkill;
  final DateTime assignedFrom;
  final DateTime? assignedTo;

  bool get isOngoing => assignedTo == null;
}
