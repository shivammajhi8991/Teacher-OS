import 'package:dio/dio.dart';
import '../../../../core/network/api_exception_mapper.dart';
import '../../../../core/utils/result.dart';
import '../../domain/entities/announcement.dart';
import '../../domain/repositories/announcements_repository.dart';
import '../datasources/announcements_remote_data_source.dart';
import '../dto/announcement_dto.dart';

class AnnouncementsRepositoryImpl implements AnnouncementsRepository {
  const AnnouncementsRepositoryImpl(this._remoteDataSource);

  final AnnouncementsRemoteDataSource _remoteDataSource;

  @override
  Future<Result<List<Announcement>>> listAnnouncements() async {
    try {
      final json = await _remoteDataSource.listAnnouncements();
      final announcements =
          json.map((item) => AnnouncementDto.fromJson(item as Map<String, dynamic>).toEntity()).toList();
      return Ok(announcements);
    } on DioException catch (e) {
      return Err(mapDioExceptionToFailure(e));
    }
  }

  @override
  Future<Result<void>> createAnnouncement({
    required String targetType,
    String? targetId,
    required String title,
    required String body,
  }) async {
    try {
      await _remoteDataSource.createAnnouncement(
        targetType: targetType,
        targetId: targetId,
        title: title,
        body: body,
      );
      return const Ok(null);
    } on DioException catch (e) {
      return Err(mapDioExceptionToFailure(e));
    }
  }
}
