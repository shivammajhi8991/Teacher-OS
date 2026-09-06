import '../../../../core/utils/result.dart';
import '../entities/generated_report.dart';

abstract interface class ReportsRepository {
  /// `format` is 'csv' or 'pdf' (docs/04 §4.4 `GET /reports/attendance`). Scope (own classes,
  /// own institute, or platform) is resolved server-side from the caller — this never sends a
  /// scope id, matching ReportQueryDto's own header comment on the backend.
  Future<Result<GeneratedReport>> generateAttendanceReport({
    required String from,
    required String to,
    required String format,
  });

  Future<Result<GeneratedReport>> generateFeesReport({
    required String from,
    required String to,
    required String format,
  });

  /// PDF only — the backend rejects 'csv' for this one (StudentReportQueryDto).
  Future<Result<GeneratedReport>> generateStudentReport(String studentId);
}
