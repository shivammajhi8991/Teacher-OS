import '../../domain/entities/guardian_info.dart';
import '../../domain/entities/student_detail.dart';
import '../../domain/entities/teacher_assignment_info.dart';
import 'guardian_summary_dto.dart';
import 'student_dto.dart';

/// Maps GET /students/:id's response (docs/04 §4.4, backend StudentsService.getStudentDetail) —
/// the student's own fields spread alongside `guardians` and `teacherAssignments` arrays.
class StudentDetailDto {
  const StudentDetailDto({
    required this.student,
    required this.guardians,
    required this.teacherAssignments,
  });

  factory StudentDetailDto.fromJson(Map<String, dynamic> json) {
    final guardians = (json['guardians'] as List)
        .cast<Map<String, dynamic>>()
        .map((g) => GuardianSummaryDto.fromJson(g).toEntity())
        .toList();

    final assignments = (json['teacherAssignments'] as List)
        .cast<Map<String, dynamic>>()
        .map(
          (a) => TeacherAssignmentInfo(
            id: a['id'] as String,
            teacherProfileId: a['teacherProfileId'] as String,
            subjectOrSkill: a['subjectOrSkill'] as String?,
            assignedFrom: DateTime.parse(a['assignedFrom'] as String),
            assignedTo: a['assignedTo'] == null ? null : DateTime.parse(a['assignedTo'] as String),
          ),
        )
        .toList();

    return StudentDetailDto(
      student: StudentDto.fromJson(json),
      guardians: guardians,
      teacherAssignments: assignments,
    );
  }

  final StudentDto student;
  final List<GuardianInfo> guardians;
  final List<TeacherAssignmentInfo> teacherAssignments;

  StudentDetail toEntity() => StudentDetail(
        student: student.toEntity(),
        guardians: guardians,
        teacherAssignments: teacherAssignments,
      );
}
