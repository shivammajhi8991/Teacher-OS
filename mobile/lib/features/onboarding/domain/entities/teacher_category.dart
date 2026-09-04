/// docs/03 §3.3 `teacher_categories` — data, not an enum, so a new category (docs/01 §1.1) never
/// requires a mobile app update, only a migration/admin insert on the backend.
class TeacherCategory {
  const TeacherCategory({
    required this.id,
    required this.name,
    required this.slug,
    this.icon,
  });

  final String id;
  final String name;
  final String slug;
  final String? icon;
}
