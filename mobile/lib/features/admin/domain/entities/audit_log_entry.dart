/// Mirrors backend `AuditLogEntry` (admin.service.ts) — a unified view over the two audit trails
/// this codebase actually writes to: `attendance_audit_log` (an attendance mark edited after the
/// fact) and `payment_audit_log` (a payment's status transition, including webhook-driven ones,
/// where [changedByName] is null — nobody, a system event moved it).
class AuditLogEntry {
  const AuditLogEntry({
    required this.id,
    required this.source,
    required this.previousStatus,
    required this.newStatus,
    required this.changedByName,
    required this.changedAt,
    required this.note,
  });

  final String id;
  final String source; // 'attendance' | 'payment'
  final String previousStatus;
  final String newStatus;
  final String? changedByName;
  final DateTime changedAt;
  final String? note;
}

/// One page of [AuditLogEntry], oldest-cutoff `nextCursor` for the next `listAuditLog` call —
/// `null` once nothing older is left to fetch (docs/04 §4.1's own cursor-pagination convention
/// for "high-growth lists," audit logs named explicitly).
class AuditLogPage {
  const AuditLogPage({required this.entries, required this.nextCursor});

  final List<AuditLogEntry> entries;
  final String? nextCursor;
}
