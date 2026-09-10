import '../../domain/entities/student_import_job.dart';

class StudentImportRowErrorDto {
  const StudentImportRowErrorDto({required this.row, required this.message});

  factory StudentImportRowErrorDto.fromJson(Map<String, dynamic> json) =>
      StudentImportRowErrorDto(
        row: json['row'] as int,
        message: json['message'] as String,
      );

  final int row;
  final String message;

  StudentImportRowError toEntity() => StudentImportRowError(row: row, message: message);
}

class StudentImportJobDto {
  const StudentImportJobDto({
    required this.id,
    required this.status,
    required this.totalRows,
    required this.successCount,
    required this.failureCount,
    required this.errors,
    required this.createdAt,
    this.completedAt,
  });

  factory StudentImportJobDto.fromJson(Map<String, dynamic> json) => StudentImportJobDto(
        id: json['id'] as String,
        status: json['status'] as String,
        totalRows: json['totalRows'] as int,
        successCount: json['successCount'] as int,
        failureCount: json['failureCount'] as int,
        errors: (json['errors'] as List<dynamic>)
            .map((e) => StudentImportRowErrorDto.fromJson(e as Map<String, dynamic>))
            .toList(),
        createdAt: DateTime.parse(json['createdAt'] as String),
        completedAt:
            json['completedAt'] == null ? null : DateTime.parse(json['completedAt'] as String),
      );

  final String id;
  final String status;
  final int totalRows;
  final int successCount;
  final int failureCount;
  final List<StudentImportRowErrorDto> errors;
  final DateTime createdAt;
  final DateTime? completedAt;

  StudentImportJob toEntity() => StudentImportJob(
        id: id,
        status: status,
        totalRows: totalRows,
        successCount: successCount,
        failureCount: failureCount,
        errors: errors.map((e) => e.toEntity()).toList(),
        createdAt: createdAt,
        completedAt: completedAt,
      );
}
