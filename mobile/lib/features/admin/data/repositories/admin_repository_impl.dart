import 'package:dio/dio.dart';
import '../../../../core/network/api_exception_mapper.dart';
import '../../../../core/utils/result.dart';
import '../../domain/entities/admin_teacher_category.dart';
import '../../domain/entities/admin_user.dart';
import '../../domain/entities/verification_queue_entry.dart';
import '../../domain/repositories/admin_repository.dart';
import '../datasources/admin_remote_data_source.dart';
import '../dto/admin_teacher_category_dto.dart';
import '../dto/admin_user_dto.dart';
import '../dto/verification_queue_entry_dto.dart';

class AdminRepositoryImpl implements AdminRepository {
  const AdminRepositoryImpl(this._remoteDataSource);

  final AdminRemoteDataSource _remoteDataSource;

  @override
  Future<Result<List<AdminUser>>> searchUsers({String? q, String? status}) async {
    try {
      final json = await _remoteDataSource.searchUsers(q: q, status: status);
      final users =
          json.map((item) => AdminUserDto.fromJson(item as Map<String, dynamic>).toEntity()).toList();
      return Ok(users);
    } on DioException catch (e) {
      return Err(mapDioExceptionToFailure(e));
    }
  }

  @override
  Future<Result<void>> updateUserStatus(String userId, String status) async {
    try {
      await _remoteDataSource.updateUserStatus(userId, status);
      return const Ok(null);
    } on DioException catch (e) {
      return Err(mapDioExceptionToFailure(e));
    }
  }

  @override
  Future<Result<void>> assignUserRole(String userId, {required String role, String? instituteId}) async {
    try {
      await _remoteDataSource.assignUserRole(userId, role: role, instituteId: instituteId);
      return const Ok(null);
    } on DioException catch (e) {
      return Err(mapDioExceptionToFailure(e));
    }
  }

  @override
  Future<Result<List<VerificationQueueEntry>>> listVerificationQueue() async {
    try {
      final json = await _remoteDataSource.listVerificationQueue();
      final queue = json
          .map((item) => VerificationQueueEntryDto.fromJson(item as Map<String, dynamic>).toEntity())
          .toList();
      return Ok(queue);
    } on DioException catch (e) {
      return Err(mapDioExceptionToFailure(e));
    }
  }

  @override
  Future<Result<void>> reviewVerificationRequest(
    String requestId, {
    required String decision,
    String? rejectionReason,
  }) async {
    try {
      await _remoteDataSource.reviewVerificationRequest(
        requestId,
        decision: decision,
        rejectionReason: rejectionReason,
      );
      return const Ok(null);
    } on DioException catch (e) {
      return Err(mapDioExceptionToFailure(e));
    }
  }

  @override
  Future<Result<AdminTeacherCategory>> createTeacherCategory({required String name, String? icon}) async {
    try {
      final json = await _remoteDataSource.createTeacherCategory(name: name, icon: icon);
      return Ok(AdminTeacherCategoryDto.fromJson(json).toEntity());
    } on DioException catch (e) {
      return Err(mapDioExceptionToFailure(e));
    }
  }

  @override
  Future<Result<AdminTeacherCategory>> updateTeacherCategory(String id, {bool? isActive}) async {
    try {
      final json = await _remoteDataSource.updateTeacherCategory(id, isActive: isActive);
      return Ok(AdminTeacherCategoryDto.fromJson(json).toEntity());
    } on DioException catch (e) {
      return Err(mapDioExceptionToFailure(e));
    }
  }
}
