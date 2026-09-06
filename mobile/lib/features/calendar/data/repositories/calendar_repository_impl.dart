import 'package:dio/dio.dart';
import '../../../../core/network/api_exception_mapper.dart';
import '../../../../core/utils/result.dart';
import '../../domain/entities/calendar_event.dart';
import '../../domain/repositories/calendar_repository.dart';
import '../datasources/calendar_remote_data_source.dart';
import '../dto/calendar_event_dto.dart';

class CalendarRepositoryImpl implements CalendarRepository {
  const CalendarRepositoryImpl(this._remoteDataSource);

  final CalendarRemoteDataSource _remoteDataSource;

  @override
  Future<Result<List<CalendarEvent>>> getCalendar({
    required String from,
    required String to,
  }) async {
    try {
      final json = await _remoteDataSource.getCalendar(from: from, to: to);
      final events =
          json.map((item) => CalendarEventDto.fromJson(item as Map<String, dynamic>).toEntity()).toList();
      return Ok(events);
    } on DioException catch (e) {
      return Err(mapDioExceptionToFailure(e));
    }
  }
}
