/// Mirrors backend `StudentImportRowError` (student-import-job.entity.ts) — one malformed row
/// never aborts the whole import, so a completed job can carry both successes and a per-row
/// failure list. `row` is 1-indexed counting the header as row 1, matching the CSV file the
/// teacher actually opened to check it.
class StudentImportRowError {
  const StudentImportRowError({required this.row, required this.message});

  final int row;
  final String message;
}

/// Mirrors backend `StudentImportJobSummary` (student-import.service.ts) — `POST /students/import`
/// returns one of these immediately (202, status `pending`), and `GET /students/import-jobs/:id`
/// returns the same shape as the fire-and-forget job actually runs.
class StudentImportJob {
  const StudentImportJob({
    required this.id,
    required this.status,
    required this.totalRows,
    required this.successCount,
    required this.failureCount,
    required this.errors,
    required this.createdAt,
    this.completedAt,
  });

  final String id;
  final String status; // 'pending' | 'processing' | 'completed' | 'failed'
  final int totalRows;
  final int successCount;
  final int failureCount;
  final List<StudentImportRowError> errors;
  final DateTime createdAt;
  final DateTime? completedAt;

  bool get isDone => status == 'completed' || status == 'failed';
}
