import '../../domain/entities/audit_log_entry.dart';

class AuditLogEntryDto {
  const AuditLogEntryDto({
    required this.id,
    required this.source,
    required this.previousStatus,
    required this.newStatus,
    required this.changedByName,
    required this.changedAt,
    required this.note,
  });

  factory AuditLogEntryDto.fromJson(Map<String, dynamic> json) => AuditLogEntryDto(
        id: json['id'] as String,
        source: json['source'] as String,
        previousStatus: json['previousStatus'] as String,
        newStatus: json['newStatus'] as String,
        changedByName: json['changedByName'] as String?,
        changedAt: DateTime.parse(json['changedAt'] as String),
        note: json['note'] as String?,
      );

  final String id;
  final String source;
  final String previousStatus;
  final String newStatus;
  final String? changedByName;
  final DateTime changedAt;
  final String? note;

  AuditLogEntry toEntity() => AuditLogEntry(
        id: id,
        source: source,
        previousStatus: previousStatus,
        newStatus: newStatus,
        changedByName: changedByName,
        changedAt: changedAt,
        note: note,
      );
}

class AuditLogPageDto {
  const AuditLogPageDto({required this.entries, required this.nextCursor});

  factory AuditLogPageDto.fromJson(Map<String, dynamic> json) => AuditLogPageDto(
        entries: (json['entries'] as List<dynamic>)
            .map((e) => AuditLogEntryDto.fromJson(e as Map<String, dynamic>))
            .toList(),
        nextCursor: json['nextCursor'] as String?,
      );

  final List<AuditLogEntryDto> entries;
  final String? nextCursor;

  AuditLogPage toEntity() => AuditLogPage(
        entries: entries.map((e) => e.toEntity()).toList(),
        nextCursor: nextCursor,
      );
}
