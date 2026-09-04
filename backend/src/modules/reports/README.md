# reports module (not yet implemented)

Scaffolded per docs/07-roadmap.md Phase 5. Attendance/fee/student reports, PDF/CSV export via the
async export-job pattern (docs/04 §4.7 — `POST .../export-jobs` → poll → signed download URL),
run as BullMQ workers (docs/02 §2.5) rather than blocking the request.

Endpoints to implement: docs/04-api-design.md §4.4 "Reports".
