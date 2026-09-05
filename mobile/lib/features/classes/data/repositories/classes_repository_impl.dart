import 'package:dio/dio.dart';
import '../../../../core/network/api_exception_mapper.dart';
import '../../../../core/utils/result.dart';
import '../../domain/entities/class_schedule.dart';
import '../../domain/entities/enrollment_summary.dart';
import '../../domain/entities/schedule_conflict.dart';
import '../../domain/entities/teaching_class.dart';
import '../../domain/repositories/classes_repository.dart';
import '../datasources/classes_remote_data_source.dart';
import '../dto/class_schedule_dto.dart';
import '../dto/enrollment_summary_dto.dart';
import '../dto/schedule_conflict_dto.dart';
import '../dto/teaching_class_dto.dart';

class ClassesRepositoryImpl implements ClassesRepository {
  const ClassesRepositoryImpl(this._remoteDataSource);

  final ClassesRemoteDataSource _remoteDataSource;

  @override
  Future<Result<TeachingClass>> createClass({
    required String name,
    String? subjectOrActivity,
    String? classType,
    required String mode,
    String? locationOrMeetingLink,
    int? capacityMax,
    required String startDate,
    String? endDate,
  }) async {
    try {
      final json = await _remoteDataSource.createClass(
        name: name,
        subjectOrActivity: subjectOrActivity,
        classType: classType,
        mode: mode,
        locationOrMeetingLink: locationOrMeetingLink,
        capacityMax: capacityMax,
        startDate: startDate,
        endDate: endDate,
      );
      return Ok(TeachingClassDto.fromJson(json).toEntity());
    } on DioException catch (e) {
      return Err(mapDioExceptionToFailure(e));
    }
  }

  @override
  Future<Result<List<TeachingClass>>> listClasses({String? status}) async {
    try {
      final json = await _remoteDataSource.listClasses(status: status);
      final classes =
          json.map((item) => TeachingClassDto.fromJson(item as Map<String, dynamic>).toEntity()).toList();
      return Ok(classes);
    } on DioException catch (e) {
      return Err(mapDioExceptionToFailure(e));
    }
  }

  @override
  Future<Result<TeachingClass>> getClass(String id) async {
    try {
      final json = await _remoteDataSource.getClass(id);
      return Ok(TeachingClassDto.fromJson(json).toEntity());
    } on DioException catch (e) {
      return Err(mapDioExceptionToFailure(e));
    }
  }

  @override
  Future<Result<TeachingClass>> updateClass(
    String id, {
    String? name,
    String? subjectOrActivity,
    String? mode,
    String? locationOrMeetingLink,
    int? capacityMax,
    String? endDate,
    String? status,
  }) async {
    try {
      final json = await _remoteDataSource.updateClass(
        id,
        name: name,
        subjectOrActivity: subjectOrActivity,
        mode: mode,
        locationOrMeetingLink: locationOrMeetingLink,
        capacityMax: capacityMax,
        endDate: endDate,
        status: status,
      );
      return Ok(TeachingClassDto.fromJson(json).toEntity());
    } on DioException catch (e) {
      return Err(mapDioExceptionToFailure(e));
    }
  }

  @override
  Future<Result<ClassSchedule?>> getSchedule(String classId) async {
    try {
      final json = await _remoteDataSource.getSchedule(classId);
      return Ok(json == null ? null : ClassScheduleDto.fromJson(json).toEntity());
    } on DioException catch (e) {
      return Err(mapDioExceptionToFailure(e));
    }
  }

  @override
  Future<Result<ClassSchedule>> setSchedule(
    String classId, {
    required String effectiveFrom,
    required String recurrenceRule,
    required String startTime,
    required String endTime,
    String? timezone,
  }) async {
    try {
      final json = await _remoteDataSource.setSchedule(
        classId,
        effectiveFrom: effectiveFrom,
        recurrenceRule: recurrenceRule,
        startTime: startTime,
        endTime: endTime,
        timezone: timezone,
      );
      return Ok(ClassScheduleDto.fromJson(json).toEntity());
    } on DioException catch (e) {
      return Err(mapDioExceptionToFailure(e));
    }
  }

  @override
  Future<Result<List<ScheduleConflict>>> getConflicts(String classId) async {
    try {
      final json = await _remoteDataSource.getConflicts(classId);
      final conflicts =
          json.map((item) => ScheduleConflictDto.fromJson(item as Map<String, dynamic>).toEntity()).toList();
      return Ok(conflicts);
    } on DioException catch (e) {
      return Err(mapDioExceptionToFailure(e));
    }
  }

  @override
  Future<Result<List<EnrollmentSummary>>> getEnrollments(String classId) async {
    try {
      final json = await _remoteDataSource.getEnrollments(classId);
      final enrollments = json
          .map((item) => EnrollmentSummaryDto.fromJson(item as Map<String, dynamic>).toEntity())
          .toList();
      return Ok(enrollments);
    } on DioException catch (e) {
      return Err(mapDioExceptionToFailure(e));
    }
  }

  @override
  Future<Result<EnrollmentSummary>> enrollStudent(
    String classId,
    String studentId, {
    String? enrollmentType,
  }) async {
    try {
      final json = await _remoteDataSource.enrollStudent(
        classId,
        studentId,
        enrollmentType: enrollmentType,
      );
      return Ok(EnrollmentSummaryDto.fromJson(json).toEntity());
    } on DioException catch (e) {
      return Err(mapDioExceptionToFailure(e));
    }
  }

  @override
  Future<Result<void>> addToWaitlist(String classId, String studentId) async {
    try {
      await _remoteDataSource.addToWaitlist(classId, studentId);
      return const Ok(null);
    } on DioException catch (e) {
      return Err(mapDioExceptionToFailure(e));
    }
  }
}
