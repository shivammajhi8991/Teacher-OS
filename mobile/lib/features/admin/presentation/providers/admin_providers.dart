import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../data/datasources/admin_remote_data_source.dart';
import '../../data/repositories/admin_repository_impl.dart';
import '../../domain/repositories/admin_repository.dart';

final adminRemoteDataSourceProvider = Provider<AdminRemoteDataSource>((ref) {
  return AdminRemoteDataSource(ref.watch(apiClientProvider).dio);
});

final adminRepositoryProvider = Provider<AdminRepository>((ref) {
  return AdminRepositoryImpl(ref.watch(adminRemoteDataSourceProvider));
});

/// Simple state holder for the Users screen's search box — a plain `StateProvider` (matching
/// `studentListFilterProvider`'s own precedent) rather than a full filter class, since there's
/// only one free-text field here.
final adminUserSearchQueryProvider = StateProvider<String>((ref) => '');

final adminUsersProvider = FutureProvider.autoDispose((ref) {
  final query = ref.watch(adminUserSearchQueryProvider);
  return ref.watch(adminRepositoryProvider).searchUsers(q: query);
});

final verificationQueueProvider = FutureProvider.autoDispose((ref) {
  return ref.watch(adminRepositoryProvider).listVerificationQueue();
});
