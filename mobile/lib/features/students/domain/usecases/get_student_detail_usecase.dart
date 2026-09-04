import '../../../../core/utils/result.dart';
import '../entities/student_detail.dart';
import '../repositories/students_repository.dart';

class GetStudentDetailUseCase {
  const GetStudentDetailUseCase(this._repository);
  final StudentsRepository _repository;

  Future<Result<StudentDetail>> call(String id) => _repository.getStudentDetail(id);
}
