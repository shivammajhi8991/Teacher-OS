# 1. Product Analysis

## 1.1 Who actually uses this, and what breaks in their day today

The spec lists teacher categories as if they were one persona with different labels. They aren't — they differ on the axes that actually drive the data model: **is there a fixed curriculum, is billing per-session or per-period, is the "student" a minor with a paying parent, and does the relationship run through an institute or direct**. Grouping them that way surfaces the real requirements:

| Cluster | Examples | Defining traits | What they need most |
|---|---|---|---|
| **Curriculum-bound, institute-run** | School teacher, coaching institute teacher | Fixed batches, term-based fees usually collected by the institute (not the teacher), exams/marks | Attendance speed, marks entry, parent visibility, *no* fee-collection UI (institute admin owns billing) |
| **Independent, recurring-relationship** | Private tutor, music/dance/language teacher, freelance tutor | Teacher *is* the business — owns pricing, scheduling, collection | Fast fee collection & reminders, schedule/conflict management, own-brand receipts |
| **Session/attendance-driven, physical** | Sports coach, fitness trainer, yoga teacher | Group sessions, drop-in students common, capacity limits, physical safety/emergency info matters more | Capacity & waitlists, emergency contacts front-and-center, session-based (not monthly) fees, weather/venue cancellation |
| **Skill-progression, less rigid schedule** | Art teacher, tech trainer, online teacher | Project/portfolio-based output, async content heavy, timezone-spanning students | Rich note/assignment sharing, async feedback, timezone-aware scheduling |

This matters architecturally: **fee models, performance metrics, and even who can mark attendance must be configurable per teacher category, not hard-coded per feature.** Section 1.4 and `docs/03` reflect this with a `teacher_category` → `fee_model_config` / `performance_metric_config` pattern instead of per-category tables.

## 1.2 Real operational problems this must solve (not just digitize)

These are the actual pains a teacher/institute has *before* any software, which a "digital register" doesn't fix:

1. **"Did I get paid?" is a memory problem, not a data-entry problem.** Teachers don't forget fees exist; they forget to *check*. The system must push (reminders, dashboard red flags), not just store.
2. **Attendance and fees are coupled, but not 1:1.** A student who missed 3 classes may still owe full fee (monthly model) or a prorated amount (per-class model) or nothing (fee is flat regardless). This must be a *policy* per class/fee-structure, not an assumption baked into attendance logic. See §1.5 edge cases.
3. **A "class" is not always a fixed roster.** Drop-in gym sessions, trial classes, one-off workshops — the same calendar slot can have a different student list every time it recurs. Rigid "batch has students, batch has schedule" modeling breaks here; enrollment must be scoped to a date range or session, not just the batch.
4. **Parents want less, not more.** A parent app that pushes every attendance mark is noise; what they want is *exceptions* (absence, low attendance, fee overdue) and a weekly/monthly digest. Over-notifying causes them to mute the app entirely, defeating the point.
5. **Teachers are not technical.** Every workflow the spec calls out (quick attendance, fee collection) must be reachable in ≤3 taps from the dashboard. This is a UX constraint that should gate feature design, not an afterthought (see `docs/05` navigation design and §1.6).
6. **Trust and verification matter for discovery-adjacent features.** Once parents/students can find or be assigned to a teacher (institute onboarding, future marketplace), fabricated qualifications or unverifiable identity is a real risk — hence "Verification status" in the spec is not cosmetic; it needs an actual admin-reviewed verification workflow (`docs/03` `verification_requests` table), not a self-reported boolean.

## 1.3 Missing features identified (added beyond the original spec, with justification)

