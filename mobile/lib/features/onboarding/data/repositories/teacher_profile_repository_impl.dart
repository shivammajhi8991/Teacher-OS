import 'package:dio/dio.dart';
import '../../../../core/network/api_exception_mapper.dart';
import '../../../../core/utils/result.dart';
import '../../domain/entities/teacher_category.dart';
import '../../domain/entities/teacher_profile.dart';
import '../../domain/repositories/teacher_profile_repository.dart';
import '../datasources/teacher_profile_remote_data_source.dart';
import '../dto/teacher_category_dto.dart';
import '../dto/teacher_profile_dto.dart';

class TeacherProfileRepositoryImpl implements TeacherProfileRepository {
  const TeacherProfileRepositoryImpl(this._remoteDataSource);

  final TeacherProfileRemoteDataSource _remoteDataSource;

  @override
  Future<Result<List<TeacherCategory>>> listCategories() async {
    try {
      final json = await _remoteDataSource.listCategories();
      final categories = json
          .map((item) => TeacherCategoryDto.fromJson(item as Map<String, dynamic>).toEntity())
          .toList();
      return Ok(categories);
    } on DioException catch (e) {
      return Err(mapDioExceptionToFailure(e));
    }
  }

  @override
  Future<Result<TeacherProfile>> createProfile({
    required String teacherCategoryId,
    String? headline,
    String? bio,
    int? experienceYears,
    String? serviceArea,
    required String teachingMode,
    List<({String name, String? level})> subjectsOrSkills = const [],
    int? classDurationMinutesDefault,
  }) async {
    try {
      final json = await _remoteDataSource.createProfile(
        teacherCategoryId: teacherCategoryId,
        headline: headline,
        bio: bio,
        experienceYears: experienceYears,
        serviceArea: serviceArea,
        teachingMode: teachingMode,
        subjectsOrSkills: [
          for (final s in subjectsOrSkills) {'name': s.name, 'level': s.level},
        ],
        classDurationMinutesDefault: classDurationMinutesDefault,
      );
      return Ok(TeacherProfileDto.fromJson(json).toEntity());
    } on DioException catch (e) {
      return Err(mapDioExceptionToFailure(e));
    }
  }
}
