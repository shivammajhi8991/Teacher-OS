import '../../../../core/utils/result.dart';
import '../repositories/students_repository.dart';

class MergeStudentsUseCase {
  const MergeStudentsUseCase(this._repository);
  final StudentsRepository _repository;

  Future<Result<void>> call({
    required String survivingStudentId,
    required String mergedStudentId,
    required String reason,
  }) {
    return _repository.mergeStudents(
      survivingStudentId: survivingStudentId,
      mergedStudentId: mergedStudentId,
      reason: reason,
    );
  }
}