| Feature | Why it's needed |
|---|---|
| **Waitlist for full batches** | Spec requires "maximum student capacity" but doesn't say what happens when it's hit. Real teachers get asked "can you fit one more?" constantly. Without a waitlist, capacity enforcement just causes lost leads. |
| **Trial class / drop-in session type** | Nearly every category in §1.1 offers a free/paid trial before committing. Needs to exist as a first-class session type that doesn't require full enrollment, batch assignment, or fee-cycle setup. |
| **Institute → Teacher revenue split / commission** | Section 4 (Institute/Admin) implies institutes manage teachers, but never addresses how institute-collected fees are split with teachers. Any coaching institute deployment needs this on day one or the fee module is unusable for them. |
| **Multi-tenant hierarchy (Institute → Branch → Teacher)** | Coaching chains commonly have multiple physical branches under one admin. Flat institute→teacher modeling breaks reporting and RBAC scoping for them. |
| **Idempotency keys on all write APIs that touch money or attendance** | The spec explicitly calls out "duplicate payment," "duplicate attendance," "payment succeeds but API confirmation fails" as edge cases — the only correct general fix is idempotency keys + at-least-once-safe client retry, not per-case hacks. See `docs/04`. |
| **Offline conflict-resolution policy, stated explicitly** | Spec requires offline attendance/records with sync, but "handle conflicts safely" is not a policy. We define one: last-write-wins for non-financial edits with an audit trail entry for the overwritten value, but **financial records are never resolved client-side** — conflicting offline payment entries are queued for teacher review, never auto-merged. See §1.5 and `docs/03` `sync_queue`. |
| **Notification digesting / smart batching** | Prevents the "over-notifying parents" failure mode in §1.2 point 4. Configurable per user: real-time for critical (cancellation, payment confirmation) vs. daily/weekly digest for informational. |
| **GST/tax-compliant invoice fields (India-first, extensible)** | Hindi is an initial language target, implying an India-first market where teachers/institutes may be required to issue GST-compliant receipts. Modeled as optional invoice fields (GSTIN, HSN/SAC) rather than mandatory, so it doesn't burden markets that don't need it. |
| **Consent & minor-data handling** | Most students are minors. Parent-linked consent for data sharing (e.g., photo/video in notes, performance data visibility) needs an explicit flag, not just "parent can view child's data." |
| **Data export / account deletion request flow** | Any real production app handling minors' data needs a user-initiated data export and deletion request, even if execution is manual/admin-mediated at first. Absence of this is a compliance gap, not a nice-to-have. |
| **Teacher-initiated student merge (duplicate resolution)** | Spec lists "duplicate student records" as an edge case but doesn't give a resolution path. We add an explicit merge workflow that reassigns attendance/fee/note history to the surviving record and audit-logs the merge. |
| **Standalone "Session" entity distinct from recurring "Class"** | Needed to cleanly support makeup classes, extra classes, and trial sessions without distorting the recurring schedule model. See `docs/03`. |

## 1.4 Configurable performance metrics (per §11 of the spec)

Rather than hard-coding metric fields per teacher category (which the spec explicitly asks to avoid — "system should support custom performance parameters"), performance tracking is modeled as:

- `performance_metric_definitions`: teacher (or institute) defines named metrics with a type (`numeric`, `scale_1_5`, `pass_fail`, `text`, `percentage`) and applicability (subject/class-level or student-level).
- `performance_records`: a value against a definition, a student, a date, and an optional linked class/session.

This gives academic teachers "marks/grade," sports coaches "40m sprint time," music teachers "scale mastery level" — all through the same two tables, with category-specific *default templates* seeded at teacher-category setup (not hard-coded logic).

## 1.5 Edge cases — resolution policy (not just enumeration)

The spec lists edge cases; a list without a stated resolution isn't a design. Key policies:

- **Attendance vs. fee coupling**: each `fee_structure` has an explicit `proration_policy` (`none`, `per_class_deduction`, `manual_adjustment_only`). Attendance edits after fee calculation never silently change an already-generated invoice — they raise a flagged "fee recalculation suggested" note for teacher action. Invoices are immutable once issued; corrections happen via credit notes, never in-place edits (see `docs/03`).
- **Student leaving mid-month / rejoining**: students are never hard-deleted. `student_enrollment_status` transitions (`active` → `inactive`/`left` → `active` again) with dated status-change history, so historical attendance/fee/notes remain attributable to the correct enrollment period even across a gap.
- **Student changes batch**: enrollment is a separate row from student and from class, scoped by date range (`enrolled_from`/`enrolled_to`), so a batch change is a new enrollment row, not an update — old attendance stays correctly attributed to the old batch.
- **Multiple teachers per student, multiple parents per student, multiple children per parent**: all modeled as many-to-many join tables (`student_teacher_assignments`, `student_guardian_links`) from day one — never a single FK — because retrofitting this later means a painful migration.
- **Teacher reschedules a recurring class**: schedule changes are versioned (`class_schedule_versions`) with an effective-from date; past occurrences keep referencing the schedule version that was active when they happened, so historical calendar views stay accurate.
- **Duplicate attendance/payment submission**: client sends an idempotency key derived from (user, action, target, client-generated UUID); server treats a repeat as a no-op returning the original result, not a second row.
- **Payment succeeds at gateway but app never gets confirmation**: payment gateway webhook is the source of truth, not the client response — the client-recorded "pending" payment is reconciled asynchronously by the webhook handler, never left stuck by a dropped client connection.
- **Timezone changes**: all timestamps stored in UTC; class schedules store an explicit IANA timezone (defaults to teacher's, not device's) so a traveling student/teacher sees consistent class times rather than a shifted grid.

## 1.6 UX principle driving everything downstream

Two named workflows in the spec — **Quick Attendance** and **Fee Collection** — are the products, not features of the product. Every architectural decision in `docs/02`–`docs/05` is checked against: *does this keep those two flows at ≤3 taps from the dashboard, even offline, even for a non-technical teacher?* Where a "correct" design (e.g., full audit-trail confirmation dialogs) would slow that flow down, the resolution is to make the safe behavior the default and the friction invisible (e.g., auto-generated idempotency keys, background sync) rather than trading away speed for correctness.
