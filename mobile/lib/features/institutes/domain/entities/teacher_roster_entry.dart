/// Mirrors backend `TeacherRosterEntry` (teacher-profiles.service.ts's `listByInstitute`).
class TeacherRosterEntry {
  const TeacherRosterEntry({
    required this.id,
    required this.fullName,
    this.email,
    this.headline,
    required this.verificationStatus,
    this.payoutPercent,
  });

  final String id;
  final String fullName;
  final String? email;
  final String? headline;
  final String verificationStatus; // 'unverified' | 'pending' | 'verified'
  final String? payoutPercent;
}
