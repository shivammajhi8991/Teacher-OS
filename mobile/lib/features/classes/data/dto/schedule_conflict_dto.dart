import '../../domain/entities/schedule_conflict.dart';

class ScheduleConflictDto {
  const ScheduleConflictDto({
    required this.conflictingClassId,
    required this.conflictingClassName,
    required this.occurrenceDate,
    required this.type,
  });

  factory ScheduleConflictDto.fromJson(Map<String, dynamic> json) => ScheduleConflictDto(
        conflictingClassId: json['conflictingClassId'] as String,
        conflictingClassName: json['conflictingClassName'] as String,
        occurrenceDate: json['occurrenceDate'] as String,
        type: json['type'] as String,
      );

  final String conflictingClassId;
  final String conflictingClassName;
  final String occurrenceDate;
  final String type;

  ScheduleConflict toEntity() => ScheduleConflict(
        conflictingClassId: conflictingClassId,
        conflictingClassName: conflictingClassName,
        occurrenceDate: DateTime.parse(occurrenceDate),
        type: type,
      );
}
