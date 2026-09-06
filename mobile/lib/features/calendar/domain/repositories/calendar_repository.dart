import '../../../../core/utils/result.dart';
import '../entities/calendar_event.dart';

abstract interface class CalendarRepository {
  /// `GET /calendar?from=&to=` scopes to the caller's own calendar automatically (their own
  /// classes as a teacher, their own enrolled classes as a student, every linked child's as a
  /// parent, their own institute as an institute_admin) — this never sends an ownerType/ownerId,
  /// matching CalendarQueryDto's own header comment on the backend.
  Future<Result<List<CalendarEvent>>> getCalendar({required String from, required String to});
}
