# TeacherOS Backend

NestJS modular monolith — see [../docs/02-architecture.md](../docs/02-architecture.md) for the
full design rationale, [../docs/03-database-schema.md](../docs/03-database-schema.md) for the
schema, and [../docs/04-api-design.md](../docs/04-api-design.md) for the API contract.

## Implemented so far (docs/07 Phase 4 — complete, all 8 steps — plus Phase 5 steps 1–7)

- `modules/auth` — register, login, refresh (rotating), logout, logout-all, `/auth/me`. Also
  links a freshly-registered `parent` account to any existing `Guardian` row sharing their
  email/phone (docs/07 Phase 5 step 3) — never the reverse direction. Previously had zero unit
  test coverage of any kind (only the e2e suite touched it); `auth.service.spec.ts` is new
- `modules/users` — User/Role/Permission/UserRole entities, effective-permission resolution
- `modules/institutes` — institutes CRUD (soft-delete only; `create` super_admin-only,
  `update`/`archive` resource-scoped to the caller's own institute since Phase 5 step 4 — closing
  a gap this module's own comment used to flag as an unfixed follow-up), branches CRUD
  (`branches.deleted_at` added in step 4), `teacher_institute_invites` (generate/list/redeem — a
  short-lived code mirroring `student_invites`), and `institute_teacher_payouts` (read/manage
  side: set a teacher's `payout_percent`, list role-scoped, mark paid — *generation* happens
  inside `FeesService`, see below)
- `modules/teacher-profiles` — `teacher_categories` (seeded with the spec's starter list),
  `teacher_profiles` (create/read/update, owner-only writes), `verification_requests`
  (submit only — admin review UI is a later module)
- `modules/students` — student_profiles/guardians/student_guardian_links/
  student_teacher_assignments/student_merge_log/student_invites: manual add (with inline
  guardians), list/detail (role- and assignment-scoped), update, archive, add-guardian, merge
  (duplicate-record resolution with dedup on reassignment), invite-code generation. `findAll`
  (backing `GET /students`) gained a real `parent` branch in Phase 5 step 3 — previously a
  parent caller silently fell through to the teacher branch and got an empty list every time,
  with no way to discover their own linked children's ids at all. Phase 5 step 7 added
  `student_import_jobs` + `POST /students/import` (multipart CSV upload via
  `@nestjs/platform-express`'s `FileInterceptor`/Multer, already a transitive dependency) and
  `GET /students/import-jobs/:id` — docs/04 §4.7's async-job pattern (fire-and-forget in-process,
  same as Reports' `export_jobs`) applied to bulk onboarding, previously deliberately skipped
  pending a BullMQ queue that never actually arrived. Row-level validation reuses
  `CreateStudentDto`'s own class-validator decorators; one bad row never aborts the rest of the
  import. CSV parsing is hand-rolled (`utils/csv-parser.util.ts`, full RFC 4180 quote-escaping)
- `modules/classes` — classes/class_schedule_versions/schedule_exceptions/enrollments/
  waitlist_entries: create/list/update, RFC 5545 schedule versioning (`rrule` package),
  exceptions (holiday/cancel/reschedule/makeup/extra), enrollment with capacity + waitlist
  fallback, and a non-blocking conflict-check endpoint (teacher double-booking + same-institute
  location clashes over a 14-day window — student-schedule-overlap is a documented follow-up)
- `modules/attendance` — attendance_sessions/attendance_records/attendance_audit_log: roster
  GET + bulk-mark POST (docs/08 §8.3 Quick Attendance), single-record PATCH with an audit trail,
  and a student-attendance-history GET with a computed percentage. Upsert-by-(session,student)
  replaces the doc sketch's separate idempotency_key column — see attendance-record.entity.ts.
  Teacher-only by default; institute_admin needs `institutes.allow_admin_attendance_override`
  opted in (checked at runtime, not a blanket grant)
- `modules/fees` — fee_structures/discounts/invoices/invoice_line_items/credit_notes/payments/
  payment_audit_log/refunds/student_credit_ledger_entries (the last is an addition, see that
  entity file). Invoice generation applies attendance-based proration (`per_class_deduction`:
  fee ÷ held sessions × absences) and discounts, and consumes available student credit.
  Invoices are immutable — corrections only via `credit_notes`. Payments are idempotent via a
  client-generated key; a gateway payment only confirms via webhook, never the client response.
  `PaymentGatewayAdapter` is a real interface with `MockPaymentGatewayAdapter` as the only
  registered implementation (no real gateway account exists for this project) — its webhook
  HMAC-signature verification is real, tested logic, not a stub. Since Phase 5 step 4,
  `recordPayment`/`confirmGatewayWebhook` also call `generatePayoutIfApplicable` — for an
  institute-collected invoice whose teacher has a configured `payout_percent`, generates one
  `institute_teacher_payouts` row per CONFIRMED payment (not per invoice, so a partial payment
  still generates its proportional share), idempotent against a retried webhook via that table's
  `payment_id` unique constraint
- `modules/notes` — documents/document_shares/document_access_log: upload-url → confirm →
  share flow, versioning (self-referential `previousVersion`, owner-only), and download
  tracking. Three independent read-access paths (owner, same-institute admin, matching share)
  plus a stricter `allowDownload` gate in front of actual file bytes; shares resolve against
  student/class/institute targets by walking the same guardian-link/assignment/enrollment
  relations used elsewhere. Uses the shared `common/storage/` `StorageAdapter` (see below).
  `folder_name` is a plain string tag, not a full folders/hierarchy table — see docs/03 §3.8
- `modules/notifications` — notifications/notification_preferences/device_push_tokens (the
  last an addition beyond docs/03, see that doc). `notify()` always persists an in-app row
  regardless of channel; the channel is resolved per (user, category) from a stored preference
  or a category default (docs/01 §1.3's real-time-for-critical vs. digest-for-informational
  split). `PushNotificationAdapter` is a real interface with `MockPushNotificationAdapter` as
  the only registered implementation (no Firebase project exists for this project). Digest
  batching (`runDigestBatch`) is pure, tested logic triggered by an in-process `@Cron`
  (`@nestjs/schedule`) rather than a BullMQ repeatable job — no Redis is wired up anywhere in
  this codebase yet, and docs/02 §2.5 frames BullMQ as a scale concern, not an MVP one. Fees
  and Notes both call `notify()` as real integration points (payment confirmed/invoice issued,
  document shared to a student)
- `modules/assignments` — assignments/assignment_submissions: create (class- or single-student-
  targeted, exactly one), list/get (role- and enrollment-scoped), submit, list submissions
  (teacher sees all, student sees only their own), review (grade/feedback). Per docs/06 §6.2,
  only the owning teacher gets write access — institute_admin/super_admin are marked read-only
  in the matrix, unlike most resources here; `AssignmentsService` keeps super_admin's usual
  bypass anyway for codebase-wide consistency, documented as a deliberate choice in its header
  comment. Late/resubmission handling is real and tested: a late submission is rejected outright
  unless `allowLateSubmission`, a resubmission rejected unless `allowResubmission` (and becomes a
  new `attemptNumber` row, never an overwrite). Fires `notify()` on assignment creation and
  submission review (new `ASSIGNMENT` notification category, defaults to immediate push). Uses
  the shared `common/storage/` `StorageAdapter` for attachments
- `modules/performance` — performance_metric_definitions/performance_records (docs/01 §1.4's
  configurable metrics — the same two tables give an academic teacher "Test Score," a sports
  coach "40m Sprint Time," a music teacher "Scale Mastery," never hard-coded per category; three
  example category defaults are seeded in the migration). Exactly one of
  {teacherCategory, institute, teacherProfile} scopes a definition, matching docs/06 §6.2's three
  separate "define" grants (super_admin/institute_admin/teacher); only a teacher ever *records* a
  value (their own students only) — institute_admin/super_admin hold `define`+`read` but never
  `record`, the same R-not-F pattern Assignments already established. `value` is a validated
  plain string (numeric/percentage/scale_1_5/pass_fail/text per the metric's declared type),
  matching `assignment_submissions.grade`'s same reasoning
- `modules/announcements` — a new module (Phase 5 step 4): `announcements`, three independent
  "send" grants (teacher: a class they teach, institute_admin: their own institute, super_admin:
  platform-wide) but one shared "read" for every role, resolved by building a list of relevant
  targets for the requester (their institute, their classes, PLATFORM always) then fetching
  whatever matches — the same approach `NotesService` uses for its own access resolution.
  `createdBy` (a plain User) replaces docs/03's sketched `teacher_profile_id` (an
  institute_admin/super_admin sender has none), and a `PLATFORM` target type replaces the
  sketched `individual` (docs/06 §6.2 names super_admin's grant as literally "platform-wide" with
  nowhere for that to point). Deliberately does not call `NotificationsService.notify()`
  per-recipient on creation — a real fan-out belongs on an async job, not a synchronous loop in
  the request path for what can be a large audience
- `modules/reports` — a new module (Phase 5 step 5): three synchronous reports (`GET
  /reports/attendance`, `/reports/fees`, `/reports/students/:id`, CSV/PDF for the first two, PDF
  only for the third) plus an `export_jobs` async pair (`POST /export-jobs` → `GET
  /export-jobs/:id` → `.../file`) for the two report types large enough to warrant one. One
  `report.generate` permission covers everything here (docs/06 §6.2 has no separate verbs, just
  F/–) — scope (own classes/students, own institute, or any institute/platform-wide) is resolved
  server-side, never client-supplied except super_admin's optional `instituteId`. PDF rendering
  is real (`pdfkit`, this project's first new backend dependency since the initial scaffold — a
  hand-rolled table layout rather than pdfkit's own table helper, since this environment can't
  visually verify a PDF render); CSV stays hand-rolled (`utils/csv.util.ts`), matching the
  existing "dependency-light for genuinely simple serialization" preference. Every entity this
  reads (Attendance, Fees, Performance) is injected directly rather than importing those
  modules' services, re-deriving `FeesService.getFinancials`'s net/paid-total logic locally —
  this codebase's established convention. The async job path has no BullMQ/Redis behind it (same
  gap as Notifications' digest batching) — the job row is created and returned immediately, and
  the real work runs via a fire-and-forget call in this same process right after
- `modules/calendar` — a new module (Phase 5 step 6): one `GET /calendar` aggregating
  `class_occurrence`/`assignment_due`/`fee_due` events live from Classes/Assignments/Fees rather
  than a persisted `calendar_events` table (docs/03 §3.8's own note explains why — the same
  "no cross-module write-side sync hooks" reasoning behind every other computed view in this
  codebase). Scope resolution matches Reports' pattern exactly: omitted, `ownerType`/`ownerId`
  default to "my own calendar" per role; an explicit `ownerType=class` or the new
  `ownerType=institute` (an addition beyond docs/03's sketched enum, closing the same class of
  gap `PLATFORM` closed for Announcements) covers the two other real, bounded lookups this pass
  supports. Conflict detection reuses `ClassesService.getConflicts`'s own two rules (teacher
  double-booking, same-institute-location clash) and its `materializeOccurrences` RRULE utility
  directly (a pure function import, not a service call) — computed as a pairwise overlap check
  over events already fetched to build the calendar, cheaper than the per-class endpoint's own
  fresh queries. One `calendar.read` permission for every role (docs/06 §6.2 has no separate
  verbs here either)
- `common/` — global JWT guard (protected-by-default, opt out with `@Public()`), permissions
  guard (`@RequirePermission`), standard error envelope, request-correlated logging, and
  `storage/` — `StorageAdapter`/`LocalDiskStorageAdapter` (no S3/GCS account exists for this
  project), shared by Notes and Assignments via one `StorageModule` so both write into the same
  `uploads/` object-key namespace through one adapter instance. Object keys are always
  server-generated (`randomUUID()`), never derived from client input, so it's path-traversal-safe
  by construction; each module keeps its own upload-bytes controller route and `main.ts`
  raw-body registration under its own resource path
- Fourteen migrations: initial schema (users/roles/institutes), teacher-profiles (seeded
  categories), students (guardians/student tables + `student.manage`/`student.read` grants),
  classes (schedule/enrollment tables + `class.manage`/`class.read` grants), attendance
  (`attendance.mark`/`attendance.read` grants), fees (`fee.manage`/`fee.read` grants), notes
  (`note.manage`/`note.read` grants), notifications (no new grants — every route operates on the
  caller's own data, same as `/auth/me`), assignments (`assignment.manage`/`assignment.read`/
  `assignment.submit` grants, matching docs/06 §6.2 literally), performance
  (`performance.define`/`performance.record`/`performance.read` grants, also matching docs/06
  §6.2 literally, seeding three example category-default metrics), and institute-admin
  (`branches.deleted_at`, `teacher_profiles.payout_percent`, `teacher_institute_invites`,
  `announcements`, `institute_teacher_payouts` tables, plus `branch.manage`/
  `teacher_invite.manage`/`teacher_invite.redeem`/`announcement.manage`/`announcement.read`/
  `payout.manage`/`payout.read` grants), reports (`export_jobs` table, `report.generate` grant),
  calendar (no new tables — see calendar.service.ts's header comment — just a `calendar.read`
  grant), and student-import (`student_import_jobs` table, no new grant — gated by the existing
  `student.manage`) — see docs/06 §6.2. All fourteen have now run end-to-end against a real
  Postgres instance (see "Local setup" below).

Two response-shape/leak issues were caught and fixed during this build, both worth knowing about
if you extend these modules: (1) never load a related `User` without a column-restricted
`select` if the entity can be returned to a client — `TeacherProfilesService.findById` and
`StudentsService`'s `STUDENT_SELECT` are the reference pattern; (2) keep a resource's response
shape identical across every endpoint that can return it — `StudentsService.toGuardianSummary()`
is shared by `getStudentDetail` and `addGuardian` for exactly this reason, and
`ClassesService.toEnrollmentSummary()` follows the same pattern for `getEnrollments`/
`enrollStudent`.

Financial endpoints need the raw request body for webhook signature verification (docs/04 §4.4
gateway webhook) — `main.ts` passes `{ rawBody: true }` to `NestFactory.create` so
`req.rawBody` is available alongside the normally-parsed `req.body`; no other route is affected.

Two real bugs were caught the first time this project's `test:e2e` actually ran against live
Postgres (Phase 5 step 2 — Docker had been unavailable in this dev environment for every step
before that): (1) `AssignmentSubmission.grade`'s `@Column({ nullable: true })` had no explicit
`type:` for its `string | null` field — TypeORM's reflection-based inference reports `Object`
for that union, not `String`, so `migration:run` failed outright against a live database (every
other nullable-string column in this codebase already declares its type explicitly; this one
didn't — fixed by adding `type: 'varchar'`). (2) Refresh-token rotation had no unique `jti` claim
in its JWT payload, so two tokens issued for the same user/device within the same wall-clock
second could sign to the byte-identical string, letting a rotated-out token collide with its own
replacement and pass reuse detection — fixed by adding a random `jti` to the refresh token's
payload (not the access token's — it's validated by signature alone, never looked up by hash).
Both are worth remembering if you add another nullable-string column or touch token issuance.

Two more real bugs surfaced in Phase 5 step 3, this time from manually exercising the live API
end-to-end (register → onboard → add student → add guardian → register a parent → check they can
see the child) rather than from `test:e2e` itself: (3) both `AssignmentsService.createAssignment`
and `PerformanceService.recordPerformance` loaded a `Class` via `classRepo.findOne({ where: { id
} })` with no `relations` option, then immediately read `cls.teacherProfile.id` —
`Class.teacherProfile` isn't an eager relation, so both crashed with a 500 the moment a real
class-targeted request came in. Every other module's equivalent helper (Attendance, Classes,
Fees, Notes) already requested `relations: { teacherProfile: true, ... }` correctly; only these
two newer call sites missed it — invisible to their own unit tests, since a mocked repository
returns whatever a test tells it to regardless of what `relations` a real query asked for (both
specs now assert the actual `find()` options as a guard against this regressing silently again).
(4) The more significant one: nothing in this codebase ever actually linked a `Guardian.user`
column to a real account — see the Students/Auth entries above. Together, these four are the
concrete case for treating a live Postgres + a manual end-to-end pass as a real verification
step whenever Docker is available, not just `npm test` — see docs/07-roadmap.md's Phase 5 step 2
and step 3 entries for the full narrative.

Phase 5 step 4 added three more, two caught proactively (before ever running the code, by
deliberately re-checking every new `find`/`findOne` against the pattern above) and one live: (5)
`PayoutsService.listPayouts()`'s three role branches, and `FeesService.confirmGatewayWebhook`'s
payment lookup, were both missing relations their own `toSummary()`/follow-on logic needed —
fixed before the first test run. (6) The actual root cause behind all of #3/#5:
`TeacherProfilesService.findByUserId()` — shared by roughly 15 call sites across
Classes/Students/Assignments/Fees/Notes/Performance/Payouts/Announcements — never requested the
`institute` relation at all, so every caller reading `teacherProfile.institute` silently got
`undefined`. Concretely, every class ever created by an institute-affiliated teacher was silently
getting `institute: null` (`ClassesService.create`), which would have made this very step's
revenue-split payout feature never fire for a real institute-collected class — caught live while
manually verifying that exact flow. Fixed at the source rather than patched at each site. (7) A
pre-existing bug, live since Phase 4 step 6: `FeesService.recordPayment` never carried
`dto.idempotencyKey` onto the created `Payment` entity, and that column is `NOT NULL UNIQUE` —
every manual cash/UPI/bank-transfer payment has always failed against a real database. No unit
test could catch it (a mocked repo accepts an incomplete object); only a real insert against a
real column constraint could. See docs/07-roadmap.md's Phase 5 step 4 entry for the full
narrative and the live end-to-end payout verification this all came from.

Phase 5 step 5 (Reports) added two more of a related but distinct kind — structural bugs
invisible to `tsc`/`nest build`/type-checking generally, since neither ever executes the code
under test: (8) `import PDFDocument from 'pdfkit'` type-checks fine (`tsconfig.json` sets
`allowSyntheticDefaultImports`) but throws `TypeError: ... is not a constructor` at runtime — that
flag only relaxes the type checker; it doesn't add the `esModuleInterop` helper a default import
of a CJS `module.exports = PDFDocument`-style package actually needs. Caught by this module's own
new unit tests the moment they exercised the code path, before it ever reached a live PDF
request; fixed with the interop-safe `import PDFDocument = require('pdfkit')` form. (9)
`ExportJob.objectKey?: string | null` had no explicit `type:` — the exact bug class
`AssignmentSubmission.grade` hit in step 2 (TypeORM's reflection-based inference reports `Object`
for a nullable-string union, which Postgres rejects at `migration:run`). Caught live running this
step's own migration; fixed with `type: 'varchar'`.

Phase 5 step 7 (CSV import) added one more, this time a logic bug rather than a structural one:
(10) `class-validator`'s `ValidationError` is a tree, not a flat list — a failure inside a
`@ValidateNested` property (a CSV row's optional guardian, itself validated as
`GuardianInputDto`) lands in that error's `children`, not its own `constraints`. Reading only the
top-level `constraints` silently dropped every nested-object validation message down to a
generic "Invalid row" — a bad `guardianEmail` never said why it failed. Caught live testing the
actual import flow (a unit test with a real `class-validator` `validate()` call would have caught
it too, but this one was found via a live multipart upload before the corresponding test was
strengthened); fixed with a small recursive `flattenValidationMessages` helper.

Every other module under `src/modules/` is a stub `README.md` pointing at the roadmap step and
doc sections that define it — see [docs/07-roadmap.md](../docs/07-roadmap.md).

## Local setup

```bash
# 1. Start Postgres + Redis
docker compose -f ../infra/docker-compose.yml up -d

# 2. Install deps
npm install

# 3. Configure env
cp .env.example .env   # defaults already match the docker-compose service (Postgres on host port 5433, not 5432 — see infra/docker-compose.yml's comment: a locally-installed native Postgres service is a common 5432 collision)

# 4. Run all migrations
npm run migration:run

# 5. Start the API (watch mode)
npm run start:dev
```

API is served at `http://localhost:3000/api/v1`.

## Testing

```bash
npm test            # unit tests
npm run test:e2e    # integration tests against real Postgres — see test/auth.e2e-spec.ts; run "Local setup" steps 1/3/4 first
```

## Adding a migration

Never hand-edit a table with `synchronize: true` — it's deliberately off (`app.module.ts`).
Generate a migration from entity changes, review the SQL it produces, then run it:

```bash
npm run migration:generate -- src/database/migrations/DescriptiveName
npm run migration:run
```
