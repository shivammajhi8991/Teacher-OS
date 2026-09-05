# TeacherOS — Teacher & Student Management Platform

A production-oriented "Teacher Operating System": a cross-platform Flutter app (iOS/Android) backed by a NestJS + PostgreSQL API, serving Teachers, Students, Parents/Guardians, and Institute Admins across every teaching vertical (school, private tutoring, music, dance, sports, fitness, yoga, art, language, tech training, coaching institutes, freelance/online).

## Status

**Phase 1–3 (docs below) complete. Phase 4 (MVP build) in progress — steps 1 (Auth), 2 (Teacher
onboarding & profile), 3 (Student Management), 4 (Classes/Batches, incl. RFC 5545 scheduling and
non-blocking conflict detection), 5 (Attendance, incl. the Quick Attendance flagship flow and the
offline-sync engine), 6 (Fees, incl. immutable invoices, attendance-based proration, and a
real-but-mocked payment gateway), and 7 (Notes, incl. link/student/class/institute sharing, a
real-but-local-disk file storage adapter, and download-access gating separate from read access)
are implemented end-to-end in both `backend/` and `mobile/`, verified locally (backend:
`npm install`, `tsc`, `eslint`, `nest build`, and `npm test` all pass — 65 tests; mobile:
hand-verified import paths, not yet run through `flutter analyze`/`flutter test` — no Flutter SDK
in the environment this was built in, see [mobile/README.md](mobile/README.md)).**

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
│   ├── src/modules/         # auth ✅ users ✅ institutes ✅ teacher-profiles ✅ students ✅ classes ✅ attendance ✅ fees ✅ notes ✅ — rest are stub READMEs
│   ├── src/common/          # guards, interceptors, decorators, filters — implemented
│   ├── src/database/        # data-source.ts + seven migrations — implemented
│   └── test/                # auth.e2e-spec.ts
├── mobile/                 # Flutter app — see mobile/README.md
│   └── lib/
│       ├── app/             # router, theme, bootstrap — implemented
│       ├── core/            # network, storage, error, theme, widgets, sync — implemented (sync is JSON-file-backed, not Drift — docs/05 §5.4)
│       └── features/        # auth ✅ onboarding ✅ students ✅ classes ✅ attendance ✅ fees ✅ notes ✅ dashboard (shell) ✅ — rest are stub READMEs
├── admin-web/               # Admin panel (Flutter Web target, docs/02 §2.8) — not started
└── infra/                   # docker-compose.yml for local Postgres + Redis
```

## Next step

Phase 4 continues per [docs/07-roadmap.md](docs/07-roadmap.md)'s build order: Notifications is the one remaining MVP step, following the same pattern the first seven steps established (backend module + migration, Flutter feature slice, tests) against the schema and API contract already agreed in `docs/03`/`docs/04`. Worth noting: Fees' offline behavior stayed on Attendance's simpler "always converges" policy rather than building the fuller "financial edits never auto-merge, dedicated conflict-resolution screen" policy docs/05 §5.4 describes — `POST /payments` isn't wired into the mobile offline queue at all yet (a payment while offline currently just fails with a network error rather than queuing), which is the honest state to build that fuller policy against whenever it's prioritized. Notes is mobile-scoped to link-only sharing for the same reason CSV import was scoped out of Students — a real file-upload/download UI needs new pubspec dependencies (`file_picker`, and a way to open a downloaded file) not yet pulled into this pass; the backend supports the full upload/version/download flow already.
