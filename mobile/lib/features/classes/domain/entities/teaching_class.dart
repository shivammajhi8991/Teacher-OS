/// docs/03 §3.5 `classes` — a batch/course/group or 1:1 arrangement. Named `TeachingClass`
/// (not `Class`) purely to avoid reading like the Dart keyword at a glance.
class TeachingClass {
  const TeachingClass({
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

  final String id;
  final String name;
  final String? subjectOrActivity;
  final String classType; // 'recurring' | 'one_time' | 'trial'
  final String mode; // 'online' | 'offline'
  final String? locationOrMeetingLink;
  final int? capacityMax;
  final String startDate;
  final String? endDate;
  final String status; // 'active' | 'completed' | 'cancelled'
}
