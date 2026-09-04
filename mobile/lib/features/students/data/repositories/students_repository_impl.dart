import 'package:dio/dio.dart';
import '../../../../core/network/api_exception_mapper.dart';
import '../../../../core/utils/result.dart';
import '../../domain/entities/guardian_info.dart';
import '../../domain/entities/guardian_input.dart';
import '../../domain/entities/student.dart';
import '../../domain/entities/student_detail.dart';
import '../../domain/repositories/students_repository.dart';
import '../datasources/students_remote_data_source.dart';
import '../dto/guardian_summary_dto.dart';
import '../dto/student_detail_dto.dart';
import '../dto/student_dto.dart';

class StudentsRepositoryImpl implements StudentsRepository {
  const StudentsRepositoryImpl(this._remoteDataSource);

  final StudentsRemoteDataSource _remoteDataSource;

  @override
  Future<Result<Student>> createStudent({
    required String fullName,
    String? dob,
    String? gender,
    String? emergencyContactName,
    String? emergencyContactPhone,
    String? medicalNotes,
    String? joinDate,
    List<GuardianInput> guardians = const [],
  }) async {
    try {
      final json = await _remoteDataSource.createStudent(
        fullName: fullName,
        dob: dob,
        gender: gender,
        emergencyContactName: emergencyContactName,
        emergencyContactPhone: emergencyContactPhone,
        medicalNotes: medicalNotes,
        joinDate: joinDate,
        guardians: guardians,
      );
      return Ok(StudentDto.fromJson(json).toEntity());
    } on DioException catch (e) {
      return Err(mapDioExceptionToFailure(e));
    }
  }

  @override
  Future<Result<List<Student>>> listStudents({String? status, String? q}) async {
    try {
      final json = await _remoteDataSource.listStudents(status: status, q: q);
      final students = json
          .map((item) => StudentDto.fromJson(item as Map<String, dynamic>).toEntity())
          .toList();
      return Ok(students);
    } on DioException catch (e) {
      return Err(mapDioExceptionToFailure(e));
    }
  }

  @override
  Future<Result<StudentDetail>> getStudentDetail(String id) async {
    try {
      final json = await _remoteDataSource.getStudentDetail(id);
      return Ok(StudentDetailDto.fromJson(json).toEntity());
    } on DioException catch (e) {
      return Err(mapDioExceptionToFailure(e));
    }
  }

  @override
  Future<Result<Student>> updateStudent(
    String id, {
    String? fullName,
    String? dob,
    String? gender,
    String? emergencyContactName,
    String? emergencyContactPhone,
    String? medicalNotes,
    String? enrollmentStatus,
  }) async {
    try {
      final json = await _remoteDataSource.updateStudent(
        id,
        fullName: fullName,
        dob: dob,
        gender: gender,
        emergencyContactName: emergencyContactName,
        emergencyContactPhone: emergencyContactPhone,
        medicalNotes: medicalNotes,
        enrollmentStatus: enrollmentStatus,
      );
      return Ok(StudentDto.fromJson(json).toEntity());
    } on DioException catch (e) {
      return Err(mapDioExceptionToFailure(e));
    }
  }

  @override
  Future<Result<void>> archiveStudent(String id) async {
    try {
      await _remoteDataSource.archiveStudent(id);
      return const Ok(null);
    } on DioException catch (e) {
      return Err(mapDioExceptionToFailure(e));
    }
  }

  @override
  Future<Result<GuardianInfo>> addGuardian(String studentId, GuardianInput guardian) async {
    try {
      final json = await _remoteDataSource.addGuardian(studentId, guardian);
      return Ok(GuardianSummaryDto.fromJson(json).toEntity());
    } on DioException catch (e) {
      return Err(mapDioExceptionToFailure(e));
    }
  }

  @override
  Future<Result<void>> mergeStudents({
    required String survivingStudentId,
    required String mergedStudentId,
    required String reason,
  }) async {
    try {
      await _remoteDataSource.mergeStudents(
        survivingStudentId: survivingStudentId,
        mergedStudentId: mergedStudentId,
        reason: reason,
      );
      return const Ok(null);
    } on DioException catch (e) {
      return Err(mapDioExceptionToFailure(e));
    }
  }

  @override
  Future<Result<StudentInviteResult>> createInvite({int? expiresInDays}) async {
    try {
      final json = await _remoteDataSource.createInvite(expiresInDays: expiresInDays);
      return Ok(StudentInviteResult(
        code: json['code'] as String,
        expiresAt: json['expiresAt'] == null ? null : DateTime.parse(json['expiresAt'] as String),
      ));
    } on DioException catch (e) {
      return Err(mapDioExceptionToFailure(e));
    }
  }
}
