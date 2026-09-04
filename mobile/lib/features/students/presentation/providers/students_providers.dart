import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../data/datasources/students_remote_data_source.dart';
import '../../data/repositories/students_repository_impl.dart';
import '../../domain/repositories/students_repository.dart';
import '../../domain/usecases/add_guardian_usecase.dart';
import '../../domain/usecases/archive_student_usecase.dart';
import '../../domain/usecases/create_invite_usecase.dart';
import '../../domain/usecases/create_student_usecase.dart';
import '../../domain/usecases/get_student_detail_usecase.dart';
import '../../domain/usecases/list_students_usecase.dart';
import '../../domain/usecases/merge_students_usecase.dart';
import '../../domain/usecases/update_student_usecase.dart';

final studentsRemoteDataSourceProvider = Provider<StudentsRemoteDataSource>((ref) {
  return StudentsRemoteDataSource(ref.watch(apiClientProvider).dio);
});

final studentsRepositoryProvider = Provider<StudentsRepository>((ref) {
  return StudentsRepositoryImpl(ref.watch(studentsRemoteDataSourceProvider));
});

final createStudentUseCaseProvider =
    Provider((ref) => CreateStudentUseCase(ref.watch(studentsRepositoryProvider)));
final listStudentsUseCaseProvider =
    Provider((ref) => ListStudentsUseCase(ref.watch(studentsRepositoryProvider)));
final getStudentDetailUseCaseProvider =
    Provider((ref) => GetStudentDetailUseCase(ref.watch(studentsRepositoryProvider)));
final updateStudentUseCaseProvider =
    Provider((ref) => UpdateStudentUseCase(ref.watch(studentsRepositoryProvider)));
final archiveStudentUseCaseProvider =
    Provider((ref) => ArchiveStudentUseCase(ref.watch(studentsRepositoryProvider)));
final addGuardianUseCaseProvider =
    Provider((ref) => AddGuardianUseCase(ref.watch(studentsRepositoryProvider)));
final mergeStudentsUseCaseProvider =
    Provider((ref) => MergeStudentsUseCase(ref.watch(studentsRepositoryProvider)));
final createInviteUseCaseProvider =
    Provider((ref) => CreateInviteUseCase(ref.watch(studentsRepositoryProvider)));

/// docs/08 §8.2 Student list — filters live as simple state here rather than route query params,
/// since this scaffold has one list screen, not a deep-linkable filtered view yet.
class StudentListFilter {
  const StudentListFilter({this.status, this.q});
  final String? status;
  final String? q;

  StudentListFilter copyWith({String? status, bool clearStatus = false, String? q}) {
    return StudentListFilter(
      status: clearStatus ? null : (status ?? this.status),
      q: q ?? this.q,
    );
  }
}

final studentListFilterProvider = StateProvider<StudentListFilter>((ref) => const StudentListFilter());

/// docs/08 §8.6 loading/error/empty pattern — a FutureProvider so pull-to-refresh (ref.invalidate)
/// and the filter chips (which this provider watches) both just work without extra plumbing.
final studentListProvider = FutureProvider.autoDispose((ref) {
  final filter = ref.watch(studentListFilterProvider);
  return ref.watch(listStudentsUseCaseProvider).call(status: filter.status, q: filter.q);
});

final studentDetailProvider = FutureProvider.autoDispose.family((ref, String studentId) {
  return ref.watch(getStudentDetailUseCaseProvider).call(studentId);
});
