/// Mirrors backend `TeacherInviteSummary` (teacher-invites.service.ts).
class TeacherInvite {
  const TeacherInvite({
    required this.id,
    required this.code,
    required this.expiresAt,
    this.redeemedAt,
  });

  final String id;
  final String code;
  final DateTime expiresAt;
  final DateTime? redeemedAt;
}
