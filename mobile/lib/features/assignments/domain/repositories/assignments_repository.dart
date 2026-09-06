import '../../../../core/utils/result.dart';
import '../entities/assignment_summary.dart';
import '../entities/submission_summary.dart';

abstract interface class AssignmentsRepository {
  /// docs/04 §4.4 GET /assignments — the server scopes results by the caller's role on its own
  /// (own-created for a teacher, own-targeted for a student), so `classId`/`studentId` here are
  /// narrowing filters, not the access boundary itself.
  Future<Result<List<AssignmentSummary>>> listAssignments({String? classId, String? studentId});

  Future<Result<AssignmentSummary>> getAssignment(String id);

  /// docs/08 §8.2 "Create assignment: Title, attachments, deadline, target." Mobile scope is
  /// class-targeted, attachment-free creation (documented deviation, see
  /// create_assignment_dialog.dart) — the backend supports both individual-student targeting and
  /// real attachments already.
  Future<Result<void>> createClassAssignment({
    required String classId,
    required String title,
    String? description,
    required DateTime dueAt,
    bool allowLateSubmission = true,
    bool allowResubmission = false,
  });

  Future<Result<List<SubmissionSummary>>> listSubmissions(String assignmentId);

  /// docs/08 §8.5 "submits (camera/file picker...)" — mobile scope is one external link per
  /// submission instead (documented deviation, same reasoning as Notes' link-only notes: no
  /// `file_picker`/`image_picker` dependency pulled into this pass).
  Future<Result<void>> submitAssignment({required String assignmentId, required String url});

  Future<Result<void>> reviewSubmission({
    required String submissionId,
    String? grade,
    String? feedback,
  });
}
