# TeacherOS Mobile

Flutter app — see [../docs/05-flutter-architecture.md](../docs/05-flutter-architecture.md) for the
full design rationale and [../docs/08-ux-flows.md](../docs/08-ux-flows.md) for the screen
inventory and flows this scaffold implements.

> **This scaffold was authored without a Flutter SDK available in the dev environment it was
> built in.** Every file was hand-written to the conventions in docs/05, and imports/paths were
> checked by hand, but `flutter pub get` / `flutter analyze` / `flutter test` have **not** been run
> against it yet. Run all three as your first step before building on top of it.

## Implemented so far (docs/07 Phase 4 — complete, all 8 steps — plus Phase 5 steps 1–6)

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
  restore on cold start, wired to Riverpod (`AuthNotifier`). `AppUser` gained `instituteId`
  (Phase 5 step 4) — `GET /auth/me`'s response always carried each role's own `instituteId`, but
  `MeResponseDto`/`AppUser` only ever kept `activeRole`; the Teachers roster and the
  institute-wide announcement compose action both need it without a separate round trip
- `features/onboarding` — category grid (loaded from the backend) → progressive profile form
  (Basics / Teaching details / Fees & availability, per docs/08 §8.5) via a `Stepper`; a fresh
  teacher registration is routed here explicitly before landing on the dashboard. Document
  upload for verification is still deferred here — the presigned-URL flow it needs now exists
  on the backend (it shipped with Notes, step 7 below), this screen just doesn't call it yet
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
  `core/sync` and optimistically merges the marks into the cached roster immediately.
  `getStudentAttendanceHistory` (Phase 5 step 3) finally picks up docs/07-roadmap.md's Phase 4
  step 5 deferred item — a mobile history/percentage-view screen, the backend endpoint existed
  and was usable well before any screen consumed it; `ChildAttendanceScreen`
  (`features/parent`) is that first consumer
