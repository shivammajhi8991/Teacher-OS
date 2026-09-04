import '../../../../core/utils/result.dart';
import '../entities/app_user.dart';
import '../repositories/auth_repository.dart';

/// Deliberately thin today — the seam exists so login-specific policy (e.g. a future "remember
/// this device" step, or client-side lockout after N failed attempts) has one obvious home
/// instead of leaking into the notifier or the repository.
class LoginUseCase {
  const LoginUseCase(this._repository);

  final AuthRepository _repository;

  Future<Result<AppUser>> call({required String identifier, required String password}) {
    return _repository.login(identifier: identifier, password: password);
  }
}
