import 'package:dio/dio.dart';
import '../../../../core/network/api_exception_mapper.dart';
import '../../../../core/utils/result.dart';
import '../../domain/entities/assignment_summary.dart';
import '../../domain/entities/submission_summary.dart';
import '../../domain/repositories/assignments_repository.dart';
import '../datasources/assignments_remote_data_source.dart';
import '../dto/assignment_summary_dto.dart';
import '../dto/submission_summary_dto.dart';

class AssignmentsRepositoryImpl implements AssignmentsRepository {
  const AssignmentsRepositoryImpl(this._remoteDataSource);

  final AssignmentsRemoteDataSource _remoteDataSource;

  @override
  Future<Result<List<AssignmentSummary>>> listAssignments({String? classId, String? studentId}) async {
    try {
      final json = await _remoteDataSource.listAssignments(classId: classId, studentId: studentId);
      final assignments = json
          .map((item) => AssignmentSummaryDto.fromJson(item as Map<String, dynamic>).toEntity())
          .toList();
      return Ok(assignments);
    } on DioException catch (e) {
      return Err(mapDioExceptionToFailure(e));
    }
  }

  @override
  Future<Result<AssignmentSummary>> getAssignment(String id) async {
    try {
      final json = await _remoteDataSource.getAssignment(id);
      return Ok(AssignmentSummaryDto.fromJson(json).toEntity());
    } on DioException catch (e) {
      return Err(mapDioExceptionToFailure(e));
    }
  }

  @override
  Future<Result<void>> createClassAssignment({
    required String classId,
    required String title,
    String? description,
    required DateTime dueAt,
    bool allowLateSubmission = true,
    bool allowResubmission = false,
  }) async {
    try {
      await _remoteDataSource.createAssignment(
        title: title,
        description: description,
        classId: classId,
        dueAt: dueAt.toIso8601String(),
        allowLateSubmission: allowLateSubmission,
        allowResubmission: allowResubmission,
      );
      return const Ok(null);
    } on DioException catch (e) {
      return Err(mapDioExceptionToFailure(e));
    }
  }

  @override
  Future<Result<List<SubmissionSummary>>> listSubmissions(String assignmentId) async {
    try {
      final json = await _remoteDataSource.listSubmissions(assignmentId);
      final submissions = json
          .map((item) => SubmissionSummaryDto.fromJson(item as Map<String, dynamic>).toEntity())
          .toList();
      return Ok(submissions);
    } on DioException catch (e) {
      return Err(mapDioExceptionToFailure(e));
    }
  }

  @override
  Future<Result<void>> submitAssignment({required String assignmentId, required String url}) async {
    try {
      await _remoteDataSource.createSubmission(assignmentId, [url]);
      return const Ok(null);
    } on DioException catch (e) {
      return Err(mapDioExceptionToFailure(e));
    }
  }

  @override
  Future<Result<void>> reviewSubmission({
    required String submissionId,
    String? grade,
    String? feedback,
  }) async {
    try {
      await _remoteDataSource.reviewSubmission(submissionId, grade: grade, feedback: feedback);
      return const Ok(null);
    } on DioException catch (e) {
      return Err(mapDioExceptionToFailure(e));
    }
  }
}
