import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../data/datasources/institutes_remote_data_source.dart';
import '../../data/repositories/institutes_repository_impl.dart';
import '../../domain/repositories/institutes_repository.dart';

final institutesRemoteDataSourceProvider = Provider<InstitutesRemoteDataSource>((ref) {
  return InstitutesRemoteDataSource(ref.watch(apiClientProvider).dio);
});

final institutesRepositoryProvider = Provider<InstitutesRepository>((ref) {
  return InstitutesRepositoryImpl(ref.watch(institutesRemoteDataSourceProvider));
});

/// docs/08 §8.2 Institute Admin "Teachers list ... Roster" — keyed by instituteId (always the
/// caller's own, per InstituteAdminDashboardScreen) so a super_admin drilling into a different
/// institute later would still just work.
final teacherRosterProvider = FutureProvider.autoDispose.family((ref, String instituteId) {
  return ref.watch(institutesRepositoryProvider).listTeachers(instituteId);
});
