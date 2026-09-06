/// Mirrors backend `VerificationQueueEntry` (verification-review.service.ts).
class VerificationQueueEntry {
  const VerificationQueueEntry({
    required this.id,
    required this.teacherProfileId,
    required this.teacherFullName,
    required this.documentUrls,
    required this.createdAt,
  });

  final String id;
  final String teacherProfileId;
  final String teacherFullName;
  final List<String> documentUrls;
  final DateTime createdAt;
}
