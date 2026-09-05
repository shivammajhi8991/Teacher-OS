/// docs/08 §8.5 "live inline warning" — non-blocking, shown before Save (docs/01 §1.5). Mirrors
/// backend `ConflictEntry` (classes.service.ts).
class ScheduleConflict {
  const ScheduleConflict({
    required this.conflictingClassId,
    required this.conflictingClassName,
    required this.occurrenceDate,
    required this.type,
  });

  final String conflictingClassId;
  final String conflictingClassName;
  final DateTime occurrenceDate;
  final String type; // 'teacher_double_booking' | 'location_conflict'
}
