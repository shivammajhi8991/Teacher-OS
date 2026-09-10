import '../../../../core/utils/result.dart';
import '../entities/student_import_job.dart';
import '../repositories/students_repository.dart';

class GetImportJobUseCase {
  const GetImportJobUseCase(this._repository);
  final StudentsRepository _repository;

  Future<Result<StudentImportJob>> call(String id) {
    return _repository.getImportJob(id);
  }
}
