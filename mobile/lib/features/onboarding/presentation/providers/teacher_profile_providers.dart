import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/utils/result.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../data/datasources/teacher_profile_remote_data_source.dart';
import '../../data/repositories/teacher_profile_repository_impl.dart';
import '../../domain/entities/teacher_category.dart';
import '../../domain/repositories/teacher_profile_repository.dart';
import '../../domain/usecases/create_teacher_profile_usecase.dart';
import '../../domain/usecases/list_teacher_categories_usecase.dart';

final teacherProfileRemoteDataSourceProvider = Provider<TeacherProfileRemoteDataSource>((ref) {
  return TeacherProfileRemoteDataSource(ref.watch(apiClientProvider).dio);
});

final teacherProfileRepositoryProvider = Provider<TeacherProfileRepository>((ref) {
  return TeacherProfileRepositoryImpl(ref.watch(teacherProfileRemoteDataSourceProvider));
});

final listTeacherCategoriesUseCaseProvider = Provider(
  (ref) => ListTeacherCategoriesUseCase(ref.watch(teacherProfileRepositoryProvider)),
);

final createTeacherProfileUseCaseProvider = Provider(
  (ref) => CreateTeacherProfileUseCase(ref.watch(teacherProfileRepositoryProvider)),
);

/// docs/08 §8.5 onboarding flow's first screen (category grid) — kept as a [Result] rather than
/// letting [FutureProvider] surface a raw exception, so the screen uses the same fold-based error
/// handling as the rest of the app (docs/05 §5.1) instead of a special case for this one provider.
final teacherCategoriesProvider = FutureProvider<Result<List<TeacherCategory>>>((ref) {
  return ref.watch(listTeacherCategoriesUseCaseProvider).call();
});
