import '../../../../core/utils/result.dart';
import '../entities/teacher_category.dart';
import '../repositories/teacher_profile_repository.dart';

class ListTeacherCategoriesUseCase {
  const ListTeacherCategoriesUseCase(this._repository);

  final TeacherProfileRepository _repository;

  Future<Result<List<TeacherCategory>>> call() => _repository.listCategories();
}
