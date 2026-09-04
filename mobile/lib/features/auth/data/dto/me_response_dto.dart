import '../../domain/entities/app_user.dart';

/// Maps GET /auth/me's response (docs/04 §4.3) — `{ user, roles, permissions }` — onto [AppUser].
/// Login/register (docs/04 §4.3) only return the bare user + tokens, not roles, so the auth data
/// source calls /auth/me right after either one to fill in `activeRole` (see
/// AuthRemoteDataSource._fetchCurrentUser).
class MeResponseDto {
  const MeResponseDto({
    required this.id,
    this.email,
    this.phone,
    required this.fullName,
    this.avatarUrl,
    required this.preferredLanguage,
    required this.roles,
    required this.permissions,
  });

  factory MeResponseDto.fromJson(Map<String, dynamic> json) {
    final user = json['user'] as Map<String, dynamic>;
    final roles = (json['roles'] as List)
        .map((r) => (r as Map<String, dynamic>)['role'] as String)
        .toList();
    return MeResponseDto(
      id: user['id'] as String,
      email: user['email'] as String?,
      phone: user['phone'] as String?,
      fullName: user['fullName'] as String,
      avatarUrl: user['avatarUrl'] as String?,
      preferredLanguage: user['preferredLanguage'] as String? ?? 'en',
      roles: roles,
      permissions: (json['permissions'] as List).cast<String>(),
    );
  }

  final String id;
  final String? email;
  final String? phone;
  final String fullName;
  final String? avatarUrl;
  final String preferredLanguage;
  final List<String> roles;
  final List<String> permissions;

  AppUser toEntity() => AppUser(
        id: id,
        email: email,
        phone: phone,
        fullName: fullName,
        avatarUrl: avatarUrl,
        preferredLanguage: preferredLanguage,
        // docs/04 §4.3 switch-role picks a different one later; login/register default to the
        // first role the backend returns (AuthService.login picks the same one server-side).
        activeRole: roles.isNotEmpty ? roles.first : 'student',
      );
}
