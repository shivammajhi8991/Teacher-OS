/// Mirrors backend `AnnouncementSummary` (announcements.service.ts). `targetType` is one of
/// 'class' | 'institute' | 'platform' — kept as the raw string (matching how this codebase
/// treats other backend enums client-side, e.g. AssignmentSummary's `status`) rather than a
/// separate Dart enum, since the UI only ever needs it for a label/icon switch.
class Announcement {
  const Announcement({
    required this.id,
    required this.targetType,
    required this.targetId,
    required this.title,
    required this.body,
    required this.createdAt,
  });

  final String id;
  final String targetType;
  final String? targetId;
  final String title;
  final String body;
  final DateTime createdAt;
}
