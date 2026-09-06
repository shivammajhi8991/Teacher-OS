# 7. Roadmap

## Phase 1–2 — Product Analysis & Architecture ✅ (this document set)

Deliverables: `docs/01`–`docs/06`. Gate before Phase 3/4: user review and sign-off on schema (docs/03) and RBAC matrix (docs/06), since both are expensive to change once code and real data exist on top of them.

## Phase 3 — UI/UX flows ✅ (docs/08-ux-flows.md)

- Full screen inventory per role (Teacher/Student/Parent/Admin/Super Admin), keyed to the navigation shells in docs/05 §5.3.
- Tap-by-tap flows for the two named critical paths — Quick Attendance (2 taps for the common case), Fee Collection (3 taps) — validating the ≤3-tap constraint (docs/01 §1.6) concretely rather than as an aspiration.
- Secondary critical flows (onboarding, student invite, conflict-aware class creation, assignment lifecycle, notification deep-linking, offline sync indicator states).
- Empty/loading/error/confirmation state inventory, applied as one consistent pattern set (spec §22–23) rather than improvised per screen.

Gate before Phase 4: confirm the screen inventory and the two critical-flow tap counts match expectations — this is the last docs-only checkpoint before code.

## Phase 4 — MVP build (in progress)

Build order, each step shippable and testable before the next starts:

1. **Auth ✅ implemented** — register/login/refresh (rotating)/logout/logout-all/`auth/me`, in
   both `backend/src/modules/auth` and `mobile/lib/features/auth`, end to end. OTP/social login
   deferred (docs/02 §2.4 — architecturally ready, not built). Verified: backend `npm install` /
   `tsc --noEmit` / `eslint` / `nest build` / `npm test` all green; `auth.e2e-spec.ts` finally ran
   for real against live Postgres during the Phase 5 step 2 pass (Docker was unavailable in this
   environment for every step before that) and caught a genuine bug in refresh-token rotation —
   see that step's entry below for the fix. Mobile hand-verified for import/path correctness but
   not yet run through `flutter analyze` / `flutter test` (no Flutter SDK in that environment) —
   run both before building on top of it.
   `users` and `institutes` also implemented as supporting modules (needed for auth's role/tenant
   model), each with a first migration seeding roles + a starter permission set (docs/06 §6.2,
   grows as later steps add their own permission keys).

2. **Teacher onboarding & profile ✅ implemented** — `backend/src/modules/teacher-profiles`
   (`teacher_categories` seeded with the spec's starter list, `teacher_profiles`,
   `verification_requests`) and `mobile/lib/features/onboarding` (category grid → Basics →
   Teaching details → Fees & availability, per docs/08 §8.5). Fee defaults are deliberately left
   off the create/update DTO until the fees module (step 6) defines `fee_structures`; the
   onboarding UI's last step says so rather than pretending to collect data nothing stores yet.
   Verification-*document upload* UI is deferred (needs the presigned-URL flow from docs/02 §2.6,
   which ships with Notes) — the submit-request *endpoint* exists now
   (`POST /teacher-profiles/:id/verification-request`). A fresh teacher registration routes to
   `/onboarding` explicitly (not the default post-login redirect) since a brand-new account has no
   profile yet; a returning teacher's redirect-to-profile-if-incomplete gating is a noted follow-up
   once `/auth/me` or a dedicated check exposes profile-completion state.

3. **Student management ✅ implemented** — `backend/src/modules/students` (student_profiles,
   guardians, student_guardian_links, student_teacher_assignments, student_merge_log, and an
   addition beyond docs/03 — student_invites, code-generation only) and
   `mobile/lib/features/students` (list with status/search filters, add with inline guardian,
   detail with edit/archive/add-guardian, an invite-code dialog), wired into the Teacher
   dashboard's Students tab. Manual add ✅, guardian linking ✅ (multiple guardians, one guardian
   → many children, docs/01 §1.3), archive (never hard-delete) ✅, merge for duplicate records ✅
   with dedup-on-conflict for reassigned teacher/guardian links. Invite ⚠ code generation only —
   redemption (student registers via the code, lands in a teacher-confirm queue per docs/08 §8.5)
   depends on `enrollments`, which belongs to Classes (step 4), so it's a documented follow-up,
   not built now. CSV import ⚠ deliberately skipped — the async-job pattern it needs (docs/04
   §4.7) depends on the BullMQ queue that arrives with Notifications (step 8); scoped out rather
   than half-built without it. A real response-shape/leak review happened during this pass: fixed
   `addGuardian`'s response to match `getStudentDetail`'s guardian shape (was returning the raw
   join entity) and `createInvite`'s to drop an unnecessarily embedded full TeacherProfile.
   Verified locally: backend `npm install` / `tsc` / `eslint` / `nest build` / `npm test` all
   green (17 tests). Mobile hand-verified for import/path and API correctness only — still no
   Flutter SDK in this environment.
