import 'dart:typed_data';
import '../../../../core/utils/result.dart';
import '../entities/student_import_job.dart';
import '../repositories/students_repository.dart';

class CreateImportJobUseCase {
  const CreateImportJobUseCase(this._repository);
  final StudentsRepository _repository;

  Future<Result<StudentImportJob>> call(Uint8List fileBytes, String filename) {
    return _repository.createImportJob(fileBytes, filename);
  }
}
