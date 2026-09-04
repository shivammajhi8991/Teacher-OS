import '../../../../core/utils/result.dart';
import '../entities/guardian_info.dart';
import '../entities/guardian_input.dart';
import '../repositories/students_repository.dart';

class AddGuardianUseCase {
  const AddGuardianUseCase(this._repository);
  final StudentsRepository _repository;

  Future<Result<GuardianInfo>> call(String studentId, GuardianInput guardian) {
    return _repository.addGuardian(studentId, guardian);
  }
}
