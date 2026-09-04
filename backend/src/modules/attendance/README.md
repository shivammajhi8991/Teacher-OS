# attendance module (not yet implemented)

Scaffolded per docs/07-roadmap.md Phase 4 step 5. Covers `attendance_sessions`,
`attendance_records`, `attendance_audit_log` (docs/03 §3.6). Bulk-mark and edit-with-audit
endpoints must honor the idempotency-key contract (docs/04 §4.2) and the
"never mutate a record already referenced by an issued invoice" rule (docs/01 §1.5).

Endpoints to implement: docs/04-api-design.md §4.4 "Attendance".
