import '../../domain/entities/teaching_class.dart';

class TeachingClassDto {
  const TeachingClassDto({
    required this.id,
    required this.name,
    this.subjectOrActivity,
    required this.classType,
    required this.mode,
    this.locationOrMeetingLink,
    this.capacityMax,
    required this.startDate,
    this.endDate,
    required this.status,
  });

  factory TeachingClassDto.fromJson(Map<String, dynamic> json) => TeachingClassDto(
        id: json['id'] as String,
        name: json['name'] as String,
        subjectOrActivity: json['subjectOrActivity'] as String?,
        classType: json['classType'] as String,
        mode: json['mode'] as String,
        locationOrMeetingLink: json['locationOrMeetingLink'] as String?,
        capacityMax: json['capacityMax'] as int?,
        startDate: json['startDate'] as String,
        endDate: json['endDate'] as String?,
        status: json['status'] as String,
      );

  final String id;
  final String name;
  final String? subjectOrActivity;
  final String classType;
  final String mode;
  final String? locationOrMeetingLink;
  final int? capacityMax;
  final String startDate;
  final String? endDate;
  final String status;

  TeachingClass toEntity() => TeachingClass(
        id: id,
        name: name,
        subjectOrActivity: subjectOrActivity,
        classType: classType,
        mode: mode,
        locationOrMeetingLink: locationOrMeetingLink,
        capacityMax: capacityMax,
        startDate: startDate,
        endDate: endDate,
        status: status,
      );
}
