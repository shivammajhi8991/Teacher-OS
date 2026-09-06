/// Mirrors backend `CalendarEvent` (calendar.service.ts). `eventType` and `conflictReason` are
/// kept as raw strings (matching how this codebase treats other backend enums client-side, e.g.
/// AnnouncementSummary's `targetType`) rather than a separate Dart enum — the UI only ever needs
/// them for an icon/label switch.
class CalendarEvent {
  const CalendarEvent({
    required this.id,
    required this.eventType,
    required this.sourceId,
    required this.title,
    required this.startsAt,
    required this.endsAt,
    required this.conflict,
    this.conflictReason,
  });

  final String id;
  final String eventType; // 'class_occurrence' | 'assignment_due' | 'fee_due'
  final String sourceId;
  final String title;
  final DateTime startsAt;
  final DateTime endsAt;
  final bool conflict;
  final String? conflictReason; // 'teacher_double_booking' | 'location_conflict'
}