- `features/fees` — the Fee Collection flow (docs/08 §8.4), added as a **Fees section on the
  existing Student Detail screen** rather than a separate screen or tab, matching how the spec
  actually describes the flow ("Teacher opens student → sees pending amount → records payment →
  receipt"). `RecordPaymentDialog` pre-fills the pending amount and offers Cash/UPI/Bank Transfer
  as single-tap chips. Deferred, documented in docs/07-roadmap.md's Phase 4 step 6 entry:
  fee-structure/discount/invoice-generation management UI, gateway payment UI, refund UI, and
  the institute revenue-summary UI — the Teacher dashboard's Fees *tab* still shows "coming soon"
  for this reason (an aggregate fee-overview screen wasn't built this pass; fee collection today
  happens per-student via the Fees section)
- `features/notes` — a **Notes section on the existing Class Detail screen**, scoped to
  **link-type notes only** (documented in docs/07-roadmap.md's Phase 4 step 7 entry): a real
  file-upload/download UI needs `file_picker` and a way to open/preview a file on-device,
  neither pulled into this pass as a new pubspec dependency. "Add link" creates a `link`
  document tagged `folderName = classId` and shares it with the class in one dialog (title +
  URL, ≤3 taps); the section lists it back by filtering `GET /documents` client-side on that
  same tag — a listing convenience only, not the access-control boundary (that's still the
  `document_shares` row the same call creates). A link is copy-to-clipboard, not tap-to-open (no
  `url_launcher` dependency yet)
- `features/notifications` — a Notification Center (list, mark-one/mark-all read) and a
  Preferences screen (per-category channel picker — push/daily digest/weekly digest/off; 'email'
  is deliberately not offered, since nothing sends it yet). Reached from the app bar bell icon on
  every dashboard (`role_dashboard_scaffold.dart`'s previously-stubbed `onPressed: () {}`, now
  wired, with an unread-count badge), and Preferences is reached from the Notification Center's
  own app bar — not from a Profile/Settings tab, since none of the four dashboards' Profile/
  Settings tabs have a real screen behind them yet (all still "coming soon"). The Dashboard tab's
  "Recent activity" card (docs/08 §8.7's own layout diagram: "last 5, 'see all' → notif center")
  was a static placeholder and is now wired to the same data. Deferred, documented in
  `notifications_repository.dart`'s header comment: real FCM device-token registration — it
  needs `firebase_messaging`/`firebase_core` and real platform config (google-services.json,
  APNs keys) neither addable nor verifiable in this environment, so `POST /device-tokens` exists
  and works, nothing on mobile calls it yet
- `features/assignments` — docs/07-roadmap.md's Phase 5 step 1. Teacher side: an **Assignments
  section on the existing Class Detail screen** (matching the Fees/Notes precedent) — "New"
  creates a class-targeted assignment (title/description/due date/late+resubmission toggles, no
  attachment picker — documented deviation, same reasoning as Notes' link-only scope), tapping
  one opens `AssignmentReviewScreen` (per-submission grade/feedback dialog, with a best-effort
  student-name lookup reusing the Students feature's own list provider). Student side: the
  Student dashboard's Assignments tab — previously stubbed with no builder, same as every other
  non-Dashboard tab — is now wired to `StudentAssignmentsScreen`, and tapping an assignment opens
  `AssignmentSubmitScreen` (shows description/attachments/due date, lets the student submit or
  resubmit one external link — again link-only rather than a real upload — and shows grade/
  feedback once reviewed). Individual-student-targeted assignments have no mobile creation UI
  (class-targeting only); the backend supports both
- `features/performance` — docs/07-roadmap.md's Phase 5 step 2. A **Performance section on the
  existing Student Detail screen** (matching the Fees precedent), teacher-only: "Record" opens a
  dialog whose metric dropdown is populated straight from `GET /performance-metric-definitions`
  (whatever's actually applicable to this teacher — their own metrics, their institute's
  defaults, their category's defaults — no client-side per-category logic), plus a single value
  field for every metric type (server-side validation is the real source of truth for what's
  valid, surfaced back as an inline error). The read-only history list shows what's been
  recorded. A parent/student-facing read view is docs/08 §8.2's own separate "Performance |
  Metric history for the child" item, picked up by `features/parent` below
- `features/parent` — docs/07-roadmap.md's Phase 5 step 3. `linkedChildrenProvider` calls the
  exact same `GET /students` use case the Teacher dashboard's Students tab already uses — the
  backend, not the client, decides what "the student list" means for the caller's role, so no
  parent-specific data-layer code was needed there. A real **child switcher** (docs/08 §8.1: "if
  >1 child") renders as the dashboard's AppBar `bottom` — `RoleDashboardScaffold` gained that
  slot plus an optional `dashboardExtra` section for this step, both backward-compatible (every
  other role passes neither). The Dashboard tab's summary tiles are computed live for whichever
  child is selected (attendance %, fee status, a performance-records count — "Upcoming classes"
  stays static, no calendar module yet); two detail screens (`ChildAttendanceScreen`,
  `ChildPerformanceScreen`) are reachable from a small "view history" card. The Fees tab
  (`ParentFeesTab`) is read-only by design — docs/06 §6.2 gives Parent no write access to
  payments, so there's no "Record payment" button here unlike the Teacher-facing Fees section.
  Its Announcements tab is now wired too (see `features/announcements` below); Profile stays
  "coming soon" (generic, not part of any step yet)
- `features/announcements` — docs/07-roadmap.md's Phase 5 step 4. One shared
  `AnnouncementsListScreen`, reached differently per role exactly as docs/08 §8.2 specifies for
  each: Parent's own dashboard tab (was "coming soon"), Student's from the Notification center
  (a new campaign-icon action there, next to Preferences), and Institute Admin's dashboard quick
  action (a card linking into the same screen with `composeTargetType: 'institute'`, since only
  Institute Admin gets a compose FAB in this pass). Teacher holds `announcement.manage` on the
  backend but has no docs/08-listed screen for it — a documented scope cut, not an oversight; the
  doc's own screen inventory only lists Announcements for Student/Parent/Institute Admin
- `features/institutes` — docs/07-roadmap.md's Phase 5 step 4. `TeacherRosterScreen` (Institute
  Admin's Teachers tab): roster list + an invite-code dialog mirroring `StudentListScreen`'s own
  (generate a code, show it once, no in-app delivery). Payout-config *editing* has no mobile
  surface yet — the roster still shows a teacher's configured `payoutPercent`, read-only; setting
  it is a documented scope cut matching Branches' own precedent (real on the backend, no CRUD UI
  this pass)
- `features/reports` — docs/07-roadmap.md's Phase 5 step 5. One `ReportsScreen` shared by Teacher
  and Institute Admin (docs/08 §8.2's two "Reports" entries — the backend already resolves "own
  scope" vs. "institute scope" server-side, so the form is identical either way): report type
  (Attendance/Fees/Student), a CSV/PDF picker for the first two, date-range pickers, one
  "Generate" button. No JSON DTO layer here (unlike every other feature) — the backend responds
  with the file itself, so the repository reads raw bytes off the Dio response directly, and
  requesting with `ResponseType.bytes` means an *error* response also arrives as bytes rather
  than the usual JSON envelope — `ReportsRepositoryImpl` decodes that case itself rather than
  teaching the shared `mapDioExceptionToFailure` about a response type only this feature uses. A
  generated CSV renders inline as scrollable, selectable text (no need to save/open anything for
  it); a PDF is saved to the app's own documents directory via `path_provider` (already a
  dependency, added earlier for Drift) and the screen reports where — no PDF viewer/opener
  dependency exists yet, the same "no new pubspec dependency" reasoning behind Notes' link-only
  scope. The async `export-jobs` path (docs/04 §4.7) has no mobile UI this pass — a documented
  scope cut; the direct endpoints already cover this app's real scale
- `features/calendar` — docs/07-roadmap.md's Phase 5 step 6. One shared `CalendarScreen` — docs/08
  §8.2 didn't actually list a Calendar screen for any role before this step, so it was added
  there first (worded identically, "Dashboard quick action," for all four roles). A week at a
  time (Prev/Next navigation), events grouped by day with an icon per `eventType` and a red
  "Conflict" chip on any flagged `class_occurrence`; `GET /calendar` scopes to the caller
  automatically so this sends only a date range, never an owner filter. Wired as a
  `CalendarQuickActionCard` on the Teacher/Student dashboards' (previously empty)
  `dashboardExtra` slot, a third `ListTile` in Parent's existing `_DetailLinks` card (the
  parent-role calendar aggregates every linked child, not just whichever one is selected in the
  switcher, so this link needs no child id), and a second card alongside Institute Admin's
  existing Announcements quick action. No calendar-grid/month-view UI this pass — a day-grouped
  week list is the honest scope, matching how other "history" screens here (Attendance history,
  Notification center) are lists, not custom canvas widgets
- `features/dashboard` — one shared `RoleDashboardScaffold` (docs/08 §8.7 layout) + the four
  role-specific dashboard screens (Teacher/Student/Parent/Institute Admin), each with its
  docs/08 §8.1 bottom-nav tabs (Students is wired for Teacher, Assignments for Student, Teachers
  and Reports for Institute Admin; the Teacher shell's "More" tab got its first real entry this
  step too — a small `MoreMenuScreen` with one item, Reports; the rest still show "coming soon")
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
