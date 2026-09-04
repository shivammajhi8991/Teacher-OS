import '../../../../core/utils/result.dart';
import '../entities/student.dart';
import '../repositories/students_repository.dart';

class UpdateStudentUseCase {
  const UpdateStudentUseCase(this._repository);
  final StudentsRepository _repository;

  Future<Result<Student>> call(
    String id, {
    String? fullName,
    String? dob,
    String? gender,
    String? emergencyContactName,
    String? emergencyContactPhone,
    String? medicalNotes,
    String? enrollmentStatus,
  }) {
    return _repository.updateStudent(
      id,
      fullName: fullName,
      dob: dob,
      gender: gender,
      emergencyContactName: emergencyContactName,
      emergencyContactPhone: emergencyContactPhone,
      medicalNotes: medicalNotes,
      enrollmentStatus: enrollmentStatus,
    );
  }
}