4. **Classes/batches ✅ implemented** — `backend/src/modules/classes` (classes,
   class_schedule_versions, schedule_exceptions, enrollments, waitlist_entries) and
   `mobile/lib/features/classes` (list/create/edit, schedule builder, live conflict check,
   roster + enroll/waitlist-fallback). RFC 5545 recurrence via the `rrule` npm package —
   `utils/schedule-occurrences.util.ts` materializes a schedule version's occurrences for
   conflict detection, and is unit-tested directly (the highest-value test in this module,
   since it's pure logic with no DB dependency). Conflict detection covers teacher
   double-booking and same-institute location clashes over a 14-day window, non-blocking per
   docs/01 §1.5; **student-schedule-overlap conflict detection is a documented follow-up**
   (needs cross-referencing every enrolled student's other active enrollments — flagged with a
   TODO in `ClassesService.getConflicts`, not silently skipped). Capacity enforcement on
   enrollment suggests the waitlist endpoint by name (`CLASS_AT_CAPACITY`) rather than just
   failing. Two endpoints were added beyond docs/04 §4.4's original list —
   `GET /classes/:id/enrollments` and `GET /classes/:id/schedule` — because a class detail view
   needs to show its roster and current schedule, which the original endpoint list had no way
   to read back. **Deferred, documented**: mobile UI for schedule *exceptions*
   (holiday/cancel/reschedule/makeup/extra — the backend endpoint exists and is tested) and for
   *waitlist management* beyond the single "class is full → add to waitlist?" prompt; multi-
   timezone-precise conflict comparison (today treats both classes' times as the same wall-clock
   zone, correct for the overwhelmingly common one-teacher-one-timezone case).
   Verified locally: backend `npm install` / `tsc` / `eslint` / `nest build` / `npm test` all
   green (29 tests, 5 new for the occurrence-materialization util + 6 for the service). Mobile
   hand-verified for import/path and API-shape correctness only — still no Flutter SDK in this
   environment.
5. **Attendance ✅ implemented** — `backend/src/modules/attendance` (attendance_sessions,
   attendance_records, attendance_audit_log) and `mobile/lib/features/attendance` (the Quick
   Attendance screen, docs/08 §8.3's flagship flow). One real schema improvement over the docs/03
   §3.6 sketch: dropped the separate `idempotency_key` column in favor of a
   UNIQUE(session, student) constraint + upsert semantics — one mechanism now covers both "safe
   retry of the same bulk-mark call" and "edit with audit trail," instead of two overlapping ones
   (see attendance-record.entity.ts for the full reasoning). That upsert design is also what makes
   a queued offline bulk-mark call safely replayable with no separate Idempotency-Key header.
   Access is teacher-only by default; an institute_admin can mark only if their institute has
   opted into `allowAdminAttendanceOverride` (docs/06 §6.3), checked at runtime rather than a
   blanket permission grant. Handles the named edge cases directly: a cancelled/holiday occurrence
   rejects bulk-marking with a clear error (checked against `schedule_exceptions`); a student not
   actively enrolled as of that date is skipped, not fatal to the whole batch; an already-invoiced
   record refuses a plain edit (the Fees module will add a real adjustment path). **Deferred,
   documented**: QR/location-based check-in (spec §5 "Advanced features," not core to the Quick
   Attendance flow) and a mobile history/percentage-view screen (the backend endpoint
   `GET /students/:id/attendance` exists and is usable, just no screen consumes it yet).

   This step also stood up the offline-sync engine `mobile/lib/core/sync/` docs/05 §5.4
   originally scoped around Drift — **that part changed**: Drift needs `build_runner` codegen
   this environment can't run (no Flutter SDK), so the queue and the read-through cache are
   plain JSON files behind the same read/write shape instead. `SyncEngine` is feature-agnostic
   (a registered-replayer map, not a hardcoded attendance import) so swapping the storage layer
   for Drift later, or adding a second offline-capable feature, doesn't touch its public API.
   Verified locally: backend `npm install` / `tsc` / `eslint` / `nest build` / `npm test` all
   green (36 tests, 7 new). Mobile hand-verified for import/path and API-shape correctness only
   — still no Flutter SDK in this environment.
6. **Fees ✅ implemented** — `backend/src/modules/fees` (fee_structures, discounts, invoices,
   invoice_line_items, credit_notes, payments, payment_audit_log, refunds, plus
   student_credit_ledger_entries — an addition beyond docs/03, see that entity file for why an
   append-only ledger replaces a mutable balance column) and, on mobile, a **Fees section added
   to the existing Student Detail screen** (docs/08 §8.4's actual described flow: "Teacher opens
   student → sees pending amount → records payment → receipt") rather than a separate screen.
   Invoices are immutable once issued — corrections only ever go through `credit_notes`, never an
   in-place edit. Attendance-based proration (`per_class_deduction`) is real, tested math: fee ÷
   held sessions in the period × absences deducted, directly delivering docs/01 §1.5's
   "attendance vs. fee coupling is a policy" requirement. Overpayment resolves to a credit-ledger
   entry, auto-applied against the student's next generated invoice. Duplicate payment submission
   is idempotent via a client-generated `idempotencyKey` column (payments aren't naturally
   upsertable the way attendance is, so this stays a dedicated mechanism rather than folding into
   attendance's approach — see payment.entity.ts). A gateway payment only ever moves to
   `confirmed` via the webhook, never the client's initiate/return response, per docs/01 §1.5.

   **Payment gateway — real architecture, no real gateway.** No Razorpay/Stripe account exists
   for this project, so `PaymentGatewayAdapter` is a real interface (`initiate`,
   `verifyAndParseWebhook`) with `MockPaymentGatewayAdapter` as the only registered
   implementation — swapping to a real one later is a one-line DI change in `fees.module.ts`. What
   the mock fakes: calling out to a real hosted checkout page. What's real and tested: HMAC-SHA256
   webhook-signature verification against a shared secret, the same mechanism a real gateway
   actually uses (`mock-payment-gateway.adapter.spec.ts` signs its own payloads and confirms
   tampered/wrongly-signed/missing-signature ones are all rejected) — so `FeesService`'s webhook
   reconciliation logic is exercised end-to-end, not just structurally present.

   **Deferred, documented**: fee-structure/discount/invoice-generation management UI, gateway
   payment UI, refund UI, and the institute revenue-summary UI (all four backend endpoints exist
   and are usable — `fee-structures`, `discounts`, `invoices/generate`,
   `institutes/:id/revenue-summary` — no mobile screens consume them yet); partial refunds (only
   full-amount is supported, docs/03 §3.7 doesn't specify partial handling and refund.entity.ts
   explains the scope cut); `institute_teacher_payouts` (docs/01 §1.3's institute-collected-fees
   revenue split — needs a payout-percent config that doesn't exist on any entity yet); scheduled/
   automatic overdue-status transitions (no cron — an invoice's effective status is instead
   recomputed opportunistically whenever it's read or a payment/credit-note touches it, which is
   accurate but means a truly untouched overdue invoice won't flip status until something reads
   it — acceptable for this pass, a documented gap for a true background job later).
   Verified locally: backend `npm install` / `tsc` / `eslint` / `nest build` / `npm test` all
   green (47 tests, 11 new — 6 for FeesService's edge cases incl. the proration math, 5 for the
   webhook signature verification). Mobile hand-verified for import/path and API-shape
   correctness only — still no Flutter SDK in this environment.
7. **Notes ✅ implemented** — `backend/src/modules/notes` (documents, document_shares,
   document_access_log) and, on mobile, a **Notes section added to the existing Class Detail
   screen** rather than a new tab. `folderName` is a plain string tag (docs/03 §3.8 sketched a
   full `folder_id` hierarchy; a light organizational string is the honest amount of structure
   for spec §7's "categories/folders" ask — promoting it to a real Folder entity is additive
   later). Versioning is a self-referential `previousVersion` link with an ownership check (you
   can only version your own document); every download is logged to `document_access_log`
   (every access currently logs as `download` — no separate "view" endpoint exists yet, a
   documented simplification). Access resolution has three independent paths — resource owner,
   institute-admin same-institute scope, and a matching `document_shares` row — and shares
   themselves resolve against one of three target kinds (student/class/institute), each walking
   the same guardian-link/teacher-assignment/enrollment relations already used elsewhere in this
   codebase for "does this person have a legitimate reason to see this resource" checks.
   `allowDownload` on a share is a separate, stricter gate than plain read access: a share can
   let someone see a document exists (`GET /documents`, `GET /documents/:id`) without letting
   them pull the bytes (`GET /documents/:id/file`) — exercised directly in
   `notes.service.spec.ts`. An expired document (past `expiryDate`) is rejected with 410 Gone at
   the file-content step, never at listing.

   **File storage — real interface, no real cloud account.** No S3/GCS account exists for this
   project, so `StorageAdapter` (`createPresignedUpload`, `objectExists`, `readObject`,
   `writeObject`, `deleteObject`) is a real interface with `LocalDiskStorageAdapter` as the only
   registered implementation — swapping to a real one later is a one-line DI change in
   `notes.module.ts`. Object keys are always server-generated (`randomUUID()`), never derived
   from client input, so the local adapter is path-traversal-safe by construction. One real
   behavioral difference from a genuine cloud presigned URL, documented in the adapter: this
   local stand-in's "upload URL" points back at this same API and still requires the caller's
   normal JWT, where a real S3 presigned PUT would accept an anonymous request — and it doesn't
   check that the uploader is the same person who requested that specific `objectKey`, a gap
   worth closing before this local-disk path is used past single-node dev/local deployment.
   `externalUrl` on `DocumentSummary` is populated only for `fileType: 'link'` documents — an
   addition beyond the original response shape, so a client can read a shared link straight off
   the list/get response instead of following `GET /documents/:id/file`'s redirect just to
   recover a URL.

   **Deferred, documented**: real file upload/download UI on mobile — `file_picker` and a way to
   open/preview a downloaded file both need new pubspec dependencies not yet pulled into this
   pass, so the mobile Notes feature is scoped to **link-type notes only**: "Add link" on Class
   Detail creates a `link` document tagged with `folderName = classId` and shares it with the
   class in one dialog (title + URL, ≤3 taps per spec §11), and the section lists it back by
   filtering `GET /documents` client-side on that same tag (a client-side convention for *listing
   the teacher's own view*, not a security boundary — the actual grant is still the
   `document_shares` row created alongside it). A link's URL is copy-to-clipboard, not
   tap-to-open (no `url_launcher` dependency yet). Folder/version management UI, and a
   student/parent-facing Notes list, are likewise not built yet — the backend supports all of it.
   Verified locally: backend `npm install` / `tsc` / `eslint` / `nest build` / `npm test` all
   green (65 tests, 18 new — access resolution for all three share-target kinds, the
   allowDownload gate, expiry rejection, and version-ownership). Mobile hand-verified for
   import/path and API-shape correctness only — still no Flutter SDK in this environment.
8. **Notifications ✅ implemented** — `backend/src/modules/notifications` (notifications,
   notification_preferences, device_push_tokens — the last an addition beyond docs/03's sketch,
   see that doc's note) and, on mobile, a **Notification Center + Preferences screen**, reached
   from the app bar bell icon every dashboard already had a stubbed-out `onPressed: () {}` for,
   plus the Dashboard tab's "Recent activity" card (docs/08 §8.7's layout diagram literally
   names this: "last 5, 'see all' → notif center") — both previously static placeholders, now
   wired to real data.

   `notify()` always persists an in-app row regardless of channel, so the notification center
   never depends on push having succeeded. The channel a notification actually uses is resolved
   per (user, category): the user's own stored preference if they've set one, else a category
   default — docs/01 §1.3's own example split, `payment` → immediate push (critical), `fee`/
   `note` → daily digest (informational). Two other modules were wired to call `notify()` as
   real integration points, not just plumbing nobody exercises: Fees (`payment_confirmed` on
   both the manual-payment and gateway-webhook-confirmed paths, `invoice_issued` on generation)
   and Notes (`document_shared`, STUDENT-target shares only — CLASS/INSTITUTE shares can fan out
   to many recipients, which belongs on an async worker per docs/04 §4.7's "bulk notification
   fan-out," not a synchronous loop in the request path, so that's a documented deferral, not a
   silent gap). Both notify a student's own login (if they have one — docs/03 §3.4, a minor may
   not) and every linked guardian's login that has one, resolved by a small helper duplicated in
   each calling module (`getNotifiableUserIds`/`notifyStudentParty` in FeesService,
   `notifyStudentOfShare` in NotesService) rather than shared — the same "each module owns its
   own access/notify resolution" convention already used for read-access checks.

   A device token is unique across the whole table, not scoped per user: re-registering one
   already on file under a different user reassigns ownership rather than erroring, matching how
   a real FCM token behaves (shared device, or a factory-reset-then-re-login under a new
   account) — and an adapter reporting a token as invalid (uninstalled app, rotated token) prunes
   it, a real edge case this codebase actually handles and tests, not a hypothetical one.

   **Push delivery — real interface, no real Firebase project.** `PushNotificationAdapter`
   (`send`) is a real interface with `MockPushNotificationAdapter` as the only registered
   implementation — no Firebase project exists for this codebase (no google-services.json / APNs
   keys), so it logs the send and reports every token delivered, none invalid; swapping in a
   real Admin-SDK-backed adapter later is a one-line DI change in `notifications.module.ts`.

   **Digest batching — in-process cron, not BullMQ.** `NotificationsService.runDigestBatch()` is
   pure, directly-unit-tested logic (group every still-pending row for a channel by user, send
   one push per user, mark what was actually delivered); `NotificationsScheduler`'s `@Cron`
   (`@nestjs/schedule`, a new dependency added this pass) is what actually triggers it daily/
   weekly. This is a deliberate scope choice, not a shortcut nobody noticed: no Redis is wired up
   anywhere in this codebase yet (`redisUrl` has been a config placeholder since Phase 1, nothing
   has ever actually connected to it), and docs/02 §2.5 itself frames BullMQ as a *scale* concern
   ("move the heaviest module into its own deployable") rather than something MVP correctness
   needs — moving the trigger to a BullMQ repeatable job later doesn't change `runDigestBatch()`
   at all.

   **Deferred, documented**: real FCM device-token registration on mobile — it needs
   `firebase_messaging`/`firebase_core` plus actual platform config (google-services.json, APNs
   keys) that can't be added or verified in this environment, so `POST /device-tokens` exists and
   is usable but nothing on mobile calls it yet; a real mail adapter for the `'email'` channel
   (accepted by the DTO/entity per docs/03, but behaves like `'off'` today — no SMTP/SendGrid
   account exists, same treatment as every other "no real account" integration in this project);
   `announcements` (explicitly a Phase 5 Institute/admin-module item per this roadmap, not part
   of this step); wiring `notify()` into Attendance/Classes (e.g. a cancelled session, a schedule
   change) — real, natural call sites, intentionally left for whenever those modules' own next
   pass touches them, rather than bolting them on here as scope creep.
   Verified locally: backend `npm install` / `tsc` / `eslint` / `nest build` / `npm test` all
   green (80 tests, 15 new for NotificationsService — channel resolution, invalid-token pruning,
   device reassignment, mark-read semantics, digest grouping — plus updated DI wiring in
   `fees.service.spec.ts`/`notes.service.spec.ts` for the new dependency). Mobile hand-verified
   for import/path and API-shape correctness only — still no Flutter SDK in this environment.

Phase 4 (MVP build) is now complete.

Each MVP step ships with: backend module + migration, Flutter feature (data/domain/presentation), unit + widget tests, and — for steps 3, 5, 6 — the integration test named in docs/05 §5.7.

## Phase 5 — Advanced features (in progress)

1. **Assignments & homework ✅ implemented** — `backend/src/modules/assignments` (assignments,
   assignment_submissions) and, on mobile, an **Assignments section on the existing Class Detail
   screen** (teacher: create + review, matching the Fees/Notes precedent of a section on an
   existing screen rather than a new tab) plus a **real Student Assignments tab** (the Student
   dashboard already had this tab stubbed with no builder — now wired to
   `StudentAssignmentsScreen`).

   Per docs/06 §6.2's matrix, only the owning teacher gets write access here —
   institute_admin/super_admin are marked **R**, not F, unlike most other resources in this
   codebase (where super_admin is an unconditional escape hatch everywhere else already built).
   `AssignmentsService` keeps that escape hatch anyway, for consistency with every prior module
   rather than a one-off exception — documented as a deliberate choice in the service's header
   comment, not an oversight of the matrix. Parent gets no assignment access at all: docs/08 §8.2
   Parent screen inventory has no Assignments tab in the first place (Dashboard/Fees/
   Announcements/Profile only), so the matrix's "–" for Parent matches the designed navigation,
   not a gap.

   Real, tested edge-case handling per docs/08 §8.5: a late submission is rejected outright when
   `allowLateSubmission` is false, accepted-and-flagged when true; a resubmission is rejected
   when `allowResubmission` is false, otherwise becomes a new attempt row (`attemptNumber`
   incremented, the prior attempt never overwritten — same audit-everywhere convention as the fee
   credit ledger). A submission requires the caller to actually be a legitimate target: assigned
   directly, or actively enrolled in the assignment's class as of now.

   **File storage promoted to `common/storage/`** (moved from `modules/notes/storage/`, no
   behavior change to Notes) — Assignments needed the exact same upload/read/write/delete
   capability Notes already built, and duplicating that interface+class across two modules would
   have been the kind of obvious, avoidable duplication this codebase otherwise avoids.
   `createPresignedUpload` gained one parameter (the calling module's own resource path prefix,
   e.g. `'documents'` vs `'assignments'`) so each module keeps its own upload-bytes controller
   route under its own resource path while sharing one `LocalDiskStorageAdapter` instance (one
   `uploads/` directory, one object-key namespace) — `StorageModule` is a small new module
   providing `STORAGE_ADAPTER`, imported by both `NotesModule` and `AssignmentsModule`.
   `attachmentUrls` (on both assignments and submissions) holds a mix of this app's own storage
   object keys and external URLs with no per-entry type discriminator (unlike `Document`, which
   has one `fileType` per row) — each entry is validated by trying the storage adapter first,
   then falling back to "is this a valid http(s) URL."

   New notification integration: `assignment_created` (fan-out to every actively-enrolled
   student of a class target, or the one direct-student target) and `submission_reviewed`,
   added as a new `ASSIGNMENT` category in `notifications.constants.ts` — defaults to an
   immediate push rather than a digest, since both events are genuinely time-sensitive (a
   deadline, graded feedback) unlike a passive fee/document.

   **Deferred, documented**: mobile scope is intentionally narrow, for the same "no new
   unverifiable pubspec dependency" reason as Notes' link-only scope — assignment creation has no
   attachment picker (the backend's real upload flow exists and is usable, just not wired to a
   file/image picker), individual-student targeting has no mobile UI (class-targeting only), and
   a submission is one external link rather than an uploaded file. `assignments_repository.dart`
   and the create/submit screens each document this at their own header comment.
   Verified locally: backend `npm install` / `tsc` / `eslint` / `nest build` / `npm test` all
   green (96 tests, 16 new for AssignmentsService — target validation, ownership checks, late/
   resubmission edge cases, review notification, and the teacher-sees-all-vs-student-sees-own
   submission scoping). Mobile hand-verified for import/path and API-shape correctness only —
   still no Flutter SDK in this environment.
2. **Performance/progress tracking ✅ implemented** — `backend/src/modules/performance`
   (performance_metric_definitions, performance_records) and, on mobile, a **Performance section
   on the existing Student Detail screen** (matching the Fees precedent) — teacher records a
   value against a metric, sees the student's history. docs/01 §1.4's whole point: the same two
   tables give an academic teacher "Test Score," a sports coach "40m Sprint Time," and a music
   teacher "Scale Mastery," never hard-coded per category — three example category-default
   metrics are seeded in the migration to demonstrate this, not to enumerate every category's
   real needs.

   docs/06 §6.2 gives three separate roles their own scope to *define* a metric — super_admin
   (category-wide defaults), institute_admin (institute-wide defaults), a teacher (their own) —
   enforced as an "exactly one of {teacherCategory, institute, teacherProfile}" rule, the same
   pattern used for Discount's class/student targeting and Notes' objectKey/externalUrl. Only a
   teacher can ever *record* a value against a metric (their own students only, verified via
   `student_teacher_assignments`) — institute_admin/super_admin hold `define`+`read` but never
   `record`, the same R-not-F pattern AssignmentsService already documents for its own resource.
   `institute` on the definition is an addition beyond docs/03's original sketch (which only
   listed teacher_category_id/teacher_profile_id) — docs/06 names "institute defaults" as a
   thing institute_admin can define, but the schema had nowhere to attach one; see docs/03's
   note. `teacher_categories.default_performance_template_id` (a reserved hint column since
   Phase 4 step 1) stays unused — a category's "default template" turned out to mean "however
   many teacherCategory-scoped rows exist" (plural), not one template id pointing at a single row.

   Real, tested validation: `value` is a plain string column (matching
   `AssignmentSubmission.grade`'s same "flexible column, service-validated" choice — no single
   fixed shape fits numeric/scale/pass-fail/text/percentage at once), checked against the
   metric's declared type at write time (a numeric string, "1".."5", "pass"/"fail", or non-empty
   text) rather than left to the schema to enforce.

   **This step is also where Docker finally became usable in this environment** (it had been
   down for every step before this one) and where the live-Postgres verification pass this
   unblocked immediately paid for itself:
   - **Local Postgres port collision, fixed**: a native Windows Postgres service was already
     bound to `0.0.0.0:5432`, silently intercepting connections meant for the docker-compose
     container and causing password-authentication failures against credentials that only ever
     existed in the fresh container. `infra/docker-compose.yml` now maps the container to host
     port **5433** instead (internal port unchanged); `backend/.env.example`,
     `config/configuration.ts`'s fallback, and `database/data-source.ts`'s fallback all updated
     to match. A genuinely common dev-machine annoyance, not specific to this session — worth
     keeping as the project's permanent default.
   - **A real bug in `AssignmentSubmission.grade`'s column definition**: `@Column({ nullable:
     true })` with a `string | null` TypeScript type has no explicit `type:`, and TypeORM's
     reflection-based type inference reports `Object` for that union rather than `String` —
     `migration:run` failed outright (`DataTypeNotSupportedError`) the moment it tried to build
     entity metadata against a live database. Every other nullable-string column in this codebase
     already declares its type explicitly (grep confirms it); this one didn't. Fixed by adding
     `type: 'varchar'`; the already-correct raw-SQL migration needed no change.
   - **A real security bug in refresh-token rotation**: `auth.e2e-spec.ts`'s "rotates the refresh
     token and rejects reuse of the old one" test failed — reuse was accepted. Root cause: the
     refresh-token JWT payload (`{ sub, role, instituteId, deviceId }`) had no unique claim, so
     two tokens issued for the same user/role/institute/device within the same wall-clock second
     (`iat` has 1-second resolution) sign to the byte-identical JWT string — the just-issued
     replacement token collided with, and shared a hash with, the very token being rotated out,
     so the reuse check matched the new row instead of correctly finding the old one revoked.
     Fixed by adding a random `jti` (via `randomUUID()`) to the refresh token's payload only
     (the access token doesn't need one — it's validated by signature alone, never looked up by
     hash). `auth.e2e-spec.ts` now passes for the first time ever in this project, 7/7.

   Verified locally: backend `npm install` / `tsc` / `eslint` / `nest build` / `npm test` all
   green (**142 tests** — 119 unit + 23 new for PerformanceService covering scope resolution,
   applicability checks, and per-metric-type value validation) — **and, for the first time,
   `npm run test:e2e` / `auth.e2e-spec.ts` actually ran against real Postgres and passed, 7/7**,
   plus all nine migrations applied cleanly end-to-end for the first time. Mobile hand-verified
   for import/path and API-shape correctness only — still no Flutter SDK in this environment.
3. **Parent dashboard + parent-specific notification digesting ✅ implemented** —
   notification digesting needed no parent-specific work: `NotificationsService`'s per-user
   channel preferences (Phase 4 step 8) are role-agnostic by construction, and Fees/Notes/
   Assignments already fan out to a student's linked guardians via `notifyStudentParty`/
   `getNotifiableUserIds` (built when each of those modules first shipped) — a parent has been
   receiving real-time-or-digested notifications about their child all along, they just had
   nothing to open in-app until this step's dashboard existed. On mobile, a real **child
   switcher** (docs/08 §8.1: "if
   >1 child" — a `ChoiceChip` row rendered as the dashboard's AppBar `bottom`, only ever
   constructed once there's more than one linked child), **real Dashboard summary tiles**
   (attendance %, fee status, a performance-records count, each computed live for whichever
   child is selected — "Upcoming classes" stays static, a documented deferral: no calendar/
   unified-schedule module yet, Phase 5 step 6), a **read-only Fees tab** (view-only by design,
   not an oversight — docs/06 §6.2 gives Parent "O" for viewing invoices but "–" for recording a
   payment; fee collection stays the teacher's/institute's authoritative record), and two new
   detail screens reachable from the Dashboard tab — **Attendance history** (docs/07 Phase 4
   step 5's own deferred item, picked up here as its natural first consumer) and **Performance
   history** (docs/08 §8.2's own separate "Performance | Metric history for the child" item,
   explicitly deferred out of step 2 above). `RoleDashboardScaffold` gained two small,
   backward-compatible optional slots to support this — `appBarBottom` (the switcher, visible on
   every tab since Fees also needs to know the selected child) and `dashboardExtra` (the two
   detail links) — every other role passes neither and is unaffected.

   **This step surfaced two real, previously-undiscovered gaps**, both now fixed:
   - `GET /students` (`StudentsService.findAll`) had no branch for a parent caller at all — it
     silently fell through to the teacher-scoped branch and returned an empty list every time,
     regardless of how many children were actually linked. There was no way for a parent to even
     discover their own children's ids, since every other endpoint (Fees, Attendance, Notes,
     Performance) already had correct guardian-link read access wired in from when each of those
     modules first shipped — this was the one missing piece blocking all of it in practice. Fixed
     with a real `parent` branch resolving via `student_guardian_links`, with new unit tests.
   - More significantly: nothing in this codebase ever actually linked a `Guardian.user`
     column to a real account. `findOrCreateGuardian` (students.service.ts) always created a
     guardian record from contact details alone, and — as guardian.entity.ts's own header
     comment already flagged as a known future item — "a login gets linked later if/when that
     guardian registers... and their phone/email is matched," but nothing ever performed that
     match. A parent could register and hold a perfectly valid `parent`-role account with zero
     way to ever reach any of the guardian-linked data every other module correctly gated on.
     Fixed in `AuthService.register()`: registering with role `parent` now links every existing
     `Guardian` row sharing that email/phone (and only in that direction — adding a guardian
     never searches for a matching user, so a teacher entering a parent's phone number can't
     silently grant that phone's existing account access to a different family's data than
     intended). `AuthService` had **zero unit test coverage of any kind** before this pass
     (only the e2e suite touched it) — `auth.service.spec.ts` is new, covering this linking
     logic plus baseline register() validation.

   Manually exercised end-to-end against real Postgres to confirm the full loop actually closes:
   teacher adds a guardian by email → a parent registers with that exact email → the guardian
   record links automatically → the parent immediately sees the linked child via `GET /students`
   and can read that child's performance data (200, not 403) — confirmed working live.
   Verified locally: backend `npm install` / `tsc` / `eslint` / `nest build` / `npm test` all
   green (128 tests, 5 new for AuthService's guardian-linking + baseline register() coverage);
   `npm run test:e2e` 7/7. Mobile hand-verified for import/path and API-shape correctness only —
   still no Flutter SDK in this environment.
4. **Institute/admin module ✅ implemented** — `backend/src/modules/institutes` (branches,
   teacher invites, revenue-split payouts) and a new `backend/src/modules/announcements`,
   plus, on mobile, a shared **Announcements** screen (Parent's own tab, Student's entry from
   the Notification center per docs/08 §8.2, Institute Admin's Dashboard quick action with
   compose) and the Institute Admin dashboard's **Teachers** tab (roster + invite).

   **Closed a real, previously-flagged-but-unfixed RBAC gap**: `InstitutesController`'s own
   comment used to say resource-level scoping ("only YOUR institute") was "a Phase 4 follow-up —
   flagged, not silently skipped." Until this step, any institute_admin *or* super_admin holding
   the role-level `institute.manage` permission could create/update/archive **any** institute, not
   just their own — contradicting docs/06 §6.2's literal "F (own institute)" grant for
   institute_admin. Fixed by threading `requester: AuthenticatedUser` through
   `create`/`update`/`archive` with a private `assertWriteAccess` (super_admin bypass;
   institute_admin restricted to `requester.instituteId === id`), and restricting `create()` to
   super_admin only — an institute_admin manages an *existing* institute, not spins up new ones,
   per the matrix.

   **Branches** (real since Phase 4 step 1 but never exposed) get their first CRUD pass —
   `branches.deleted_at` added (missing from the original entity; every other table in this
   schema soft-deletes). Nothing else in this codebase references a branch yet
   (Class/TeacherProfile scope by institute only) — a documented scope boundary, not an oversight.

   **Teacher invites** mirror `StudentInvite`'s shape exactly: a short-lived code
   (`randomBytes(5).toString('hex')`), redeemed once. Redeeming joins an *existing* teacher
   profile to an institute (a teacher must already have completed onboarding, Phase 4 step 2) —
   rejects outright if that profile is already affiliated with a (possibly different) institute,
   rather than silently reassigning it; an explicit transfer flow is a documented scope cut.

   **Revenue-split payouts** close a gap docs/03 §3.7 flagged from the start ("needs a
   payout-percent config that doesn't exist on any entity yet") — `teacher_profiles.payout_percent`
   answers it directly. `InstituteTeacherPayout` generates one row per **CONFIRMED payment**, not
   per invoice (`payment_id`, unique — an addition beyond docs/03's sketch) so a partially-paid
   invoice generates a proportional payout as each payment lands, and a retried gateway webhook
   can never double-generate one for the same payment. Generation lives inside `FeesService`
   itself (`generatePayoutIfApplicable`, called from both `recordPayment` and
   `confirmGatewayWebhook`) rather than via a new Fees→Institutes service call — it already has
   payment/invoice/teacherProfile loaded at that point, and the two modules just share the entity,
   matching this codebase's "each module injects entities it needs directly" convention.

   **Announcements** get their own new module rather than living inside Institutes — three
   independent "send" grants (teacher: own class, institute_admin: own institute, super_admin:
   platform) but one shared "read" for every role, resolved the same way `NotesService` resolves
   "what am I allowed to see": build a list of relevant targets for the requester (their
   institute, their classes, PLATFORM always), then fetch whatever matches. Two deliberate
   deviations from docs/03 §3.8's sketch: `createdBy` (a plain User) replaces
   `teacher_profile_id` (an institute_admin/super_admin sender has no teacher profile at all), and
   a new `PLATFORM` target type replaces the sketched `'individual'` (neither docs/03 nor docs/06
   ever specified who could use `'individual'` or why, while docs/06 §6.2 names super_admin's
   grant as literally "platform-wide" with nowhere for that to point).

   **This step's `find`/`findOne` calls got caught proactively twice, before ever running the
   code**, by deliberately re-checking every new one against the pattern that bit Assignments and
   Performance via live testing earlier: none of `PayoutsService.listPayouts()`'s three role
   branches requested `relations: { teacherProfile: true, invoice: true }` despite `toSummary()`
   reading both, and `FeesService.confirmGatewayWebhook`'s payment lookup was missing
   `teacherProfile`/`institute` on `invoice` — both fixed before the first test run.

   **Then live testing caught a fifth, more consequential instance — the actual root cause behind
   the other four.** Manually exercising the new payout-generation flow end-to-end (redeem a
   teacher invite → create a class as that teacher → confirm a payment) surfaced `institute: null`
   on a class created by a teacher who had just joined an institute. The cause:
   `TeacherProfilesService.findByUserId()` — a shared method with **~15 call sites** across
   Classes, Students, Assignments, Fees, Notes, Performance, Payouts, and Announcements — never
   requested the `institute` relation at all. Every caller reading `teacherProfile.institute` got
   `undefined` back, silently swallowed by an `?? null` or `?.` fallback at each site. Concretely:
   every class ever created by an institute-affiliated teacher was silently getting `institute:
   null` (`ClassesService.create`) — which would have made this very step's revenue-split payout
   feature never fire for a real institute-collected class, the one scenario it exists for. Fixed
   at the source (`findByUserId` now always loads `institute`) rather than patching each call
   site, which also let two call sites that had been working around the gap with their own
   redundant re-query (`TeacherInvitesService.redeemInvite`, `AnnouncementsService
   .getRelevantTargets`'s teacher branch) simplify back down to using the method's own result.
   TypeORM never eager-loads a `ManyToOne` unless a relation is declared `eager: true`
   (`TeacherProfile.teacherCategory` is the only one in this codebase that does) or explicitly
   requested — five instances of this exact bug class have now surfaced in this project, and this
   one was root-caused rather than patched at its symptom.

   Mobile: `GET /auth/me`'s response already carried each role's own `instituteId`
   (`AuthService.me`) but the client discarded it — `MeResponseDto`/`AppUser` only ever kept
   `activeRole`. Fixed (`AppUser.instituteId`) since the Teachers roster and the institute-wide
   announcement compose action both need to know the signed-in institute_admin's own institute
   without a separate round trip. A new `backend/src/modules/teacher-profiles` route,
   `GET institutes/:id/teachers` (gated by the existing `teacher_profile.read` permission, no new
   grant needed), backs the roster — placed there rather than on `InstitutesController`, the same
   way `FeesController`'s `institutes/:id/revenue-summary` already lives in the module that owns
   the underlying data. Payout-config *editing* has no mobile surface yet — a documented scope
   cut matching Branches' own precedent; the roster still surfaces the configured percent,
   read-only.

   **A sixth bug, this one pre-existing since Phase 4 step 6 (Fees), surfaced while setting up
   that live payout test**: recording a manual cash/UPI/bank-transfer payment
   (`FeesService.recordPayment`) has never actually worked against a real database.
   `paymentRepo.create({...})` never carried `dto.idempotencyKey` through onto the entity, and
   `payments.idempotency_key` is a real `NOT NULL UNIQUE` column — every call died with a
   Postgres constraint violation. Every unit test for this path mocks `paymentRepo.create`/`save`
   as pass-through functions that happily accept an incomplete object, so nothing before this
   caught it; only a real insert against a real column constraint could. Fixed by adding the one
   missing field, with a new regression test asserting `idempotencyKey` specifically appears in
   what gets passed to `create()` (a mocked-repo test can't catch the missing *column*, but it can
   catch the missing *field*, which is what actually regressed here).

   Verified locally: backend `npm install` / `tsc` / `eslint` / `nest build` / `npm test` all
   green (170 tests — 42 new, covering InstitutesService's resource-level scoping,
   TeacherInvitesService's redemption edge cases, PayoutsService's role-scoped listing and
   idempotent-generation guard, AnnouncementsService's per-role send/read scoping, the new
   teacher-roster listing, and the `recordPayment` idempotency-key regression guard);
   `npm run test:e2e` 7/7; migration applied cleanly against live Postgres. Manually exercised
   end-to-end against real Postgres: an institute_admin's every write and read (institute update,
   branch create/list, teacher-invite create/list, roster view) rejected with 403 against a
   second, unrelated institute; a teacher invite generated by that admin and redeemed by a real
   teacher account, joining it to the institute; a class created by that teacher correctly
   institute-linked (confirming the `findByUserId` fix); a fee structure, invoice, and manual cash
   payment recorded against it generating a real `institute_teacher_payouts` row at the
   configured 30% (₹1000 payment → ₹300 payout), marked paid, with a same-idempotency-key retry
   confirmed to return the existing payment and generate no second payout; a teacher's
   class-targeted announcement and the admin's institute-wide one both correctly surfaced to an
   enrolled student's `GET /announcements`. Mobile hand-verified for import/path and API-shape
   correctness only — still no Flutter SDK in this environment.
5. **Reports & analytics ✅ implemented** — a new `backend/src/modules/reports`: three
   synchronous report endpoints (`GET /reports/attendance`, `/reports/fees`,
   `/reports/students/:id`) plus an async `export_jobs` pair (`POST /export-jobs` → `GET
   /export-jobs/:id` → `GET /export-jobs/:id/file`) for the two report types genuinely large
   enough to warrant it (docs/03 §3.11's own note on why the per-student report doesn't get one).
   Mobile: a shared **Reports** screen (report type, date range, CSV/PDF picker, one "Generate"
   button) wired into Institute Admin's Reports tab and — the "More" tab's first real use —
   the Teacher shell's `More → Reports`.

   docs/06 §6.2 "Reports/analytics | F (own scope) | – | – | F (institute scope) | F (platform
   scope)" — one `report.generate` permission for the three roles that hold it at all; scope
   (own classes/students, own institute, or any institute/platform-wide) is resolved
   server-side, never from a client-supplied id except super_admin's optional `instituteId` —
   see `report-query.dto.ts`'s header comment on why this replaces docs/04's single composite
   `scope=` param with a well-typed optional field. Every module ReportsService reads from
   (Attendance, Fees, Performance) is injected by entity directly, never by importing that
   module's service — this codebase's established "each module duplicates the small helper it
   needs" convention (`FeesService.getFinancials`'s net/paid-total logic is re-derived here, not
   imported).

   **PDF generation is real** (`pdfkit`, a new dependency — CSV stays hand-rolled, matching the
   existing "dependency-light for genuinely simple serialization" preference, e.g. mobile's
   `Result<T>`): a hand-rolled table layout (fixed column positions, explicit `doc.y` resets per
   row, a repeated header on each new page) rather than pdfkit's own table helper, since this
   environment has no way to render and visually verify a PDF — a manual, easy-to-reason-about
   layout was the safer choice to write correctly without that feedback loop.

   **Two real bugs, both structural rather than logic errors, caught only by actually running
   the code — a `tsc`/`nest build` pass never executes anything, so neither surfaced there**:
   - `import PDFDocument from 'pdfkit'` type-checks (`allowSyntheticDefaultImports` is set) but
     is a genuine runtime bug: that flag only relaxes the type checker, it does not add the
     `esModuleInterop` helper a default import of a `module.exports = PDFDocument`-style CJS
     package actually needs — `tsconfig.json` here sets `allowSyntheticDefaultImports` without
     `esModuleInterop`. Every PDF request would have thrown `TypeError: ... is not a constructor`
     against the real running server, and did against this module's own new unit tests the
     moment they exercised the code path — caught there, before it ever reached a live request.
     Fixed with the interop-safe `import PDFDocument = require('pdfkit')` form.
   - `ExportJob.objectKey?: string | null` with no explicit `type:` — the exact bug class
     `AssignmentSubmission.grade` hit in Phase 5 step 2 (TypeORM's reflection-based type
     inference reports `Object` for a nullable-string union, which Postgres rejects outright).
     Caught live running this step's own migration (`DataTypeNotSupportedError`), fixed by
     adding `type: 'varchar'`.

   Manually verified end-to-end against real Postgres: attendance and fees reports generated in
   both CSV and PDF (PDF bytes confirmed as valid `PDF document` files, not just a 200 status) for
   a teacher's own class/invoice data; a student report PDF for a student the teacher actually
   teaches; the async export-job pipeline (202 + PENDING → background-completes to COMPLETED →
   file downloadable, all within roughly the same request/response cycle in this dev
   environment) with a second user correctly rejected (403) from reading someone else's job.

   **Deferred, documented**: the async export-job path has no mobile UI this pass — the direct
   synchronous endpoints already cover this app's real scale, and a polling UI for "large"
   exports with no realistically large dataset to test it against would be speculative, not
   real. Institute Admin's separate "Revenue/payouts | Teacher revenue-split summary" screen
   (reachable from Reports per docs/08 §8.2) is a further scope cut, matching Branches/Payouts'
   own precedent from step 4 — the backend endpoint (`GET institute-teacher-payouts`) already
   exists and works, just with no mobile screen consuming it yet.

   Verified locally: backend `npm install` / `tsc` / `eslint` / `nest build` / `npm test` all
   green (183 tests, 13 new); `npm run test:e2e` 7/7; migration applied cleanly against live
   Postgres. Mobile hand-verified for import/path and API-shape correctness only — still no
   Flutter SDK in this environment.
6. **Calendar unification ✅ implemented** — a new `backend/src/modules/calendar`: one
   `GET /calendar?from=&to=&ownerType=&ownerId=` endpoint aggregating `class_occurrence`,
   `assignment_due`, and `fee_due` events live from Classes/Assignments/Fees rather than a
   persisted `calendar_events` table (docs/03 §3.8's own note explains why — the same reasoning
   Reports/Attendance-history/Fees'-revenue-summary already establish in this codebase). Mobile:
   a shared **Calendar** screen (a week at a time, Prev/Next navigation, events grouped by day)
   reached from a Dashboard quick action on all four role dashboards — docs/08 §8.2 didn't
   actually list a Calendar screen for any role before this step, so it was added there first,
   worded identically ("Dashboard quick action") across Teacher/Student/Parent/Institute Admin
   per docs/06 §6.2's own Calendar row.

   **Scope resolution matches Reports' established pattern**: omitted, `ownerType`/`ownerId`
   default to "my own calendar" per role (a teacher's own classes, a student's own active
   enrollments, every one of a parent's linked children's aggregated together, an
   institute_admin's own institute, platform-wide for super_admin) — never a client-supplied id
   for the common case. Two explicit lookups are supported this pass: `ownerType=class` (a
   documented, bounded case — "this class's calendar," e.g. from a future Class Detail screen)
   and a new `ownerType=institute` (an addition beyond docs/03's sketched enum, the same class of
   gap `PLATFORM` filled for Announcements' `target_type` — institute_admin's own "R (institute)"
   grant needed somewhere to point). An explicit `'teacher'`/`'student'` naming someone other
   than the caller is a documented scope cut, not part of what docs/06's matrix actually grants.

   **Conflict detection is real, reusing `ClassesService.getConflicts`'s own two rules** (teacher
   double-booking, same-institute-same-location clash) and its exact `materializeOccurrences`
   RRULE-expansion utility — imported directly as a pure function (no service-to-service call,
   consistent with this codebase's convention since it's stateless math, not business logic tied
   to another module's entities). Computed as a plain pairwise overlap check over whatever
   `class_occurrence` events are already in hand building the calendar itself, rather than the
   N-more-queries-per-class the original per-class endpoint does — cheaper precisely because a
   calendar view has already fetched everything conflict-checking needs. Deliberately does not
   layer `schedule_exceptions` (holiday/cancelled/rescheduled) onto materialized occurrences —
   the same simplification `getConflicts` already makes, not a new gap this step introduces.

   One `calendar.read` permission covers the whole module (docs/06 §6.2 has no separate verbs
   here either); every entity this reads (Classes, Assignments, Fees, Students) is injected by
   entity directly rather than importing those modules' services, per this codebase's established
   convention.

   Mobile scope cut, documented: no in-app calendar-grid UI (month view, drag-to-reschedule) —
   a day-grouped week list with Prev/Next is the honest scope for this pass, matching how other
   "history" screens in this codebase (Attendance history, Notification center) are lists, not
   custom canvas widgets.

   Verified locally: backend `npm install` / `tsc` / `eslint` / `nest build` / `npm test` all
   green (196 tests, 13 new); `npm run test:e2e` 7/7; migration applied cleanly against live
   Postgres. Manually exercised end-to-end against real Postgres: two classes for one teacher
   scheduled with a genuine 30-minute overlap correctly returned 6 occurrences over one week, all
   flagged `teacher_double_booking`; a third, non-overlapping class on the same calendar
   correctly came back `conflict: false`; an explicit `ownerType=class` lookup for a class the
   requester doesn't teach correctly rejected with 403; an assignment due date correctly appeared
   as its own `assignment_due` event alongside the class occurrences. Mobile hand-verified for
   import/path and API-shape correctness only — still no Flutter SDK in this environment.
7. **CSV import ✅ implemented (backend); mobile deferred, documented** — `POST
   /students/import` (multipart, `file` field) + `GET /students/import-jobs/:id`, docs/04 §4.7's
   async-job pattern applied to bulk student onboarding. Previously deliberately skipped (Phase
   4 step 3's own note: "the async-job pattern it needs depends on the BullMQ queue that arrives
   with Notifications" — moot now; Notifications never actually wired up BullMQ either) using the
   exact fire-and-forget-in-process pattern Reports' `export_jobs` already established (step 5):
   the job row is created and returned immediately (`202` + `PENDING`), the real work — parsing,
   per-row validation, and calling `StudentsService.create` for each row — runs right after,
   in-process.

   **Row-level validation reuses `CreateStudentDto`'s own class-validator decorators**
   (`plainToInstance` + `validate`, the same two calls Nest's `ValidationPipe` runs internally
   for a normal request body) rather than a hand-rolled second set of field checks — a malformed
   CSV row and a malformed `POST /students` body get identically worded errors. One bad row never
   aborts the rest of the import (docs/04 §4.7 "gives every bulk operation a natural retry point
   if it fails partway") — the job's `errors` array names the exact row and reason, `successCount`
   /`failureCount` track the split, and the job only ends `FAILED` outright when *every* row
   failed.

   **CSV parsing is hand-rolled** (`utils/csv-parser.util.ts`), matching the same
   "dependency-light for genuinely simple serialization" preference behind Reports' CSV writer —
   full RFC 4180 double-quote escaping (embedded commas, newlines, doubled-quote-as-literal-quote)
   with its own dedicated test file. File upload uses `@nestjs/platform-express`'s
   `FileInterceptor` (Multer, already a transitive dependency — no new package) with a 5MB limit;
   `@types/multer` was the one addition needed (types only, no runtime dependency).

   **A real bug, caught live testing this exact flow**: `class-validator`'s `ValidationError` is
   a tree, not a flat list — a failure inside a `@ValidateNested` property (here, the CSV row's
   optional single guardian, itself validated as `GuardianInputDto`) lands in that error's
   `children`, not its own `constraints`. Reading only the top-level `constraints` silently
   dropped every nested-object validation message down to a generic "Invalid row" — a bad
   `guardianEmail` never said *why* it failed. Fixed with a small recursive
   `flattenValidationMessages` helper that walks the whole error tree; `email must be an email`
   now surfaces correctly. A regression test asserts the specific message, not just that *a*
   failure was recorded.

   **Mobile scope cut, documented — not silently skipped**: docs/08 §8.2's "Add/invite student"
   row lists "import CSV" as a third FAB option alongside the manual form and invite-code
   generation, but actually letting a user pick a local CSV file needs `file_picker` (or
   equivalent), the exact same missing pubspec dependency already documented as the reason
   Notes/Assignments stayed link-only in Phase 4 step 7 / Phase 5 step 1. No mobile screen is
   built this pass for the same reason — the backend endpoint is real and fully usable (a
   teacher/admin can already drive it via any HTTP client, e.g. `curl -F file=@students.csv`),
   there's simply no in-app file picker yet to hand it a file from.

   Verified locally: backend `npm install` / `tsc` / `eslint` / `nest build` / `npm test` all
   green (213 tests, 17 new); `npm run test:e2e` 7/7; migration applied cleanly against live
   Postgres. Manually exercised end-to-end against real Postgres: a real multipart CSV upload (4
   data rows — two valid with an inline guardian, one missing `fullName`, one with an invalid
   guardian email) correctly returned `202` + `PENDING` with `totalRows: 4`, then polled to
   `COMPLETED` with `successCount: 2`/`failureCount: 2` and the two specific per-row error
   messages; the two successful rows confirmed as real students with their guardian correctly
   linked (phone/email intact); a second teacher correctly rejected (403) from reading the first
   teacher's import job; an import request with no file attached correctly rejected (400).
8. **Admin web panel** (Flutter Web target, docs/02 §2.8).

## Phase 6 — Testing & production deployment

- Full integration-test suite green on CI (docs/05 §5.7 list).
- Security review pass against docs/04 §4.8 baseline + a dedicated pass for the OWASP Mobile Top 10 and OWASP API Top 10.
- Load testing on attendance-bulk-mark and invoice-generation endpoints specifically (the two highest write-volume paths at term-start/month-start).
- App Store / Play Store submission (privacy nutrition labels, data-safety form — both need the data-handling map from docs/03 to fill out accurately, particularly minors' data per docs/01 §1.3 consent handling).
- Staged rollout (Play Console staged rollout %, TestFlight external testing) rather than 100% release on day one.

## Phase 7 — Future-ready (explicitly deferred, architecture already accommodates)

| Feature | Why it's deferred, not dropped | What in the current design already prepares for it |
|---|---|---|
| Video/online class integration | Third-party dependency choice (Zoom/Jitsi/custom) is a product decision better made with real usage data on how much of the base actually teaches online | `classes.mode='online'` + `location_or_meeting_link` already generic enough to hold a generated meeting link |
| AI lesson plans / AI performance insights | Needs real performance-record volume (docs/03 §3.8) to be useful at all — building it before data exists produces a gimmick, not a feature | `performance_metric_definitions`/`performance_records` schema is the exact input an insights model would consume |
| Smart fee reminders (ML-timed, not just rule-based) | Rule-based reminders (BullMQ scheduled jobs, docs/02 §2.5) ship first and are the majority of the value; ML timing is a refinement | Reminder jobs already run through the queue, so swapping "send at fixed offset" for "send at model-predicted best time" is a worker-logic change, not an architecture change |
| Teacher marketplace / discovery | Requires trust & safety (real verification, review moderation) at a maturity level beyond MVP | `verification_requests` + `teacher_profiles.rating_avg` already modeled; discovery is a new read-path/search index on top, not a schema rework |
| Student booking system (trial/paid session self-serve booking) | Depends on marketplace above for standalone teachers; for institute use it's a UI addition on existing `waitlist_entries`/`enrollments` | Trial session type (docs/01 §1.3) and waitlist already exist |
| Subscription plans (institute billing tiers) | Needs usage data to price correctly | `institutes.subscription_plan_id` FK already reserved in schema (docs/03 §3.2) |
| Multi-institute / franchise management | Natural extension of the branch model once one real multi-branch customer exists | `institutes → branches` hierarchy (docs/02 §2.3) is the exact shape this needs |
| White-label apps | Purely a theming/config-per-tenant exercise once the design-token system (docs/05 §5.8) exists | Token-based theming means a white-label build is a build-time config swap, not a UI rewrite |
| In-app chat | Explicitly called out in the spec as optional/scalable-module; real-time infra (docs/04 §4.6) is deliberately not built until this is prioritized | REST + push notification model already covers async communication; chat is additive |

Nothing in Phase 7 requires undoing a Phase 1–6 decision — that's the test each of those phases' architecture choices was held to.
