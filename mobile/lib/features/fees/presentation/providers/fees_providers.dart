import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../data/datasources/fees_remote_data_source.dart';
import '../../data/repositories/fees_repository_impl.dart';
import '../../domain/repositories/fees_repository.dart';

// docs/05 §5.1 usecase note — same call as classes_providers.dart: with only two operations here
// (read invoices, record a payment), a usecase-wrapper class per action isn't earning its keep
// yet; the screen calls the repository directly.
final feesRemoteDataSourceProvider = Provider<FeesRemoteDataSource>((ref) {
  return FeesRemoteDataSource(ref.watch(apiClientProvider).dio);
});

final feesRepositoryProvider = Provider<FeesRepository>((ref) {
  return FeesRepositoryImpl(ref.watch(feesRemoteDataSourceProvider));
});

final studentInvoicesProvider = FutureProvider.autoDispose.family((ref, String studentId) {
  return ref.watch(feesRepositoryProvider).getStudentInvoices(studentId);
});

/// docs/08 §8.2 "Fees overview" — "which of my students owe money, worst first," scoped
/// server-side to the caller's role (teacher: their own students; institute_admin: their
/// institute; super_admin: everyone). No params: unlike `studentInvoicesProvider`, there's no
/// single owner to key a family provider by.
final feesOverviewProvider = FutureProvider.autoDispose((ref) {
  return ref.watch(feesRepositoryProvider).getInvoiceOverview();
});
