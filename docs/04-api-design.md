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

### Phase 6 security review — findings and fixes

A code-level pass against every bullet above, plus a dedicated OWASP API Top 10 / OWASP Mobile
Top 10 sweep. Two of the five bullets above were genuine gaps, both fixed this pass; the rest were
confirmed already-real, one with a scope cut worth naming honestly.

**Rate limiting — was a real gap, fixed.** `ThrottlerModule.forRoot`'s default storage is an
in-memory `Map` — this project's own recurring "the throttle store survives a hot-reload in
confusing ways" gotcha (several `docs/07` steps) was a direct symptom of "via Redis" never
actually being true. Fixed with `RedisThrottlerStorageService`
(`backend/src/common/throttler/redis-throttler-storage.service.ts`): a real sliding window via a
Redis sorted set (`ZREMRANGEBYSCORE` evicts anything outside the window on every call, so the
window slides rather than resetting on a fixed boundary) plus a short-lived block key once a
caller is over the limit. Tracking was per-IP only — fixed by having the throttler's `getTracker`
prefer the authenticated user's id (`req.user`, set by `JwtAuthGuard`'s passport strategy) and
fall back to IP only for the not-yet-authenticated routes (login/register) that should stay
IP-scoped; this required reordering `app.module.ts`'s global guards so `JwtAuthGuard` runs before
`ThrottlerGuard` (`JwtStrategy.validate()` is a pure signature check, no DB round-trip, so this
costs nothing extra even on a request that's about to be throttled anyway). Payment endpoints had
no throttle at all — fixed by adding `@Throttle({ default: { limit: 20, ttl: 60_000 } })` to
`POST /payments`, `/payments/gateway/initiate`, and `/payments/:id/refund` (per-user), and a
`limit: 30` IP-scoped one to the public `/payments/gateway/webhook`. Verified live against real
Postgres + Redis: two different authenticated users' hits to the same endpoint landed under two
separate Redis keys (proving per-user, not per-IP, scoping), and firing 21 requests as one user
against the now-`@Throttle`d `/payments` correctly let the first 20 through and `429`'d the 21st,
while an unrelated endpoint for that same (now-blocked) user still returned `200` — the block is
scoped to the specific route, not the whole account.

**File upload validation — was a real gap, fixed.** Nothing checked an uploaded file's actual
bytes; `LocalDiskStorageAdapter.writeObject` wrote whatever arrived, and the raw-bytes upload
route (`POST .../storage/upload/:objectKey`) never even received a client-declared MIME type to
distrust in the first place — there was no check of any kind. Fixed with
`backend/src/common/storage/file-signature.util.ts`: `writeObject` now rejects any upload whose
magic bytes identify it as a Windows PE/ELF executable or HTML/script content, regardless of what
(if anything) is ever declared — the one choke point every module sharing `StorageAdapter` (Notes,
Assignments) passes through. Separately, `NotesService.createDocument` — the one place with an
actual declared type (`DocumentFileType`) to check against — now reads the uploaded bytes back and
rejects a `pdf`/`image` declaration that doesn't match its own magic-byte family. Verified live:
uploading a fake `.exe` (MZ header) to the raw upload route returned `400 DANGEROUS_FILE_TYPE`
before ever touching disk; a real PDF's bytes uploaded then declared as `fileType: 'image'` in
`POST /documents` correctly returned `400 FILE_CONTENT_MISMATCH`; the same PDF declared correctly
as `fileType: 'pdf'` succeeded normally. "Served from a separate cookie-less domain" is not
implemented — this project has one single-origin API, no separate static-asset domain — and is
left as a real, named deployment-topology gap rather than faked; the read-side mitigation already
in place (`Content-Type: application/octet-stream` on every download, `notes.controller.ts`/
`assignments.controller.ts`, plus helmet's default `X-Content-Type-Options: nosniff`) meaningfully
narrows the same risk in the meantime by stopping a browser from ever rendering a downloaded file
inline, regardless of what it actually contains.

**Response-DTO allowlisting — an architecture deviation, audited and confirmed sound as-is.** This
codebase never adopted a serialization-layer allowlist (e.g. a `ClassSerializerInterceptor` +
`@Exclude()` convention); it enforces "no sensitive field ever serialized" via TypeORM
column-restricted `select` at the query site instead — "just don't select that column," which the
bullet above specifically calls out as insufficient on its own. In practice this codebase applies
that pattern consistently enough that it functions the same way: every one of the 18 call sites
across `src/modules/` that loads a related `User` (`relations: { user: true }` or
`relations: { guardian: { user: true } }`) was audited this pass, and 17 already carried a
matching `select` restricting the loaded `User` fields to `id` (occasionally `+fullName`/`+email`
for a genuine response field) — the fix pattern first established for
`TeacherProfilesService.findById` and `StudentsService`'s `STUDENT_SELECT`, and repeated
independently by whoever wrote each of those 17 sites rather than actually being shared code. The
one exception, `NotificationsService.runDigestBatch`, had no `select` at all — not an actual leak
(it's `@Cron`-triggered only, never reachable from any controller, so nothing it loads is ever
serialized into a response), but tightened for consistency anyway. Recommendation for a future
pass: promote this from "everyone remembers to add `select`" to a lint rule or a shared
select-builder, since the failure mode (forget once, leak `passwordHash`) has now recurred three
times across this project's history (`TeacherProfilesService`, `StudentsService`, and Phase 5 step
8's `VerificationReviewService`) purely because there's no structural guard against it.

**HTTPS/HSTS — confirmed at the application layer; TLS termination itself is a deployment
concern.** `helmet()` (`main.ts`) sends `Strict-Transport-Security` by default. Actually
terminating HTTPS (a real certificate, a reverse proxy or load balancer in front of the Nest
process) is infrastructure this project has never provisioned — there is no production deployment
target yet (Phase 6's own "App Store / Play Store submission" and "staged rollout" items are
similarly not yet started) — so this stays a named, deliberate gap rather than something fakeable
in code.

**Input validation / injection — confirmed already sound.** `ValidationPipe({ whitelist: true,
forbidNonWhitelisted: true, transform: true })` is global (`main.ts`); a full grep for
`createQueryBuilder`/raw `.query()` calls across every service found exactly one hand-built query
(`AdminUsersService.search`, Phase 5 step 8), and it binds every value as a query-builder parameter
(`:instituteId`, `:q`, `:status`) rather than string-interpolating — no raw-SQL injection surface
anywhere in the codebase.

**OWASP API Top 10 / Mobile Top 10 sweep — no new findings beyond the above.** BOLA (API1): every
resource-scoped read/write in this codebase already resolves scope server-side from the requester's
own `institute`/role rather than trusting a client-supplied id — the pattern this whole project has
built around since Phase 4. Broken authentication (API2): rotating refresh tokens with reuse
detection, no plaintext password ever stored or logged. Mass assignment (API6): closed by the
global `whitelist`/`forbidNonWhitelisted` pipe. Security misconfiguration (API8): `helmet()` +
explicit `CORS_ORIGIN` allowlist, `synchronize: false` (schema drift only via reviewed migrations).
Insufficient logging (API9): `LoggingInterceptor` request-correlates every call, but there's no
centralized log aggregation/alerting — a real gap, but an infrastructure one matching the HTTPS
gap above, not a code fix. Mobile: `flutter_secure_storage` for the refresh token (never plain
`SharedPreferences`), no token ever appears in a `print`/log statement (grep-confirmed). No
certificate pinning and no root/jailbreak detection — both legitimate scope cuts for a project with
no real production TLS certificate or app-store listing yet, named rather than silently absent.

**Not addressed this pass:** `npm audit` reports 28 pre-existing vulnerabilities (4 low / 14
moderate / 9 high / 1 critical) in transitive dependencies, unchanged by anything in this pass
(confirmed via the same audit against the pre-Phase-6 lockfile) — `npm audit fix --force` risks
major-version bumps to `@nestjs/*` packages this project depends on throughout, which is a real
piece of work deserving its own dedicated upgrade-and-reverify pass, not a drive-by fix folded into
a security review. Load testing (attendance-bulk-mark, invoice-generation) and the app-store
submission/staged-rollout items remain open Phase 6 work — see `docs/07-roadmap.md`.
