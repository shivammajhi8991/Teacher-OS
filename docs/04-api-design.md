# 4. API Design

## 4.1 Conventions

- Base path `/api/v1/...`. A future breaking change ships as `/api/v2/...`; both run concurrently during a deprecation window (mobile clients can't be force-upgraded instantly).
- JSON only. Standard envelope for errors:
  ```json
  { "error": { "code": "FEE_INVOICE_IMMUTABLE", "message": "human-readable", "details": {} }, "requestId": "..." }
  ```
  `code` is a stable machine-readable string the Flutter app can switch on (for localized messages), separate from `message` (English fallback, not localized server-side).
- Pagination: cursor-based (`?cursor=...&limit=50`) for high-growth lists (attendance, payments, audit logs) to stay correct under concurrent inserts; offset-based (`?page=&pageSize=`) is acceptable for small, rarely-changing lists (class rosters).
- Filtering: consistent query params — `?status=`, `?from=&to=` (dates), `?q=` (search term) — documented per-resource, not ad hoc per endpoint.
- All timestamps in request/response bodies are ISO-8601 UTC; the client localizes for display using the relevant entity's `timezone` field (class/user), never the device's own timezone, per docs/01 §1.5.

## 4.2 Idempotency

Every endpoint that creates a financial or attendance record requires an `Idempotency-Key` header (client-generated UUID, stable across retries of the *same* logical action). Server stores `(user_id, endpoint, idempotency_key) → response` for 24h; a repeat request in that window returns the original response instead of creating a duplicate. This is the single general mechanism resolving "duplicate payment," "duplicate attendance," and "request succeeded but client never saw the response" from docs/01 §1.3 — no per-endpoint special-casing.

## 4.3 Auth

```
POST   /api/v1/auth/register              # email/phone + password, or OTP-initiated
POST   /api/v1/auth/login
POST   /api/v1/auth/otp/request
POST   /api/v1/auth/otp/verify
POST   /api/v1/auth/refresh                # rotates refresh token
POST   /api/v1/auth/logout                 # revokes current device's refresh token
POST   /api/v1/auth/logout-all             # revokes all devices
POST   /api/v1/auth/password/forgot
POST   /api/v1/auth/password/reset
GET    /api/v1/auth/me                     # current user + active roles + permission set
POST   /api/v1/auth/switch-role            # for users holding multiple roles (e.g. institute owner who also teaches)
```

Rate-limited aggressively (login/OTP: 5/min/IP + 10/hour/account) — auth endpoints are the most-attacked surface.

## 4.4 Core resource groups

Each group follows standard REST verbs unless noted; only the non-obvious/critical endpoints are listed explicitly.

**Users & Profiles**
```
GET/PATCH  /api/v1/users/me
GET/PATCH  /api/v1/teacher-profiles/:id
POST       /api/v1/teacher-profiles/:id/verification-request
GET        /api/v1/teacher-categories               # public, drives onboarding UI
```

**Institutes**
```
POST/GET/PATCH  /api/v1/institutes
POST             /api/v1/institutes/:id/branches
POST             /api/v1/institutes/:id/teachers/invite
```

**Students**
```
POST   /api/v1/students                      # manual add
POST   /api/v1/students/invite                # generates link/code
POST   /api/v1/students/import                # CSV, async job — returns job id, see 4.7
GET    /api/v1/students?status=&q=&classId=
GET    /api/v1/students/:id                    # full profile incl. attendance/fee/notes summary
PATCH  /api/v1/students/:id
POST   /api/v1/students/:id/archive            # soft — never a hard DELETE
POST   /api/v1/students/merge                  # {survivingId, mergedId, reason} — docs/01 §1.3
POST   /api/v1/students/:id/guardians
```

**Classes / Batches / Schedules**
```
POST/GET/PATCH  /api/v1/classes
POST             /api/v1/classes/:id/schedule           # creates a new class_schedule_versions row
POST             /api/v1/classes/:id/exceptions          # holiday/cancel/reschedule/makeup/extra
POST             /api/v1/classes/:id/enrollments
POST             /api/v1/classes/:id/waitlist
GET              /api/v1/classes/:id/conflicts            # computed conflict-check, see docs/03 §3.5
```

**Attendance**
```
GET    /api/v1/classes/:id/attendance/:date              # roster + current marks for quick-mark screen
POST   /api/v1/classes/:id/attendance/:date/bulk          # {records:[{studentId,status}]}, idempotent
PATCH  /api/v1/attendance-records/:id                     # edit-after-mark → writes audit_log
GET    /api/v1/students/:id/attendance?from=&to=          # history + percentage
POST   /api/v1/attendance/qr/generate                     # teacher-side session QR
POST   /api/v1/attendance/qr/scan                          # student-side check-in
```

**Fees & Payments**
```
POST/GET   /api/v1/fee-structures
POST       /api/v1/invoices/generate                       # batch-generate for a billing period
GET        /api/v1/students/:id/invoices
POST       /api/v1/invoices/:id/credit-notes                # only way to correct an issued invoice
POST       /api/v1/payments                                  # offline record (cash/UPI/bank) — idempotent
POST       /api/v1/payments/gateway/initiate                  # returns gateway session
POST       /api/v1/payments/gateway/webhook                    # source of truth for gateway confirmation
POST       /api/v1/payments/:id/refund
GET        /api/v1/institutes/:id/revenue-summary
```

**Notes / Assignments**
```
POST   /api/v1/documents/upload-url            # presigned URL, see docs/02 §2.6
POST   /api/v1/documents                          # confirm upload, attach metadata
POST   /api/v1/documents/:id/share
POST/GET  /api/v1/assignments
POST      /api/v1/assignments/:id/submissions
PATCH     /api/v1/assignment-submissions/:id/review
```

**Communication / Notifications / Calendar**
```
POST/GET  /api/v1/announcements
GET/PATCH /api/v1/notifications
PATCH     /api/v1/notification-preferences
GET       /api/v1/calendar?from=&to=&ownerType=&ownerId=
```

**Reports**
```
GET  /api/v1/reports/attendance?scope=&from=&to=&format=pdf|csv
GET  /api/v1/reports/fees?scope=&from=&to=&format=pdf|csv
GET  /api/v1/reports/students/:id?format=pdf
```
Large exports run as an async job (`POST .../export-jobs` → poll `GET /export-jobs/:id` → signed download URL) rather than blocking the request — consistent with the CSV import pattern.

**Admin** (separate guard, `super_admin` only)
```
GET/PATCH  /api/v1/admin/users
GET/PATCH  /api/v1/admin/institutes
POST       /api/v1/admin/teacher-categories        # add a new category — no deploy needed
GET        /api/v1/admin/reported-content
GET        /api/v1/admin/audit-logs
PATCH      /api/v1/admin/system-config
```

## 4.5 RBAC enforcement

A `PermissionsGuard` reads the required permission off each route (`@RequirePermission('attendance.mark')` decorator), resolves the caller's effective permissions (role_permissions, cached in Redis per docs/02 §2.4), and additionally checks **resource-level scoping** — e.g. a teacher can mark attendance only for classes they own; a parent can only read (never write) a child they're linked to in `student_guardian_links`. Full matrix in `docs/06-roles-permissions.md`.

## 4.6 Real-time-ish delivery

No raw websockets at launch — push notifications (FCM) plus client polling/pull-to-refresh on dashboards covers the spec's requirements without the operational complexity of a socket layer. The one place true low-latency matters (in-app chat, explicitly called out as an *optional scalable module* in the spec) is deferred to `docs/07` roadmap as a Phase 5+ item, architected then as a separate service (e.g. via a managed provider like Stream/Sendbird, or a dedicated WS gateway) rather than bolted onto the REST API.

## 4.7 Long-running operations

CSV import, bulk invoice generation, report export, and bulk notification fan-out are all async: the triggering endpoint returns `202 Accepted` + a job id, actual work happens on a BullMQ worker (docs/02 §2.5), and the client polls or receives a push notification on completion. This keeps API pods stateless and fast, and gives every bulk operation a natural retry point if it fails partway (aligned with "file upload fails halfway" / partial-failure edge cases).

## 4.8 Security baseline (expanded in security review at Phase 6)

- All traffic HTTPS-only (HSTS enabled).
- Input validation via DTO class-validators on every endpoint; no raw SQL — TypeORM/Prisma parameterized queries only.
- File uploads validated by content-type + magic-byte sniffing server-side (never trust client-declared MIME), size-capped per file type, and served from a separate cookie-less domain to prevent XSS-via-upload.
- Rate limiting per-user and per-IP on all mutating endpoints via Redis sliding window; stricter limits on auth and payment endpoints.
- No sensitive field (password hash, refresh token, internal ids not meant for client) ever serialized in a response DTO — enforced by explicit response-DTO allowlisting, not by "just don't select that column."
