/// docs/03 §3.5 `class_schedule_versions` — the current (effectiveTo == null) version only;
/// history isn't surfaced in the mobile UI yet.
class ClassSchedule {
  const ClassSchedule({
    required this.id,
    required this.effectiveFrom,
    required this.recurrenceRule,
    required this.startTime,
    required this.endTime,
    required this.timezone,
  });

  final String id;
  final String effectiveFrom;
  final String recurrenceRule;
  final String startTime;
  final String endTime;
  final String timezone;
}
