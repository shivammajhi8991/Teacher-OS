import '../../domain/entities/admin_teacher_category.dart';

class AdminTeacherCategoryDto {
  const AdminTeacherCategoryDto({
    required this.id,
    required this.name,
    required this.slug,
    this.icon,
    required this.isActive,
  });

  factory AdminTeacherCategoryDto.fromJson(Map<String, dynamic> json) => AdminTeacherCategoryDto(
        id: json['id'] as String,
        name: json['name'] as String,
        slug: json['slug'] as String,
        icon: json['icon'] as String?,
        isActive: json['isActive'] as bool,
      );

  final String id;
  final String name;
  final String slug;
  final String? icon;
  final bool isActive;

  AdminTeacherCategory toEntity() => AdminTeacherCategory(
        id: id,
        name: name,
        slug: slug,
        icon: icon,
        isActive: isActive,
      );
}
