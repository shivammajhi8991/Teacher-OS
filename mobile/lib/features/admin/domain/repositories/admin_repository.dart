import '../../../../core/utils/result.dart';
import '../entities/admin_teacher_category.dart';
import '../entities/admin_user.dart';
import '../entities/audit_log_entry.dart';
import '../entities/verification_queue_entry.dart';

abstract interface class AdminRepository {
  /// docs/08 §8.2 Admin Web Panel "Users | Search/suspend/role-manage across the platform."
  /// `q`/`status` scope server-side (institute_admin: own institute only, super_admin: any) —
  /// never a client-supplied institute filter.
  Future<Result<List<AdminUser>>> searchUsers({String? q, String? status});

  Future<Result<void>> updateUserStatus(String userId, String status);

  Future<Result<void>> assignUserRole(String userId, {required String role, String? instituteId});

  /// docs/08 §8.2 "Verification queue | Review submitted docs, approve/reject with reason."
  Future<Result<List<VerificationQueueEntry>>> listVerificationQueue();

  Future<Result<void>> reviewVerificationRequest(
    String requestId, {
    required String decision,
    String? rejectionReason,
  });

  /// docs/08 §8.2 "Teacher categories | Add/edit categories."
  Future<Result<AdminTeacherCategory>> createTeacherCategory({required String name, String? icon});

  Future<Result<AdminTeacherCategory>> updateTeacherCategory(String id, {bool? isActive});

  /// docs/08 §8.2 Admin Web Panel "Audit log". Unifies attendance-record and payment-status
  /// audit trails — the only two this codebase actually writes to — into one time-sorted feed;
  /// see `admin_panel_shell_screen.dart`'s own doc comment for why Reported content and System
  /// config have no equivalent here.
  Future<Result<AuditLogPage>> listAuditLog({String? source, String? cursor, int limit = 50});
}
