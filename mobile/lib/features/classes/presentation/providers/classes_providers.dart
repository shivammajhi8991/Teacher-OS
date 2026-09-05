import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../data/datasources/classes_remote_data_source.dart';
import '../../data/repositories/classes_repository_impl.dart';
import '../../domain/repositories/classes_repository.dart';

// docs/05 §5.1 notes usecases as the general pattern, but with 9 near-identical operations here
// (create/list/get/update/schedule get+set/conflicts/enrollments get+add/waitlist) a thin
// wrapper class per action adds a file each for no behavior — screens call the repository
// directly instead. Compare to auth/onboarding/students, where each usecase earns its place by
// being an actual seam (docs/01 §1.6-style real workflow logic, or at least a distinct call
// screens reuse); reach for one here too if an operation grows real logic later.
final classesRemoteDataSourceProvider = Provider<ClassesRemoteDataSource>((ref) {
  return ClassesRemoteDataSource(ref.watch(apiClientProvider).dio);
});

final classesRepositoryProvider = Provider<ClassesRepository>((ref) {
  return ClassesRepositoryImpl(ref.watch(classesRemoteDataSourceProvider));
});

final classListFilterProvider = StateProvider<String?>((ref) => null);

final classListProvider = FutureProvider.autoDispose((ref) {
  final status = ref.watch(classListFilterProvider);
  return ref.watch(classesRepositoryProvider).listClasses(status: status);
});

final classDetailProvider = FutureProvider.autoDispose.family((ref, String classId) {
  return ref.watch(classesRepositoryProvider).getClass(classId);
});

final classScheduleProvider = FutureProvider.autoDispose.family((ref, String classId) {
  return ref.watch(classesRepositoryProvider).getSchedule(classId);
});

final classConflictsProvider = FutureProvider.autoDispose.family((ref, String classId) {
  return ref.watch(classesRepositoryProvider).getConflicts(classId);
});

final classEnrollmentsProvider = FutureProvider.autoDispose.family((ref, String classId) {
  return ref.watch(classesRepositoryProvider).getEnrollments(classId);
});
