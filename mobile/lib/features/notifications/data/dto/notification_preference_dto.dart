import '../../domain/entities/notification_preference.dart';

class NotificationPreferenceDto {
  const NotificationPreferenceDto({required this.category, required this.channel});

  factory NotificationPreferenceDto.fromJson(Map<String, dynamic> json) => NotificationPreferenceDto(
        category: json['category'] as String,
        channel: json['channel'] as String,
      );

  final String category;
  final String channel;

  NotificationPreference toEntity() => NotificationPreference(category: category, channel: channel);
}
