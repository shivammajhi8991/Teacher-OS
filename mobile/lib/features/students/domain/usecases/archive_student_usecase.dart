import '../../../../core/utils/result.dart';
import '../repositories/students_repository.dart';

class ArchiveStudentUseCase {
  const ArchiveStudentUseCase(this._repository);
  final StudentsRepository _repository;

  Future<Result<void>> call(String id) => _repository.archiveStudent(id);
}
