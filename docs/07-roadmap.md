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
   `tsc --noEmit` / `eslint` / `nest build` / `npm test` all green, plus a real `auth.e2e-spec.ts`
   (needs Postgres up — not run in the sandbox this was built in, no Docker daemon available);
   mobile hand-verified for import/path correctness but not yet run through `flutter analyze` /
   `flutter test` (no Flutter SDK in that environment) — run both before building on top of it.
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
2. **Performance/progress tracking** — configurable metrics, docs/01 §1.4.
3. **Parent dashboard + parent-specific notification digesting.**
4. **Institute/admin module** — branches, teacher invites, institute-wide announcements,
   revenue-split payouts (docs/01 §1.3).
5. **Reports & analytics** — PDF/CSV export, async export jobs per docs/04 §4.7.
6. **Calendar unification** — conflict detection surfaced in UI (docs/03 §3.5).
7. **CSV import** for bulk student onboarding.
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
