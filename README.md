# TeacherOS — Teacher & Student Management Platform

A production-oriented "Teacher Operating System": a cross-platform Flutter app (iOS/Android) backed by a NestJS + PostgreSQL API, serving Teachers, Students, Parents/Guardians, and Institute Admins across every teaching vertical (school, private tutoring, music, dance, sports, fitness, yoga, art, language, tech training, coaching institutes, freelance/online).

## Status

**Phase 1–3 (docs below) complete. Phase 4 (MVP build) is complete** — all 8 steps (Auth;
Teacher onboarding & profile; Student Management; Classes/Batches with RFC 5545 scheduling and
non-blocking conflict detection; Attendance with the Quick Attendance flagship flow and the
offline-sync engine; Fees with immutable invoices, attendance-based proration, and a
real-but-mocked payment gateway; Notes with link/student/class/institute sharing and a
real-but-local-disk file storage adapter; and Notifications with per-category channel
preferences, digest batching, and a real-but-mocked push adapter). **Phase 5 (Advanced features)
is in progress** — step 1 (Assignments & homework), step 2 (Performance tracking: configurable
per-category metrics), step 3 (Parent dashboard: child switcher, real summary tiles,
attendance/performance/fees history, all read-only per docs/06's RBAC matrix), step 4
(Institute/admin module: branches, teacher invites, revenue-split payouts, and a new
Announcements module), step 5 (Reports & analytics: attendance/fees/student reports in
CSV/PDF, plus an async export-job pair for the two report types large enough to warrant one), and
step 6 (Calendar unification: a unified `class_occurrence`/`assignment_due`/`fee_due` view
computed live rather than a persisted table, with real conflict detection reusing Classes' own
double-booking/location-clash rules) are implemented end-to-end in both `backend/` and `mobile/`,
verified locally (backend: `npm install`, `tsc`, `eslint`, `nest build`, and `npm test` all
pass — 196 tests, plus `npm run test:e2e` 7/7 against real Postgres; mobile: hand-verified import
paths, not yet run through `flutter analyze`/`flutter test` — no Flutter SDK in the environment
this was built in, see
[mobile/README.md](mobile/README.md)).

**Docker became usable partway through step 2**, and `npm run test:e2e` / live manual API
exercises against real Postgres — both possible in this project for the first time — immediately
caught and fixed several real bugs: a local Postgres port collision (now avoided by
`infra/docker-compose.yml`'s host-port remap), a refresh-token rotation bug where same-second
token issuance could collide and let a rotated-out token be reused, the fact that nothing in
this codebase ever actually linked a guardian record to a real parent's account (meaning no
parent could ever reach any of the guardian-linked read access already built into
Fees/Attendance/Notes/Performance since Phase 4), and — in step 4 — a real,
previously-flagged-but-unfixed RBAC gap where any institute_admin or super_admin holding the
role-level `institute.manage` permission could create/update/archive **any** institute, not just
their own, plus a pre-existing bug where recording a manual cash/UPI/bank-transfer payment
(`FeesService.recordPayment`, Phase 4 step 6) never actually worked against a real database — it
silently dropped `idempotencyKey` before saving, a real `NOT NULL UNIQUE` column, so every such
payment died on a Postgres constraint violation that no mocked-repository unit test could ever
have caught. A missing-TypeORM-relation bug class — a `find`/`findOne` not requesting a
`ManyToOne` TypeORM never eager-loads by default — has now recurred **five times**: caught live
(via a crash) in Assignments' and Performance's class-ownership checks in steps 1–2, then caught
proactively in step 4 (before ever running the code) in `PayoutsService` and
`FeesService.confirmGatewayWebhook`, and finally root-caused in step 4's own live testing —
`TeacherProfilesService.findByUserId()`, shared by roughly 15 call sites across the codebase, had
never loaded `institute` at all, silently giving every institute-affiliated teacher's newly
created class `institute: null`. Step 5 (Reports) added two more of a related but distinct kind —
structural bugs invisible to `tsc`/`nest build` because neither ever executes the code: a pdfkit
default-import that type-checks but throws at runtime (`allowSyntheticDefaultImports` isn't
`esModuleInterop`), and another nullable-string column missing an explicit TypeORM `type:`, the
same class of bug `AssignmentSubmission.grade` hit in step 2. All are detailed in
[docs/07-roadmap.md](docs/07-roadmap.md)'s Phase 5 step 2 through step 5 entries.

Stack decisions locked: Flutter (Riverpod, clean/feature-first architecture) + NestJS + PostgreSQL
+ Redis + FCM, per user selection on 2026-09-04.

## How to read this repo

Read in this order:

1. [docs/01-product-analysis.md](docs/01-product-analysis.md) — personas, real-world workflow problems, edge cases, and features added beyond the original spec (with justification for each).
2. [docs/02-architecture.md](docs/02-architecture.md) — system architecture, multi-tenancy model, service boundaries, infra, observability, deployment.
3. [docs/03-database-schema.md](docs/03-database-schema.md) — full relational schema with rationale for key design choices (soft deletes, audit trail, offline sync support).
4. [docs/04-api-design.md](docs/04-api-design.md) — REST API surface, auth flow, RBAC enforcement, idempotency, pagination/error conventions.
5. [docs/05-flutter-architecture.md](docs/05-flutter-architecture.md) — Flutter project structure, state management, offline-first sync design, navigation/RBAC guards, i18n.
6. [docs/06-roles-permissions.md](docs/06-roles-permissions.md) — full RBAC permission matrix.
7. [docs/07-roadmap.md](docs/07-roadmap.md) — phased delivery plan from MVP to future-ready features, with explicit scope per milestone.
8. [docs/08-ux-flows.md](docs/08-ux-flows.md) — full screen inventory per role, the two named critical flows (Quick Attendance, Fee Collection) tap-by-tap, secondary flows, and empty/loading/error state patterns.

## Repo layout (current)

```
TeacherOS/
├── docs/                  # design documentation (8 documents, Phase 1–3)
├── backend/                # NestJS API — see backend/README.md
│   ├── src/modules/         # auth ✅ users ✅ institutes ✅ teacher-profiles ✅ students ✅ classes ✅ attendance ✅ fees ✅ notes ✅ notifications ✅ assignments ✅ performance ✅ — rest are stub READMEs
│   ├── src/common/          # guards, interceptors, decorators, filters, storage (shared by notes/assignments) — implemented
│   ├── src/database/        # data-source.ts + ten migrations — implemented, applied end-to-end against real Postgres
│   └── test/                # auth.e2e-spec.ts — passes against real Postgres (docker-compose up, see backend/README.md)
├── mobile/                 # Flutter app — see mobile/README.md
│   └── lib/
│       ├── app/             # router, theme, bootstrap — implemented
│       ├── core/            # network, storage, error, theme, widgets, sync — implemented (sync is JSON-file-backed, not Drift — docs/05 §5.4)
│       └── features/        # auth ✅ onboarding ✅ students ✅ classes ✅ attendance ✅ fees ✅ notes ✅ notifications ✅ assignments ✅ performance ✅ parent ✅ dashboard (shell) ✅ — rest are stub READMEs
├── admin-web/               # Admin panel (Flutter Web target, docs/02 §2.8) — not started
└── infra/                   # docker-compose.yml for local Postgres (host port 5433 — see its own comment) + Redis
```

## Next step

Phase 4 (MVP build) is complete; Phase 5 (Advanced features, see [docs/07-roadmap.md](docs/07-roadmap.md)) is in progress — steps 1–6 (Assignments, Performance tracking, Parent dashboard, the Institute/admin module incl. announcements, Reports & analytics, and Calendar unification) are done, and steps 7–8 (CSV import and the Admin web panel) are next. Worth noting a few things the next pass should know about: Fees' offline behavior stayed on Attendance's simpler "always converges" policy rather than building the fuller "financial edits never auto-merge, dedicated conflict-resolution screen" policy docs/05 §5.4 describes — `POST /payments` isn't wired into the mobile offline queue at all yet (a payment while offline currently just fails with a network error rather than queuing). Notes and Assignments are both mobile-scoped to link-only content for the same reason CSV import was scoped out of Students — a real file-upload/download UI needs new pubspec dependencies (`file_picker`, and a way to open a downloaded file) not yet pulled into this pass; the backend supports the full upload/version/download flow for both already, via a storage adapter now shared between the two modules (`backend/src/common/storage/`). Notifications' push delivery is real-but-mocked (no Firebase project exists) and mobile never registers a device token (needs `firebase_messaging` + real platform config); digest batching runs on an in-process cron rather than BullMQ, since nothing in this codebase actually connects to Redis yet — the same reason Reports' async export-job path (step 5) runs its background work as a fire-and-forget call in-process rather than a real queued job. Reports is also this project's first real new backend dependency since the initial scaffold (`pdfkit`, for actual PDF generation) — CSV stays hand-rolled. Docker is now usable in this environment (it wasn't for Phase 4 or Phase 5 step 1) — `docker compose -f infra/docker-compose.yml up -d && npm run migration:run` in `backend/` gets a real Postgres up (host port **5433**, not 5432 — see that compose file's comment), and `npm run test:e2e` is worth running after any auth/RBAC change from here on, now that it actually can be — it, and manually exercising the live API, have together caught four real bugs so far (see the Status section above).
