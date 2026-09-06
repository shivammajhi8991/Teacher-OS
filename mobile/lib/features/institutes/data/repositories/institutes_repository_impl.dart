import 'package:dio/dio.dart';
import '../../../../core/network/api_exception_mapper.dart';
import '../../../../core/utils/result.dart';
import '../../domain/entities/teacher_invite.dart';
import '../../domain/entities/teacher_roster_entry.dart';
import '../../domain/repositories/institutes_repository.dart';
import '../datasources/institutes_remote_data_source.dart';
import '../dto/teacher_invite_dto.dart';
import '../dto/teacher_roster_entry_dto.dart';

class InstitutesRepositoryImpl implements InstitutesRepository {
  const InstitutesRepositoryImpl(this._remoteDataSource);

  final InstitutesRemoteDataSource _remoteDataSource;

  @override
  Future<Result<List<TeacherRosterEntry>>> listTeachers(String instituteId) async {
    try {
      final json = await _remoteDataSource.listTeachers(instituteId);
      final roster = json
          .map((item) => TeacherRosterEntryDto.fromJson(item as Map<String, dynamic>).toEntity())
          .toList();
      return Ok(roster);
    } on DioException catch (e) {
      return Err(mapDioExceptionToFailure(e));
    }
  }

  @override
  Future<Result<TeacherInvite>> createTeacherInvite(String instituteId, {int? expiresInDays}) async {
    try {
      final json = await _remoteDataSource.createTeacherInvite(instituteId, expiresInDays: expiresInDays);
      return Ok(TeacherInviteDto.fromJson(json).toEntity());
    } on DioException catch (e) {
      return Err(mapDioExceptionToFailure(e));
    }
  }
}
