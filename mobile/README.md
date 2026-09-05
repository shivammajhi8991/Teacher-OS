# TeacherOS Mobile

Flutter app — see [../docs/05-flutter-architecture.md](../docs/05-flutter-architecture.md) for the
full design rationale and [../docs/08-ux-flows.md](../docs/08-ux-flows.md) for the screen
inventory and flows this scaffold implements.

> **This scaffold was authored without a Flutter SDK available in the dev environment it was
> built in.** Every file was hand-written to the conventions in docs/05, and imports/paths were
> checked by hand, but `flutter pub get` / `flutter analyze` / `flutter test` have **not** been run
> against it yet. Run all three as your first step before building on top of it.

## Implemented so far (docs/07 Phase 4, steps 1–5)

- `app/` — `MaterialApp.router` shell, Material 3 light/dark theme, go_router with
  protected-by-default RBAC-style redirect (docs/05 §5.3)
- `core/network` — Dio client with an auth interceptor (attaches the access token, does a single
  de-duplicated refresh-and-retry on 401, per docs/02 §2.4)
- `core/storage` — secure token storage (flutter_secure_storage, never SharedPreferences for
  tokens) + persistent device id
- `core/sync` — offline queue (`SyncQueueStore`) + read-through cache (`OfflineCacheStore`),
  both JSON-file-backed rather than the originally-planned Drift (no Flutter SDK to run its
  codegen in this environment — see docs/05 §5.4 for the swap-in path back to Drift later).
  `SyncEngine` drains the queue on reconnect/periodically via a registered-replayer map, kept
  feature-agnostic on purpose — Attendance is the only registrant so far
- `core/error`, `core/utils/result.dart` — a small hand-rolled `Result<T>` so repositories return
  failures as data (docs/05 §5.1), no external functional-programming dependency
- `core/theme`, `core/widgets` — design tokens + the empty/loading/error/sync-status widgets from
  docs/08 §8.6
- `features/auth` — full clean-architecture vertical slice: register, login, logout, session
  restore on cold start, wired to Riverpod (`AuthNotifier`)
- `features/onboarding` — category grid (loaded from the backend) → progressive profile form
  (Basics / Teaching details / Fees & availability, per docs/08 §8.5) via a `Stepper`; a fresh
  teacher registration is routed here explicitly before landing on the dashboard. Document
  upload for verification is deferred (needs the presigned-URL flow that ships with Notes)
- `features/students` — list (status/search filters), add (with an optional inline guardian,
  per spec §3), detail (edit/archive/add-guardian), and an invite-code dialog; wired into the
  Teacher dashboard's Students tab (`RoleDashboardScaffold.tabBuilders`)
- `features/classes` — list/create/edit, a schedule builder (weekday checkboxes generating an
  RFC 5545 rule, with the generated string editable directly for daily/monthly/custom cases),
  a live conflict-check panel, and a roster with enroll / waitlist-on-capacity. Deferred and
  documented in the file's own header comment: schedule-exceptions UI and full waitlist
  management (backend endpoints for both exist and are tested). Note: this feature's
  `presentation/providers` skips the usecase-wrapper layer the other features use — with 9
  near-identical operations, a wrapper class per action added files with no behavior; see that
  file's comment for the reasoning and when to add one back
- `features/attendance` — the Quick Attendance screen (docs/08 §8.3): roster defaults every
  student to Present, tap a chip to cycle Present→Absent→Late→Excused, Save bulk-marks. Reachable
  from a class's detail screen via "Take Attendance." Works offline: a failed Save queues via
  `core/sync` and optimistically merges the marks into the cached roster immediately. Deferred
  (documented in docs/07-roadmap.md's Phase 4 step 5 entry): a mobile history/percentage-view
  screen — the backend endpoint exists and is usable, no screen consumes it yet
- `features/dashboard` — one shared `RoleDashboardScaffold` (docs/08 §8.7 layout) + the four
  role-specific dashboard screens (Teacher/Student/Parent/Institute Admin), each with its
  docs/08 §8.1 bottom-nav tabs (Students is wired for Teacher; the rest still show "coming soon")
- `l10n/` — English + Hindi ARB files covering everything built so far (docs/05 §5.6)

Every other `features/*` folder is a stub `README.md` pointing at its roadmap step and doc
sections — see [docs/07-roadmap.md](../docs/07-roadmap.md).

## Local setup

```bash
flutter pub get
flutter gen-l10n              # generates lib/l10n/app_localizations.dart from the ARB files
flutter analyze               # run this first — see the caveat above
flutter test                  # unit + widget tests (test/)
```

Point the app at your local backend (see `../backend/README.md`) via `--dart-define`:

```bash
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000/api/v1   # Android emulator
flutter run --dart-define=API_BASE_URL=http://localhost:3000/api/v1  # iOS simulator
```

## Testing

```bash
flutter test                                            # unit + widget tests
flutter test integration_test/auth_flow_test.dart \
  --dart-define=API_BASE_URL=<your-backend-url>          # needs the real backend running
```
