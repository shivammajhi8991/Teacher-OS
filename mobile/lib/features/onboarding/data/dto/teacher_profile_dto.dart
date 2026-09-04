import '../../domain/entities/teacher_profile.dart';

/// Maps the backend's TeacherProfile response (docs/04 §4.4) — note `teacherCategory` comes back
/// as a nested object (the entity relation is eager server-side), not a bare id.
class TeacherProfileDto {
  const TeacherProfileDto({
    required this.id,
    required this.teacherCategoryId,
    this.headline,
    this.bio,
    this.experienceYears,
    this.serviceArea,
    required this.teachingMode,
    this.classDurationMinutesDefault,
    required this.verificationStatus,
  });

  factory TeacherProfileDto.fromJson(Map<String, dynamic> json) {
    final category = json['teacherCategory'] as Map<String, dynamic>;
    return TeacherProfileDto(
      id: json['id'] as String,
      teacherCategoryId: category['id'] as String,
      headline: json['headline'] as String?,
      bio: json['bio'] as String?,
      experienceYears: json['experienceYears'] as int?,
      serviceArea: json['serviceArea'] as String?,
      teachingMode: json['teachingMode'] as String,
      classDurationMinutesDefault: json['classDurationMinutesDefault'] as int?,
      verificationStatus: json['verificationStatus'] as String,
    );
  }

  final String id;
  final String teacherCategoryId;
  final String? headline;
  final String? bio;
  final int? experienceYears;
  final String? serviceArea;
  final String teachingMode;
  final int? classDurationMinutesDefault;
  final String verificationStatus;

  TeacherProfile toEntity() => TeacherProfile(
        id: id,
        teacherCategoryId: teacherCategoryId,
        headline: headline,
        bio: bio,
        experienceYears: experienceYears,
        serviceArea: serviceArea,
        teachingMode: teachingMode,
        classDurationMinutesDefault: classDurationMinutesDefault,
        verificationStatus: verificationStatus,
      );
}
