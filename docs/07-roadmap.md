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
6. **Fees** — fee structures, invoice generation, offline payment recording, receipts. *(docs/03 §3.7)*
7. **Notes** — upload, share to student/class, download tracking. *(docs/03 §3.8)*
8. **Notifications** — FCM wiring, preference center, digest batching. *(docs/02 §2.5, docs/01 §1.3)*

Each MVP step ships with: backend module + migration, Flutter feature (data/domain/presentation), unit + widget tests, and — for steps 3, 5, 6 — the integration test named in docs/05 §5.7.

## Phase 5 — Advanced features

- Assignments & homework (submission/review/grading).
- Performance/progress tracking (configurable metrics, docs/01 §1.4).
- Parent dashboard + parent-specific notification digesting.
- Institute/admin module: branches, teacher invites, institute-wide announcements, revenue-split payouts (docs/01 §1.3).
- Reports & analytics (PDF/CSV export, async export jobs per docs/04 §4.7).
- Calendar unification + conflict detection surfaced in UI (docs/03 §3.5).
- CSV import for bulk student onboarding.
- Admin web panel (Flutter Web target, docs/02 §2.8).

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
