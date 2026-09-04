import '../../../../core/utils/result.dart';
import '../entities/student.dart';
import '../repositories/students_repository.dart';

class ListStudentsUseCase {
  const ListStudentsUseCase(this._repository);
  final StudentsRepository _repository;

  Future<Result<List<Student>>> call({String? status, String? q}) {
    return _repository.listStudents(status: status, q: q);
  }
}
