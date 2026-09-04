# 6. Roles & Permissions (RBAC)

## 6.1 Model

- A `user` can hold multiple `(role, institute_id)` pairs simultaneously (docs/03 §3.2) — e.g. an institute owner who also teaches holds both `institute_admin` and `teacher` for the same institute; a `super_admin` role is platform-level (`institute_id` null, only assignable by another super admin, itself audit-logged).
- Permissions are fine-grained strings (`resource.action`), grouped into roles via `role_permissions`. Institutes cannot grant permissions beyond what their plan/tier allows (checked against `subscription_plans`, future-ready per docs/07), but cannot exceed the fixed platform ceiling below regardless of plan.
- **Resource-level scoping is enforced in addition to role permissions** — holding `attendance.mark` only lets a teacher mark attendance for classes where they are the assigned teacher, never any class in the institute. This is the difference between RBAC (can this role ever do X) and the per-request authorization check (can *this* user do X *to this specific record*) — both layers are required; role alone is not sufficient.

## 6.2 Permission matrix

Legend: **F** full (create/read/update/delete-or-archive), **R** read-only, **O** own-records-only, **–** no access.

| Resource / Action | Teacher | Student | Parent | Institute Admin | Super Admin |
|---|---|---|---|---|---|
| Own profile | F | F | F | F | F |
| Teacher profile (others') | R (same institute) | R (assigned teacher) | R (assigned teacher) | F (institute's teachers) | F |
| Student profile | F (own students) | O (self) | O (linked child) | F (institute) | F |
| Student PII (medical/emergency) | R (own students) | O | O (linked child) | R | R |
| Guardian links | F (own students) | – | O (self, request only) | F | F |
| Classes/batches | F (own) | R (enrolled) | R (linked child's) | F (institute) | F |
| Schedule / reschedule / cancel | F (own classes) | – | – | F (institute) | – |
| Enrollment / waitlist | F (own classes) | Request-join only | Request-join for child | F | F |
| Attendance — mark | O (own classes) | – | – | – (delegatable, see 6.3) | – |
| Attendance — view | F (own classes) | O (self) | O (linked child) | R (institute) | R |
| Attendance — edit after mark | O + audit log | – | – | – | – |
| Fee structures | F (own) | R (applicable) | R (child's) | F (institute) | R |
| Invoices — generate/issue | F (own students) | – | – | F | – |
| Invoices — view | R (own students) | O (self) | O (linked child) | R (institute) | R |
| Payments — record offline | F (own students) | – | – | F | – |
| Payments — refund/credit note | F (own students) | – | – | F, above a threshold requires 2nd approver (future) | F |
| Notes/documents — upload/share | F (own) | – | – | F | R |
| Notes/documents — view/download | – | O (shared with self) | O (shared with child) | R | R |
| Assignments — create/review | F (own classes) | – | – | R | R |
| Assignments — submit | – | O (self) | – | – | – |
| Announcements — send | F (own classes) | – | – | F (institute-wide) | F (platform-wide) |
| Announcements — read | R | R | R | R | R |
| Performance metrics — define | F (own) | – | – | F (institute defaults) | F (category defaults) |
| Performance metrics — record | F (own students) | – | – | R | R |
| Performance metrics — view | R (own students) | O (self) | O (linked child) | R | R |
| Calendar | F (own) | R (own) | R (child's) | R (institute) | R |
| Reports/analytics | F (own scope) | – | – | F (institute scope) | F (platform scope) |
| Institute management | – | – | – | F (own institute) | F |
| Teacher category management | – | – | – | – | F |
| User/role administration | – | – | – | O (own institute's users) | F |
| Verification review | – | – | – | – | F |
| System config / subscription plans | – | – | – | – | F |
| Audit logs | O (own actions, read) | – | – | R (institute scope) | F |

## 6.3 Notable exceptions & delegation

- **Institute admin does not mark attendance or record payments by default** — that ceiling is intentional (it's the teacher's classroom action) but is a *configurable* per-institute policy toggle (`institutes.allow_admin_attendance_override`) since some coaching institutes centralize this with front-desk staff rather than teachers. Default is off; enabling it is itself an audit-logged admin action.
- **Parents never get write access to a child's records** — this is deliberate, not an oversight: it keeps attendance/performance data as the teacher's authoritative record, avoiding disputes over who last edited a grade. Parents can *request* changes (e.g., report an absence in advance) via a request/approve flow, never edit directly.
- **A minor student without their own login** (docs/03 §3.4, `student_profiles.user_id` nullable) has all access exercised by their linked guardian(s) under the Parent row above — there is no separate "no-login student" row in this matrix because the guardian *is* the acting principal in that case.
- **Refunds/credit notes above a configurable threshold** requiring a second approver is listed as a future item (docs/07) — flagged here because it's a permissions-model concern, not just a UI one: the matrix above already reserves the hook (`institute_admin` capped at "above threshold requires 2nd approver (future)") so it doesn't need a schema change later.

## 6.4 Enforcement points

Every row above is enforced twice, independently (defense in depth, per docs/02 §2.3, §2.4 and docs/04 §4.5):

1. **Backend `PermissionsGuard` + resource-scoping check** on every API route — the actual authority.
2. **Flutter route guards + conditional UI rendering** (docs/05 §5.3) — purely a UX convenience to avoid showing controls that would fail server-side; never trusted as the security boundary, since a modified client can call the API directly.
