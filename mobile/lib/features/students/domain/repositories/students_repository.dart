import '../../../../core/utils/result.dart';
import '../entities/guardian_info.dart';
import '../entities/guardian_input.dart';
import '../entities/student.dart';
import '../entities/student_detail.dart';

abstract interface class StudentsRepository {
  Future<Result<Student>> createStudent({
    required String fullName,
    String? dob,
    String? gender,
    String? emergencyContactName,
    String? emergencyContactPhone,
    String? medicalNotes,
    String? joinDate,
    List<GuardianInput> guardians = const [],
  });

  Future<Result<List<Student>>> listStudents({String? status, String? q});

  Future<Result<StudentDetail>> getStudentDetail(String id);

  Future<Result<Student>> updateStudent(
    String id, {
    String? fullName,
    String? dob,
    String? gender,
    String? emergencyContactName,
    String? emergencyContactPhone,
    String? medicalNotes,
    String? enrollmentStatus,
  });

  Future<Result<void>> archiveStudent(String id);

  Future<Result<GuardianInfo>> addGuardian(String studentId, GuardianInput guardian);

  Future<Result<void>> mergeStudents({
    required String survivingStudentId,
    required String mergedStudentId,
    required String reason,
  });

  /// docs/04 §4.4 POST /students/invite — code generation only, see student-invite.entity.ts on
  /// the backend for why redemption isn't wired up yet.
  Future<Result<StudentInviteResult>> createInvite({int? expiresInDays});
}

class StudentInviteResult {
  const StudentInviteResult({required this.code, this.expiresAt});
  final String code;
  final DateTime? expiresAt;
}
