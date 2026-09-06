import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../data/datasources/performance_remote_data_source.dart';
import '../../data/repositories/performance_repository_impl.dart';
import '../../domain/repositories/performance_repository.dart';

final performanceRemoteDataSourceProvider = Provider<PerformanceRemoteDataSource>((ref) {
  return PerformanceRemoteDataSource(ref.watch(apiClientProvider).dio);
});

final performanceRepositoryProvider = Provider<PerformanceRepository>((ref) {
  return PerformanceRepositoryImpl(ref.watch(performanceRemoteDataSourceProvider));
});

final applicableMetricDefinitionsProvider = FutureProvider.autoDispose((ref) {
  return ref.watch(performanceRepositoryProvider).listApplicableDefinitions();
});

final studentPerformanceProvider = FutureProvider.autoDispose.family((ref, String studentId) {
  return ref.watch(performanceRepositoryProvider).getStudentPerformance(studentId);
});
