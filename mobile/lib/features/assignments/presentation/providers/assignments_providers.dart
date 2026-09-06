import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../data/datasources/assignments_remote_data_source.dart';
import '../../data/repositories/assignments_repository_impl.dart';
import '../../domain/repositories/assignments_repository.dart';

final assignmentsRemoteDataSourceProvider = Provider<AssignmentsRemoteDataSource>((ref) {
  return AssignmentsRemoteDataSource(ref.watch(apiClientProvider).dio);
});

final assignmentsRepositoryProvider = Provider<AssignmentsRepository>((ref) {
  return AssignmentsRepositoryImpl(ref.watch(assignmentsRemoteDataSourceProvider));
});

/// Used both by the Class Detail screen's Assignments section (pass `classId`) and the Student
/// dashboard's Assignments tab (no filter — the server scopes to the caller's own on its own).
final classAssignmentsProvider = FutureProvider.autoDispose.family((ref, String classId) {
  return ref.watch(assignmentsRepositoryProvider).listAssignments(classId: classId);
});

final myAssignmentsProvider = FutureProvider.autoDispose((ref) {
  return ref.watch(assignmentsRepositoryProvider).listAssignments();
});

final assignmentDetailProvider = FutureProvider.autoDispose.family((ref, String id) {
  return ref.watch(assignmentsRepositoryProvider).getAssignment(id);
});

final assignmentSubmissionsProvider = FutureProvider.autoDispose.family((ref, String assignmentId) {
  return ref.watch(assignmentsRepositoryProvider).listSubmissions(assignmentId);
});
