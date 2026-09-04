import '../../../../core/utils/result.dart';
import '../entities/guardian_input.dart';
import '../entities/student.dart';
import '../repositories/students_repository.dart';

class CreateStudentUseCase {
  const CreateStudentUseCase(this._repository);
  final StudentsRepository _repository;

  Future<Result<Student>> call({
    required String fullName,
    String? dob,
    String? gender,
    String? emergencyContactName,
    String? emergencyContactPhone,
    String? medicalNotes,
    String? joinDate,
    List<GuardianInput> guardians = const [],
  }) {
    return _repository.createStudent(
      fullName: fullName,
      dob: dob,
      gender: gender,
      emergencyContactName: emergencyContactName,
      emergencyContactPhone: emergencyContactPhone,
      medicalNotes: medicalNotes,
      joinDate: joinDate,
      guardians: guardians,
    );
  }
}
