import '../../domain/entities/teacher_invite.dart';

class TeacherInviteDto {
  const TeacherInviteDto({
    required this.id,
    required this.code,
    required this.expiresAt,
    this.redeemedAt,
  });

  factory TeacherInviteDto.fromJson(Map<String, dynamic> json) => TeacherInviteDto(
        id: json['id'] as String,
        code: json['code'] as String,
        expiresAt: DateTime.parse(json['expiresAt'] as String),
        redeemedAt: json['redeemedAt'] != null ? DateTime.parse(json['redeemedAt'] as String) : null,
      );

  final String id;
  final String code;
  final DateTime expiresAt;
  final DateTime? redeemedAt;

  TeacherInvite toEntity() => TeacherInvite(
        id: id,
        code: code,
        expiresAt: expiresAt,
        redeemedAt: redeemedAt,
      );
}
