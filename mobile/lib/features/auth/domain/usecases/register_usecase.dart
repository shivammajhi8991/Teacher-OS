import '../../../../core/utils/result.dart';
import '../entities/app_user.dart';
import '../repositories/auth_repository.dart';

class RegisterUseCase {
  const RegisterUseCase(this._repository);

  final AuthRepository _repository;

  Future<Result<AppUser>> call({
    String? email,
    String? phone,
    required String password,
    required String fullName,
    required String role,
    String? preferredLanguage,
  }) {
    return _repository.register(
      email: email,
      phone: phone,
      password: password,
      fullName: fullName,
      role: role,
      preferredLanguage: preferredLanguage,
    );
  }
}
