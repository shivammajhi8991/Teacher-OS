import '../../../../core/utils/result.dart';
import '../repositories/students_repository.dart';

class CreateInviteUseCase {
  const CreateInviteUseCase(this._repository);
  final StudentsRepository _repository;

  Future<Result<StudentInviteResult>> call({int? expiresInDays}) {
    return _repository.createInvite(expiresInDays: expiresInDays);
  }
}
