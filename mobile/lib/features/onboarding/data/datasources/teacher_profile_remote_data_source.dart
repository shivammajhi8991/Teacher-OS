import 'package:dio/dio.dart';

class TeacherProfileRemoteDataSource {
  const TeacherProfileRemoteDataSource(this._dio);

  final Dio _dio;

  Future<List<dynamic>> listCategories() async {
    final response = await _dio.get('/teacher-categories');
    return response.data as List<dynamic>;
  }

  Future<Map<String, dynamic>> createProfile({
    required String teacherCategoryId,
    String? headline,
    String? bio,
    int? experienceYears,
    String? serviceArea,
    required String teachingMode,
    List<Map<String, String?>> subjectsOrSkills = const [],
    int? classDurationMinutesDefault,
  }) async {
    final response = await _dio.post('/teacher-profiles', data: {
      'teacherCategoryId': teacherCategoryId,
      if (headline != null) 'headline': headline,
      if (bio != null) 'bio': bio,
      if (experienceYears != null) 'experienceYears': experienceYears,
      if (serviceArea != null) 'serviceArea': serviceArea,
      'teachingMode': teachingMode,
      if (subjectsOrSkills.isNotEmpty) 'subjectsOrSkills': subjectsOrSkills,
      if (classDurationMinutesDefault != null)
        'classDurationMinutesDefault': classDurationMinutesDefault,
    });
    return response.data as Map<String, dynamic>;
  }
}
