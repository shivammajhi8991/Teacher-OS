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
    this.instituteId,
  });

  final String id;
  final String? email;
  final String? phone;
  final String fullName;
  final String? avatarUrl;
  final String preferredLanguage;
  final String activeRole; // 'teacher' | 'student' | 'parent' | 'institute_admin' | 'super_admin'

  /// The institute this session's [activeRole] is scoped to — set for institute_admin (and a
  /// teacher affiliated with one), null for student/parent/super_admin. Mirrors the JWT's own
  /// `instituteId` claim (AuthService.issueTokenPair) so institute-scoped screens (Teachers
  /// roster, institute-wide announcements) know which institute without a separate round trip.
  final String? instituteId;
}
