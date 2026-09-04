import '../../../../core/utils/result.dart';
import '../entities/teacher_category.dart';
import '../entities/teacher_profile.dart';

abstract interface class TeacherProfileRepository {
  Future<Result<List<TeacherCategory>>> listCategories();

  /// docs/04 §4.4 `POST /teacher-profiles` (docs/08 §8.5 onboarding flow's final step).
  Future<Result<TeacherProfile>> createProfile({
    required String teacherCategoryId,
    String? headline,
    String? bio,
    int? experienceYears,
    String? serviceArea,
    required String teachingMode,
    List<({String name, String? level})> subjectsOrSkills,
    int? classDurationMinutesDefault,
  });
}
