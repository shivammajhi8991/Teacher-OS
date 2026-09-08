import '../../../../core/utils/result.dart';
import '../entities/app_user.dart';

/// docs/05 §5.1 — presentation depends on this interface, never on `data/` directly, so
/// `admin-web` (docs/02 §2.8) can reuse this whole domain layer with a different `data/`
/// implementation if it ever needs one.
abstract interface class AuthRepository {
  Future<Result<AppUser>> login({
    required String identifier,
    required String password,
  });

  Future<Result<AppUser>> register({
    String? email,
    String? phone,
    required String password,
    required String fullName,
    required String role,
    String? preferredLanguage,
  });

  Future<Result<void>> logout();

  /// Restores a session from a stored token pair on cold start, without a fresh login —
  /// returns null (not a Failure) if there is simply no stored session yet.
  Future<AppUser?> restoreSession();

  /// docs/01 §1.3 self-service data export (Phase 6). Raw JSON, not a typed entity — this is a
  /// one-shot read-only display (docs/07 Phase 6's own scoped export shape), the same
  /// no-DTO-layer-needed reasoning Reports' file downloads already established for content that
  /// doesn't feed back into further app logic.
  Future<Result<Map<String, dynamic>>> exportAccountData();

  /// docs/01 §1.3 self-service account deletion (Phase 6). Requires the current password
  /// (re-authentication before a destructive action, matching the backend's own requirement).
  /// Clears the local session on success, same as [logout] — there's nothing left to be signed
  /// into.
  Future<Result<void>> deleteAccount({required String password});
}
