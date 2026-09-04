import 'student.dart';
import 'guardian_info.dart';
import 'teacher_assignment_info.dart';

/// docs/04 §4.4 "GET /students/:id — full profile" — attendance/fee/notes summaries join this
/// once those modules exist (docs/07 steps 5–7); today it's the profile plus what does exist.
class StudentDetail {
  const StudentDetail({
    required this.student,
    required this.guardians,
    required this.teacherAssignments,
  });

  final Student student;
  final List<GuardianInfo> guardians;
  final List<TeacherAssignmentInfo> teacherAssignments;
}
