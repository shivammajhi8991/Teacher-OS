import '../../domain/entities/announcement.dart';

class AnnouncementDto {
  const AnnouncementDto({
    required this.id,
    required this.targetType,
    required this.targetId,
    required this.title,
    required this.body,
    required this.createdAt,
  });

  factory AnnouncementDto.fromJson(Map<String, dynamic> json) => AnnouncementDto(
        id: json['id'] as String,
        targetType: json['targetType'] as String,
        targetId: json['targetId'] as String?,
        title: json['title'] as String,
        body: json['body'] as String,
        createdAt: DateTime.parse(json['createdAt'] as String),
      );

  final String id;
  final String targetType;
  final String? targetId;
  final String title;
  final String body;
  final DateTime createdAt;

  Announcement toEntity() => Announcement(
        id: id,
        targetType: targetType,
        targetId: targetId,
        title: title,
        body: body,
        createdAt: createdAt,
      );
}
