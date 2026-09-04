/// docs/03 §3.4 — a guardian as attached to one student (the `student_guardian_links` join
/// fields — isPrimary/consent — live here rather than on a bare Guardian entity, since they're
/// meaningful only in the context of one particular student relationship).
class GuardianInfo {
  const GuardianInfo({
    required this.id,
    required this.fullName,
    this.phone,
    this.email,
    this.relationship,
    required this.isPrimary,
    required this.consentDataSharing,
  });

  final String id;
  final String fullName;
  final String? phone;
  final String? email;
  final String? relationship;
  final bool isPrimary;
  final bool consentDataSharing;
}
