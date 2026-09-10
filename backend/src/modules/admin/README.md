# admin module

Scaffolded per docs/07-roadmap.md Phase 5/6. Surface backing the Admin Web Panel (docs/02 §2.8):
user/institute management, teacher-category CRUD (the mechanism that lets new teacher categories
ship without a deploy — docs/01 §1.1), verification review, reported content, system config,
subscription plans, audit-log viewer. User/institute/teacher-category/verification live in their
own modules (`users`, `institutes`, `teacher-profiles`) — this module holds only what doesn't
belong to one of those.

**Implemented**: `GET /admin/audit-logs` — unifies `attendance_audit_log` and
`payment_audit_log` (docs/03), the only two audit trails this codebase actually writes to, into
one time-sorted, cursor-paginated feed. `audit_log.read`-gated, scoped by role in the service
(super_admin sees every institute, institute_admin only their own) — the same
shared-permission pattern `user.administer`/`AdminUsersService` already established.

**Not implemented, no backing data model anywhere in this codebase**: reported content (no
flagging/moderation mechanism — what gets reported, by whom, what review actions exist, none of
it specced anywhere in docs/01-08) and system config (no config table, no definition of what it
would even configure). Both are named as real nav destinations with an honest "coming soon" in
`admin_panel_shell_screen.dart` rather than invented from nothing or silently hidden.

Endpoints to implement: docs/04-api-design.md §4.4 "Admin".
