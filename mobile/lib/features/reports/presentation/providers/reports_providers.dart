import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../data/datasources/reports_remote_data_source.dart';
import '../../data/repositories/reports_repository_impl.dart';
import '../../domain/repositories/reports_repository.dart';

final reportsRemoteDataSourceProvider = Provider<ReportsRemoteDataSource>((ref) {
  return ReportsRemoteDataSource(ref.watch(apiClientProvider).dio);
});

final reportsRepositoryProvider = Provider<ReportsRepository>((ref) {
  return ReportsRepositoryImpl(ref.watch(reportsRemoteDataSourceProvider));
});
