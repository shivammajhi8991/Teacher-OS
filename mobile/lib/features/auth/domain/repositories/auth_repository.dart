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
}
