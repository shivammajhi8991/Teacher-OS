import '../../domain/entities/teacher_category.dart';

class TeacherCategoryDto {
  const TeacherCategoryDto({required this.id, required this.name, required this.slug, this.icon});

  factory TeacherCategoryDto.fromJson(Map<String, dynamic> json) => TeacherCategoryDto(
        id: json['id'] as String,
        name: json['name'] as String,
        slug: json['slug'] as String,
        icon: json['icon'] as String?,
      );

  final String id;
  final String name;
  final String slug;
  final String? icon;

  TeacherCategory toEntity() => TeacherCategory(id: id, name: name, slug: slug, icon: icon);
}
