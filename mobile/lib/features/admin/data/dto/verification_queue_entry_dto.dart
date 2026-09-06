import '../../domain/entities/verification_queue_entry.dart';

class VerificationQueueEntryDto {
  const VerificationQueueEntryDto({
    required this.id,
    required this.teacherProfileId,
    required this.teacherFullName,
    required this.documentUrls,
    required this.createdAt,
  });

  factory VerificationQueueEntryDto.fromJson(Map<String, dynamic> json) => VerificationQueueEntryDto(
        id: json['id'] as String,
        teacherProfileId: json['teacherProfileId'] as String,
        teacherFullName: json['teacherFullName'] as String,
        documentUrls: (json['documentUrls'] as List).cast<String>(),
        createdAt: DateTime.parse(json['createdAt'] as String),
      );

  final String id;
  final String teacherProfileId;
  final String teacherFullName;
  final List<String> documentUrls;
  final DateTime createdAt;

  VerificationQueueEntry toEntity() => VerificationQueueEntry(
        id: id,
        teacherProfileId: teacherProfileId,
        teacherFullName: teacherFullName,
        documentUrls: documentUrls,
        createdAt: createdAt,
      );
}
