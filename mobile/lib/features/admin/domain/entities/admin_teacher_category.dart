/// Admin-facing shape of `teacher_categories` — separate from
/// `features/onboarding/domain/entities/teacher_category.dart` (that one is deliberately narrow,
/// just what the onboarding picker needs) since this screen also needs `isActive` to manage it.
class AdminTeacherCategory {
  const AdminTeacherCategory({
    required this.id,
    required this.name,
    required this.slug,
    this.icon,
    required this.isActive,
  });

  final String id;
  final String name;
  final String slug;
  final String? icon;
  final bool isActive;
}
