/// Mirrors backend `AdminUserSummary` (admin-users.service.ts).
class AdminUserRoleGrant {
  const AdminUserRoleGrant({required this.role, this.instituteId});

  final String role;
  final String? instituteId;
}

class AdminUser {
  const AdminUser({
    required this.id,
    this.email,
    this.phone,
    required this.fullName,
    required this.status,
    required this.roles,
    required this.createdAt,
  });

  final String id;
  final String? email;
  final String? phone;
  final String fullName;
  final String status; // 'active' | 'suspended' | 'pending_verification'
  final List<AdminUserRoleGrant> roles;
  final DateTime createdAt;
}
