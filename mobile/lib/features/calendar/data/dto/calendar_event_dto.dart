import '../../domain/entities/calendar_event.dart';

class CalendarEventDto {
  const CalendarEventDto({
    required this.id,
    required this.eventType,
    required this.sourceId,
    required this.title,
    required this.startsAt,
    required this.endsAt,
    required this.conflict,
    this.conflictReason,
  });

  factory CalendarEventDto.fromJson(Map<String, dynamic> json) => CalendarEventDto(
        id: json['id'] as String,
        eventType: json['eventType'] as String,
        sourceId: json['sourceId'] as String,
        title: json['title'] as String,
        startsAt: DateTime.parse(json['startsAt'] as String),
        endsAt: DateTime.parse(json['endsAt'] as String),
        conflict: json['conflict'] as bool,
        conflictReason: json['conflictReason'] as String?,
      );

  final String id;
  final String eventType;
  final String sourceId;
  final String title;
  final DateTime startsAt;
  final DateTime endsAt;
  final bool conflict;
  final String? conflictReason;

  CalendarEvent toEntity() => CalendarEvent(
        id: id,
        eventType: eventType,
        sourceId: sourceId,
        title: title,
        startsAt: startsAt,
        endsAt: endsAt,
        conflict: conflict,
        conflictReason: conflictReason,
      );
}
