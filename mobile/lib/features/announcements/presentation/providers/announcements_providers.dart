import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../data/datasources/announcements_remote_data_source.dart';
import '../../data/repositories/announcements_repository_impl.dart';
import '../../domain/repositories/announcements_repository.dart';

final announcementsRemoteDataSourceProvider = Provider<AnnouncementsRemoteDataSource>((ref) {
  return AnnouncementsRemoteDataSource(ref.watch(apiClientProvider).dio);
});

final announcementsRepositoryProvider = Provider<AnnouncementsRepository>((ref) {
  return AnnouncementsRepositoryImpl(ref.watch(announcementsRemoteDataSourceProvider));
});

final announcementsListProvider = FutureProvider.autoDispose((ref) {
  return ref.watch(announcementsRepositoryProvider).listAnnouncements();
});
