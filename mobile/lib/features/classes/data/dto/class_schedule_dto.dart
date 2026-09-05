import '../../domain/entities/class_schedule.dart';

class ClassScheduleDto {
  const ClassScheduleDto({
    required this.id,
    required this.effectiveFrom,
    required this.recurrenceRule,
    required this.startTime,
    required this.endTime,
    required this.timezone,
  });

  factory ClassScheduleDto.fromJson(Map<String, dynamic> json) => ClassScheduleDto(
        id: json['id'] as String,
        effectiveFrom: json['effectiveFrom'] as String,
        recurrenceRule: json['recurrenceRule'] as String,
        startTime: json['startTime'] as String,
        endTime: json['endTime'] as String,
        timezone: json['timezone'] as String,
      );

  final String id;
  final String effectiveFrom;
  final String recurrenceRule;
  final String startTime;
  final String endTime;
  final String timezone;

  ClassSchedule toEntity() => ClassSchedule(
        id: id,
        effectiveFrom: effectiveFrom,
        recurrenceRule: recurrenceRule,
        startTime: startTime,
        endTime: endTime,
        timezone: timezone,
      );
}
