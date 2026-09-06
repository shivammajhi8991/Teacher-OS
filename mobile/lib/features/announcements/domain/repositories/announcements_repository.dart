import '../../../../core/utils/result.dart';
import '../entities/announcement.dart';

abstract interface class AnnouncementsRepository {
  /// `GET /announcements` scopes to the caller automatically (their institute, their classes for
  /// a teacher/student, their linked children's for a parent, everything for super_admin, plus
  /// PLATFORM always) — this passes no filter at all, mirroring StudentAssignmentsScreen's
  /// `myAssignmentsProvider` precedent.
  Future<Result<List<Announcement>>> listAnnouncements();

  /// `targetId` is required for a CLASS-targeted announcement (a teacher's own class) and ignored
  /// for INSTITUTE (the backend infers the caller's own institute) and PLATFORM.
  Future<Result<void>> createAnnouncement({
    required String targetType,
    String? targetId,
    required String title,
    required String body,
  });
}
