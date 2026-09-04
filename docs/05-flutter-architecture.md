# 5. Flutter Architecture

## 5.1 Layering: Clean Architecture, feature-first

```
mobile/lib/
├── main.dart
├── app/
│   ├── app.dart                 # MaterialApp/CupertinoApp shell, theme, locale
│   ├── router.dart               # go_router config + role-based route guards
│   └── bootstrap.dart             # DI setup, env config, crash reporting init
├── core/
│   ├── network/                  # Dio client, interceptors (auth, retry, idempotency-key injection)
│   ├── storage/                   # local DB (Drift) setup, secure storage (tokens)
│   ├── sync/                      # offline queue engine — see §5.4
│   ├── error/                     # failure types, error-code → localized-message mapping
│   ├── theme/                     # design tokens, light/dark themes
│   ├── i18n/                      # ARB files, generated localizations
│   └── widgets/                   # shared dumb components (buttons, empty/error/loading states)
└── features/
    ├── auth/
    │   ├── data/                  # DTOs, repositories (impl), remote/local data sources
    │   ├── domain/                # entities, repository interfaces, use cases
    │   └── presentation/           # screens, widgets, Riverpod providers/notifiers
    ├── onboarding/
    ├── students/
    ├── classes/
    ├── attendance/
    ├── fees/
    ├── notes/
    ├── assignments/
    ├── communication/
    ├── calendar/
    ├── performance/
    ├── dashboard/
    ├── notifications/
    └── reports/
```

Each feature is internally layered `data → domain → presentation`, with **dependencies pointing inward** (presentation depends on domain interfaces, data implements them) — standard Clean Architecture, which is what makes attendance/fees testable without a real network or database, and lets `admin-web` reuse `domain` + `data` wholesale (docs/02 §2.8) while swapping only `presentation`.

## 5.2 State management: Riverpod

- `Notifier`/`AsyncNotifier` per feature for mutable state (e.g. `AttendanceMarkingNotifier`), `Provider`/`FutureProvider` for derived/read state.
- `Repository` interfaces injected via `Provider` overrides — swappable for fakes in widget tests without touching the notifier.
- Cross-feature state that many screens read (current user, active role, connectivity status, pending-sync count) lives in `core/` as global providers; feature-local state stays feature-local. This avoids the common Riverpod-app failure mode of one giant global provider graph that's hard to reason about.

## 5.3 Navigation & RBAC route guards

`go_router` with a top-level redirect that checks `authState` + `activeRole` on every navigation:

- Unauthenticated → `/login`.
- Authenticated, role-specific shells: `/teacher/...`, `/student/...`, `/parent/...`, `/admin/...` (bottom-nav shell per role, matching the spec's four separate dashboards).
- A route annotated with a required permission (mirroring the backend's `@RequirePermission`) redirects to a "not authorized" screen rather than rendering and failing on the API call — fail fast in the UI, not just the network layer.
- Deep links (e.g. a push notification opening a specific assignment) resolve through the same guard chain, so a parent tapping a fee-reminder notification can't accidentally land on a teacher-only screen even if the link is malformed or replayed.

## 5.4 Offline-first design

- **Local database**: Drift (SQLite) mirrors the subset of server data relevant to the signed-in user (their classes, students, recent attendance, pending fees) — not a full replica, to keep local storage bounded.
- **Read path**: screens read from Drift first (instant, works offline), with a background refresh from the API that updates Drift and lets the UI stream the update via Riverpod — so "view previously loaded data" (spec §17) falls out of the normal data flow rather than being a special offline mode.
- **Write path**: every mutating action (mark attendance, record payment) writes optimistically to a local `sync_queue` table (mirrors backend `sync_queue`, docs/03 §3.9) with a client-generated UUID and immediately updates local Drift state so the UI reflects it instantly. A background `SyncEngine` (runs on connectivity-restored events, via `connectivity_plus`, and periodically) drains the queue against the API using the same idempotency-key mechanism as docs/04 §4.2.
- **Sync status UI**: a persistent small indicator (not a blocking modal) shows `synced / syncing / N pending / conflict` — critical per docs/01 §1.5 ("clearly show sync status"). A `conflict` state (financial edits that can't auto-merge) surfaces a dedicated resolution screen listing the specific records, never silently drops data.
- **Conflict policy** mirrors the backend exactly (non-financial: last-write-wins + audit entry; financial: never auto-merged) — this policy is documented once (docs/01 §1.5) and implemented identically client- and server-side so behavior is predictable regardless of which side resolves first.

## 5.5 Responsive & platform-adaptive UI

- Material 3 as the base design system; `Cupertino`-styled variants for a small set of iOS-native-feeling interaction points explicitly called out in the spec (page transitions, action sheets, date/time pickers) via a thin adaptive-widget layer in `core/widgets/adaptive/`, rather than a second parallel UI.
- Layout built with `LayoutBuilder`/`Flexible`/breakpoint-aware widgets from the start, since the same `features/` presentation layer is reused by the Flutter-Web admin panel (docs/02 §2.8) at much wider viewports — retrofitting responsiveness later would touch every screen twice.

## 5.6 Internationalization

- `flutter_localizations` + ARB files (`lib/l10n/app_en.arb`, `app_hi.arb`); all user-facing strings routed through generated `AppLocalizations` — no hardcoded strings, enforced by a lint rule.
- Locale is a user preference (`users.preferred_language`, synced from backend), not device-locale-only — so a shared family device (parent + student) can differ from the OS locale.
- Numbers, currency, and dates formatted via `intl` using the locale, but **class/event times always render in the entity's stored timezone** (docs/03 §3.5), not reinterpreted in the viewer's locale-implied timezone — a subtle but important distinction (locale ≠ timezone).
- Architecture supports adding a language by dropping in one more ARB file + a teacher-category/metric-label translation table — no code changes to feature logic.

## 5.7 Testing strategy (maps to spec §23)

- **Unit tests**: domain use cases and data-layer mappers per feature — fee proration logic, attendance-percentage calculation, conflict-detection, idempotency-key generation are the highest-value targets given their edge-case density (docs/01 §1.5).
- **Widget tests**: critical screens in isolation with fake repositories — quick-attendance screen, fee-collection screen, login/registration forms (validation states, error states, empty states).
- **Integration tests** (`integration_test` package) for the explicitly-named critical workflows: registration/login, student creation, attendance submission (including offline → sync), payment recording (including idempotent retry), file upload (including a simulated failure/retry), notification delivery (via a mocked FCM handler).
- CI runs unit + widget tests on every PR; integration tests run on a nightly/pre-release pipeline against a real emulator/simulator, since they're slower and device-dependent.

## 5.8 Design system

A small `core/theme` token set (colors, spacing scale, type scale, elevation) consumed by a shared component library (`core/widgets`: buttons, list tiles, status chips for attendance/payment states, empty/loading/error state widgets, confirmation dialogs) — built once, reused across all four role-specific dashboards, so the "modern, clean, professional, minimal" requirement (spec §22) is enforced structurally rather than left to per-screen discipline.
