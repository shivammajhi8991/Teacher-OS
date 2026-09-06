import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/utils/result.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../data/datasources/calendar_remote_data_source.dart';
import '../../data/repositories/calendar_repository_impl.dart';
import '../../domain/entities/calendar_event.dart';
import '../../domain/repositories/calendar_repository.dart';

final calendarRemoteDataSourceProvider = Provider<CalendarRemoteDataSource>((ref) {
  return CalendarRemoteDataSource(ref.watch(apiClientProvider).dio);
});

final calendarRepositoryProvider = Provider<CalendarRepository>((ref) {
  return CalendarRepositoryImpl(ref.watch(calendarRemoteDataSourceProvider));
});

/// docs/07 Phase 5 step 6. Keyed by (from, to) so switching weeks in `CalendarScreen` gets its
/// own cached fetch rather than one shared mutable date-range provider.
final calendarProvider = FutureProvider.autoDispose
    .family<Result<List<CalendarEvent>>, ({String from, String to})>((ref, range) {
  return ref.watch(calendarRepositoryProvider).getCalendar(from: range.from, to: range.to);
});
