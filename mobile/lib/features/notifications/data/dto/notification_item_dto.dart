import '../../domain/entities/notification_item.dart';

class NotificationItemDto {
  const NotificationItemDto({
    required this.id,
    required this.type,
    required this.title,
    required this.body,
    required this.deliveryChannel,
    required this.deliveredAt,
    required this.readAt,
    required this.createdAt,
  });

  factory NotificationItemDto.fromJson(Map<String, dynamic> json) => NotificationItemDto(
        id: json['id'] as String,
        type: json['type'] as String,
        title: json['title'] as String,
        body: json['body'] as String,
        deliveryChannel: json['deliveryChannel'] as String,
        deliveredAt: json['deliveredAt'] == null ? null : DateTime.parse(json['deliveredAt'] as String),
        readAt: json['readAt'] == null ? null : DateTime.parse(json['readAt'] as String),
        createdAt: DateTime.parse(json['createdAt'] as String),
      );

  final String id;
  final String type;
  final String title;
  final String body;
  final String deliveryChannel;
  final DateTime? deliveredAt;
  final DateTime? readAt;
  final DateTime createdAt;

  NotificationItem toEntity() => NotificationItem(
        id: id,
        type: type,
        title: title,
        body: body,
        deliveryChannel: deliveryChannel,
        deliveredAt: deliveredAt,
        readAt: readAt,
        createdAt: createdAt,
      );
}
