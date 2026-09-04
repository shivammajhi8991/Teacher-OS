import '../../../../core/utils/result.dart';
import '../entities/teacher_profile.dart';
import '../repositories/teacher_profile_repository.dart';

class CreateTeacherProfileUseCase {
  const CreateTeacherProfileUseCase(this._repository);

  final TeacherProfileRepository _repository;

  Future<Result<TeacherProfile>> call({
    required String teacherCategoryId,
    String? headline,
    String? bio,
    int? experienceYears,
    String? serviceArea,
    required String teachingMode,
    List<({String name, String? level})> subjectsOrSkills = const [],
    int? classDurationMinutesDefault,
  }) {
    return _repository.createProfile(
      teacherCategoryId: teacherCategoryId,
      headline: headline,
      bio: bio,
      experienceYears: experienceYears,
      serviceArea: serviceArea,
      teachingMode: teachingMode,
      subjectsOrSkills: subjectsOrSkills,
      classDurationMinutesDefault: classDurationMinutesDefault,
    );
  }
}
