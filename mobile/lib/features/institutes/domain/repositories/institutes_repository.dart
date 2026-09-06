import '../../../../core/utils/result.dart';
import '../entities/teacher_invite.dart';
import '../entities/teacher_roster_entry.dart';

abstract interface class InstitutesRepository {
  /// docs/08 §8.2 Institute Admin "Teachers list ... Roster." `instituteId` is the caller's own
  /// (AppUser.instituteId) — the backend still enforces this server-side (institute_admin: own
  /// institute only, super_admin: any).
  Future<Result<List<TeacherRosterEntry>>> listTeachers(String instituteId);

  /// docs/08 §8.2 "invite" — generates a redeemable code, handed to the teacher out of band
  /// (no in-app delivery yet, matching StudentInvite's own documented scope cut).
  Future<Result<TeacherInvite>> createTeacherInvite(String instituteId, {int? expiresInDays});
}
