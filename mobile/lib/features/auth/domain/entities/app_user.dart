/// docs/03 §3.2 `users` — the subset a signed-in client actually needs. Never carries a password
/// hash (the backend never sends one — docs/04 §4.8).
class AppUser {
  const AppUser({
    required this.id,
    this.email,
    this.phone,
    required this.fullName,
    this.avatarUrl,
    required this.preferredLanguage,
    required this.activeRole,
  });

  final String id;
  final String? email;
  final String? phone;
  final String fullName;
  final String? avatarUrl;
  final String preferredLanguage;
  final String activeRole; // 'teacher' | 'student' | 'parent' | 'institute_admin' | 'super_admin'
}
