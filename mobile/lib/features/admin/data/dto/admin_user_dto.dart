import '../../domain/entities/admin_user.dart';

class AdminUserDto {
  const AdminUserDto({
    required this.id,
    this.email,
    this.phone,
    required this.fullName,
    required this.status,
    required this.roles,
    required this.createdAt,
  });

  factory AdminUserDto.fromJson(Map<String, dynamic> json) => AdminUserDto(
        id: json['id'] as String,
        email: json['email'] as String?,
        phone: json['phone'] as String?,
        fullName: json['fullName'] as String,
        status: json['status'] as String,
        roles: (json['roles'] as List)
            .map((r) => (r as Map<String, dynamic>))
            .map((r) => AdminUserRoleGrant(
                  role: r['role'] as String,
                  instituteId: r['instituteId'] as String?,
                ))
            .toList(),
        createdAt: DateTime.parse(json['createdAt'] as String),
      );

  final String id;
  final String? email;
  final String? phone;
  final String fullName;
  final String status;
  final List<AdminUserRoleGrant> roles;
  final DateTime createdAt;

  AdminUser toEntity() => AdminUser(
        id: id,
        email: email,
        phone: phone,
        fullName: fullName,
        status: status,
        roles: roles,
        createdAt: createdAt,
      );
}
