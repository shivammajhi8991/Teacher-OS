# 3. Database Schema (PostgreSQL)

## 3.1 Conventions used throughout

- **Primary keys**: `uuid` (`gen_random_uuid()`), never auto-increment ints — avoids leaking record counts, and merges cleanly across offline-generated client records (see §3.9).
- **Soft delete**: `deleted_at timestamptz null` on every table with historical/financial significance. Nothing user-facing is ever hard-deleted; "delete" in the UI sets `deleted_at` and the record drops out of default queries but stays for audit/reporting.
- **Audit columns**: `created_at`, `updated_at` (both `timestamptz`, default `now()`, `updated_at` maintained by trigger), `created_by`, `updated_by` (FK → `users.id`).
- **Tenancy**: `institute_id uuid null` (FK → `institutes.id`) on every tenant-scoped table; `null` = independent teacher. Enforced additionally by Postgres RLS policy `institute_id = current_setting('app.current_institute_id')::uuid OR institute_id IS NULL AND owner check`.
- **Money**: `numeric(12,2)`, always with an explicit `currency char(3)` (ISO 4217) column — never a float, never an assumed currency.
- Table names below are illustrative column sets, not exhaustive DDL — full migration files are generated at Phase 4.

## 3.2 Identity, roles, institutes

```
users
  id, email, phone, password_hash, full_name, avatar_url,
  preferred_language ('en'|'hi'|...), timezone,
  status ('active'|'suspended'|'pending_verification'),
  last_login_at, created_at, updated_at, deleted_at

roles                      -- 'teacher' | 'student' | 'parent' | 'institute_admin' | 'super_admin'
user_roles                 -- (user_id, role_id, institute_id nullable) — a user CAN hold multiple roles
                            -- e.g. an institute owner who also teaches; a parent who is also a tutor

permissions                -- fine-grained: 'attendance.mark', 'fee.record_payment', 'student.delete', ...
role_permissions           -- (role_id, permission_id) — see docs/06 for full matrix

institutes
  id, name, logo_url, address, contact_email, contact_phone,
  subscription_plan_id (FK → subscription_plans, nullable at launch), status, created_at...

branches
  id, institute_id, name, address, timezone, deleted_at
  -- implemented: added deleted_at (docs/07 Phase 5 step 4) — missing from the original Phase 4
  -- step 1 entity, added alongside its first real use (InstitutesService.archiveBranch), matching
  -- this schema's never-hard-delete convention everywhere else.

teacher_institute_invites   -- addition beyond this doc's original sketch (docs/07 Phase 5 step 4)
  id, institute_id, code unique, created_by, expires_at, redeemed_at nullable,
  redeemed_by_teacher_profile_id nullable, created_at
  -- mirrors student_invites' shape (§3.4) — a short-lived code a teacher (who has already
  -- completed onboarding, §3.3) redeems to join an institute. Rejects outright if that teacher
  -- profile is already affiliated with a (possibly different) institute — a transfer flow is a
  -- documented scope cut, not built.

verification_requests      -- teacher-submitted qualification/ID docs for admin review
  id, teacher_profile_id, document_urls[], status ('pending'|'approved'|'rejected'),
  reviewed_by, reviewed_at, rejection_reason
```

## 3.3 Teacher profile & category system

```
teacher_categories          -- seed data: academic, home_tutor, sports_coach, music, dance,
  id, name, slug, icon,      -- fitness, yoga, art, language, tech_trainer, other — NEW categories
  default_performance_template_id,   -- addable via this table alone, no code change
  default_fee_model
  is_active

teacher_profiles
  id, user_id, institute_id (nullable), teacher_category_id,
  headline, bio, experience_years, qualifications (jsonb array),
  service_area, teaching_mode ('online'|'offline'|'both'),
  subjects_or_skills (jsonb array of {name, level}),
  class_duration_minutes_default, fee_structure_default_id,
  verification_status ('unverified'|'pending'|'verified'), rating_avg, rating_count,
  payout_percent nullable
  -- implemented (docs/07 Phase 5 step 4): payout_percent answers this doc's own §3.7 note that
  -- institute_teacher_payouts "needs a payout-percent config that doesn't exist on any entity
  -- yet." Null means no institute-collected-fees revenue-split arrangement — an independent
  -- teacher, or an institute that hasn't configured one for that teacher.
```

`teacher_categories` being data, not an enum baked into code, is the mechanism satisfying the spec's "add new categories without major code changes."

## 3.4 Students, guardians, many-to-many links

```
student_profiles
  id, user_id (nullable — a student under 13 may have no login, parent manages),
  institute_id, full_name, dob, gender, avatar_url,
  emergency_contact_name, emergency_contact_phone, medical_notes,
  join_date, enrollment_status ('active'|'inactive'|'left'|'archived'),
  status_changed_at, source ('manual'|'invite_link'|'import'), created_at...

guardians
  id, user_id, full_name, phone, email, relationship
  -- implemented (Phase 5 step 3): user_id starts null when a teacher adds a guardian by contact
  -- details alone, and gets linked automatically the moment someone registers a `parent`-role
  -- account with that same email/phone (AuthService.register) — never the reverse direction, so
  -- adding a guardian can't retroactively grant an existing account access it wasn't meant to
  -- have. guardian.entity.ts's own header comment already named this as a future step, but
  -- nothing implemented it until this pass — every guardian-linked read access built into
  -- Fees/Attendance/Notes/Performance/Students since Phase 4 had nothing to actually match
  -- against before this.

student_guardian_links       -- many-to-many: multiple guardians per student, one guardian → many children
  id, student_id, guardian_id, is_primary, consent_data_sharing boolean, consent_recorded_at

student_teacher_assignments  -- many-to-many: a student can have multiple teachers concurrently
  id, student_id, teacher_profile_id, subject_or_skill, assigned_from, assigned_to (nullable = ongoing)

student_merge_log            -- resolves "duplicate student records" (see docs/01 §1.3)
  id, surviving_student_id, merged_student_id, merged_by, merged_at, reason
```

## 3.5 Classes, batches, schedules — versioned

```
classes                      -- a "batch"/course/group or 1:1 arrangement
  id, institute_id, teacher_profile_id, name, subject_or_activity,
  class_type ('recurring'|'one_time'|'trial'),
  mode ('online'|'offline'), location_or_meeting_link,
  capacity_max, start_date, end_date (nullable = ongoing), status ('active'|'completed'|'cancelled')

class_schedule_versions      -- effective-dated: a reschedule creates a new version, never edits history
  id, class_id, effective_from, effective_to (nullable),
  recurrence_rule (RFC 5545 RRULE string — handles daily/weekly/specific-days/custom),
  start_time, end_time, timezone

schedule_exceptions          -- single-occurrence overrides layered on top of the recurrence rule
  id, class_id, occurrence_date, exception_type
    ('holiday'|'cancelled'|'rescheduled'|'makeup'|'teacher_absent'|'extra_class'),
  new_date, new_start_time, new_end_time, reason, created_by

enrollments                  -- date-ranged: batch change = new row, never an update to class_id
  id, student_id, class_id, enrolled_from, enrolled_to (nullable = current),
  status ('active'|'waitlisted'|'trial'|'ended')

waitlist_entries
  id, class_id, student_id, requested_at, notified_at, converted_to_enrollment_id
```

**Conflict detection** (teacher double-booked, student overlapping classes, room double-booked) is computed at write-time by materializing each `class_schedule_versions` row against its `recurrence_rule` for the relevant date window and checking time-range overlap against other schedules sharing the same `teacher_profile_id` / `student_id` (via active enrollments) / `location_or_meeting_link`. Flagged as a warning, not a hard block — a teacher may deliberately double-book a short overlap (e.g., back-to-back with grace period), so the UI surfaces it rather than silently refusing.

## 3.6 Attendance — with full audit trail

```
attendance_sessions          -- one row per (class, occurrence_date) — the "roll call" instance
  id, class_id, occurrence_date, status ('scheduled'|'held'|'cancelled'),
  marked_by, marked_at, marking_method ('manual'|'qr'|'location'|'bulk')

attendance_records
  id, attendance_session_id, student_id,
  status ('present'|'absent'|'late'|'excused'|'holiday'|'cancelled'),
  marked_at, marked_by, notes, invoiced (bool, reserved for the Fees module)
  UNIQUE (attendance_session_id, student_id)   -- see below

attendance_audit_log          -- append-only: every edit to an attendance_record after initial mark
  id, attendance_record_id, previous_status, new_status, changed_by, changed_at, reason
```

**Revised during implementation:** dropped the standalone `idempotency_key` column originally sketched above in favor of the `UNIQUE(attendance_session_id, student_id)` constraint plus upsert semantics in the service layer — re-submitting the same bulk-mark call is a no-op if nothing changed, and a genuine correction updates in place while writing `attendance_audit_log`. One mechanism now covers both "safe retry" (docs/01 §1.5 "duplicate attendance submission") and "edit with audit trail," instead of two overlapping ones. This is also what makes a queued *offline* bulk-mark call (docs/05 §5.4) safely replayable without a separate `Idempotency-Key` header (docs/04 §4.2).

An `attendance_record` is only ever *updated* in place for same-day corrections before any dependent invoice references it; once referenced by an issued invoice line (`invoice_line_items.source_attendance_id`), further changes only write to `attendance_audit_log` and surface a "recalculation suggested" flag rather than mutating billed history (per docs/01 §1.5).

## 3.7 Fees, invoices, payments — immutable ledger

```
fee_structures
  id, institute_id nullable, teacher_profile_id nullable, class_id nullable,
  billing_model ('monthly'|'per_class'|'course'|'hourly'|'custom'|'one_time_registration'),
  amount, currency, proration_policy ('none'|'per_class_deduction'|'manual_adjustment_only'),
  late_fee_rule (jsonb: {grace_days, flat_or_percent, amount})

discounts                    -- scholarships/concessions, per-student or per-class
  id, student_id nullable, class_id nullable, type ('flat'|'percent'), value, reason, approved_by

invoices                     -- IMMUTABLE once issued
  id, student_id, institute_id nullable, teacher_profile_id,
  billing_period_start, billing_period_end, subtotal, discount_total, late_fee_total, tax_total,
  total_amount, currency, status ('issued'|'paid'|'partial'|'overdue'|'void'),
  gstin nullable, hsn_sac_code nullable,     -- optional India tax-compliance fields, docs/01 §1.3
  issued_at, due_date

  -- Revised during implementation: dropped the 'draft' status. Generation issues an invoice
  -- directly (invoices.service.ts) rather than staging one first — a draft-review workflow
  -- before issuing is a documented follow-up if a real need for it shows up, not built now.

invoice_line_items
  id, invoice_id, description, amount, source_attendance_id nullable, source_class_id nullable

credit_notes                 -- the ONLY mechanism to correct an issued invoice — never edit in place
  id, invoice_id, amount, reason, issued_by, issued_at

payments
  id, invoice_id, student_id, amount, currency, method ('cash'|'upi'|'bank_transfer'|'gateway'),
  status ('pending'|'confirmed'|'failed'|'refunded'),
  gateway_reference nullable, idempotency_key unique,
  recorded_by (teacher, for offline cash/UPI), recorded_at,
  confirmed_via ('webhook'|'manual') -- gateway payments only confirmed by webhook, not client response

payment_audit_log            -- every status transition, every manual correction
  id, payment_id, previous_status, new_status, changed_by, changed_at, note

refunds
  id, payment_id, amount, reason, status ('pending'|'processed'|'rejected'), processed_by, processed_at

institute_teacher_payouts    -- revenue-split for institute-collected fees (docs/01 §1.3)
  id, institute_id, teacher_profile_id, invoice_id, payment_id unique, payout_percent,
  payout_amount, status ('pending'|'paid'), paid_at, created_at
  -- implemented (docs/07 Phase 5 step 4), closing this doc's own previously-flagged gap now that
  -- teacher_profiles.payout_percent (§3.3) exists. One row per CONFIRMED payment, not per
  -- invoice — payment_id (unique), an addition beyond this doc's original sketch, so a
  -- partially-paid invoice generates a proportional payout as each payment lands rather than
  -- double-counting or waiting for full payment, and a retried gateway webhook can never
  -- generate a duplicate payout for the same payment. Generated inside FeesService at the moment
  -- a payment is confirmed (it already has payment/invoice/teacherProfile loaded there) rather
  -- than via a new Fees→Institutes service dependency.

student_credit_ledger_entries  -- an addition beyond this doc's original sketch, see below
  id, student_id, amount, source_payment_id nullable, source_invoice_id nullable, note, created_at
```

Overpayment resolves as a credit balance on the student's account rather than an error state — matches real cash-collection behavior where a parent hands over a round number. **Implemented as an append-only ledger** (`student_credit_ledger_entries`, balance = SUM(amount) for a student) rather than a single mutable `student_credit_balance` column — this doc originally described the concept without naming a table; the ledger form matches this schema's audit-everywhere convention (every credit grant and every consumption is its own dated, attributable row) instead of a value that could silently drift. A credit is granted when a payment overpays its invoice and auto-consumed (as a negative entry) the next time an invoice is generated for that student, up to what's available.

## 3.8 Notes, assignments, communication, calendar

```
documents  -- implemented: folder_name (plain string tag) instead of folder_id (a full folders
             -- table with hierarchy) — spec §7's "categories/folders" reads as a light
             -- organizational aid, not nested folders, so a string is the honest amount of
             -- structure for this pass; promoting it to a real Folder entity later is additive.
  id, institute_id, uploaded_by, title, file_url, file_type, folder_name nullable,
  expiry_date nullable, version, previous_version_id nullable

document_shares
  id, document_id, shared_with_type ('student'|'class'|'institute'), shared_with_id,
  allow_download boolean, shared_at

document_access_log          -- "file access tracking where possible" from spec
  id, document_id, accessed_by, accessed_at, action ('view'|'download')
  -- implemented: every access currently logs as 'download' — no separate "view" endpoint exists
  -- yet (GET /documents/:id/file is the only content-access route), a documented simplification.

assignments
  id, class_id nullable, student_id nullable, teacher_profile_id, title, description,
  attachment_urls[], due_at, allow_late_submission, allow_resubmission
  -- implemented: exactly one of class_id/student_id is enforced in AssignmentsService (never
  -- both, never neither). attachment_urls[] holds a mix of this app's own storage object keys
  -- and external URLs with no per-entry type discriminator — see assignment.entity.ts.

assignment_submissions
  id, assignment_id, student_id, attachment_urls[], submitted_at, is_late,
  attempt_number, status ('submitted'|'reviewed'), grade, feedback, reviewed_by, reviewed_at
  -- implemented: no unique constraint on (assignment_id, student_id) — a resubmission (when
  -- allowed) is a new row with attempt_number incremented, never an overwrite of the prior
  -- attempt, matching this schema's audit-everywhere convention.

announcements
  id, institute_id nullable, created_by, target_type ('class'|'institute'|'platform'),
  target_id nullable, title, body, created_at
  -- implemented (docs/07 Phase 5 step 4) with two deviations from this doc's original sketch:
  -- (1) created_by (a plain User) replaces teacher_profile_id — an institute_admin or super_admin
  -- author has no teacher_profile at all, so a column only ever populated for one of three
  -- sender types wasn't earning its keep; a teacher's own profile is still resolvable from
  -- created_by via TeacherProfilesService when needed. (2) 'platform' replaces the sketched
  -- 'individual' target type — neither this doc nor docs/06's permission matrix ever specified
  -- who could send an 'individual' announcement or why, while docs/06 §6.2 names super_admin's
  -- grant as "platform-wide" with nowhere for that to point; target_id is unused for 'platform'.
  -- target_id is otherwise polymorphic (a Class id for 'class', an Institute id for
  -- 'institute') — the same "resolved in code" shape document_shares.shared_with_id already uses.

notifications                -- generated events, fanned out per user via notification_preferences
  id, user_id, type, title, body, data (jsonb), read_at, created_at, delivery_channel
  -- implemented: added delivered_at (nullable) beyond this sketch — digest batching needs to
  -- know "already folded into a sent digest push" separately from read_at (a push can be
  -- delivered and never opened).

notification_preferences
  id, user_id, category, channel ('push'|'email'|'digest_daily'|'digest_weekly'|'off')
  -- implemented: 'email' is accepted (matches this doc) but not actually delivered — no mail
  -- adapter exists yet, see notification.entity.ts. `category` is a small, fixed, code-defined
  -- enum (payment/fee/note/general so far), not an admin-extensible table like
  -- teacher_categories — see notification-preference.entity.ts.

device_push_tokens            -- addition beyond this doc's sketch: this table doesn't appear
                               -- above, but real push delivery needs *something* to hold a
                               -- device's FCM registration token. id, user_id, token (globally
                               -- unique), platform ('ios'|'android'|'web'), created_at,
                               -- last_seen_at — see device-push-token.entity.ts.

performance_metric_definitions   -- docs/01 §1.4
  id, teacher_category_id nullable, teacher_profile_id nullable,
  name, metric_type ('numeric'|'scale_1_5'|'pass_fail'|'text'|'percentage'), unit
  -- implemented: added institute_id (nullable) beyond this sketch — docs/06 §6.2 names
  -- "institute defaults" as a thing institute_admin can define, but this table had nowhere to
  -- attach one. Exactly one of teacher_category_id/institute_id/teacher_profile_id is set,
  -- enforced in PerformanceService. teacher_categories.default_performance_template_id (a
  -- reserved hint column since Phase 4 step 1) stays unused — a category's "default template"
  -- turned out to mean "however many teacher_category_id-scoped rows exist" (plural), not one
  -- template id pointing at a single row.

performance_records
  id, student_id, metric_definition_id, class_id nullable, value, recorded_at, recorded_by
  -- implemented: `value` is validated against its definition's metric_type at write time
  -- (a numeric string, "1".."5", "pass"/"fail", or non-empty text) rather than the schema
  -- enforcing a fixed shape — the same choice assignment_submissions.grade makes for the same
  -- underlying reason (no single fixed shape fits every metric type a category might define).

calendar_events               -- unifies classes, exams, fee due dates, holidays into one queryable view
  id, institute_id nullable, owner_type ('teacher'|'student'|'class'), owner_id,
  event_type ('class_occurrence'|'assignment_due'|'fee_due'|'exam'|'holiday'|'custom'),
  source_id nullable, title, starts_at, ends_at, timezone
```

**Implemented (docs/07 Phase 5 step 6) as a live-computed aggregation, not a persisted table.**
`GET /calendar` materializes `class_occurrence`/`assignment_due`/`fee_due` events at query time
straight from Classes/Assignments/Fees (`class_schedule_versions`' own RRULE materialization,
already built for §3.5's conflict-check, is reused directly), the same way every other "unified
view" in this codebase works (Attendance history's percentage, Fees' revenue summary, Reports) —
a persisted `calendar_events` row would need write-side sync hooks in three separate modules
every time a class reschedules, an assignment is created, or an invoice is generated, exactly the
cross-module coupling this schema's "each module owns its own domain" convention avoids
elsewhere, and there's no point-in-time/historical need here the way there is for `audit_logs`.
`owner_type`/`owner_id` are accepted as explicit query params only for `'class'` and an added
`'institute'` (docs/06 §6.2 grants institute_admin "R (institute)" with nowhere in this sketch's
enum for that to point, the same class of gap `PLATFORM` filled for `announcements.target_type`)
— omitted, they resolve to the caller's own calendar server-side (teacher's own classes,
student's own enrollments, every one of a parent's linked children's, an institute_admin's own
institute, or platform-wide for super_admin); an explicit `'teacher'`/`'student'` naming someone
other than the caller is a documented scope cut, not a granted use case per the matrix. `exam`
and `custom` have no backing data source anywhere in this codebase and aren't invented; `holiday`
is only partially covered (via per-class `schedule_exceptions`) — layering those onto
materialized occurrences is a real, documented follow-up, matching the exact simplification
`ClassesService.getConflicts` already makes for the same underlying reason.

## 3.9 Offline sync support

```
sync_queue                    -- client-generated records awaiting server confirmation
  id (client-generated uuid — becomes the real PK on success, so no remap needed),
  device_id, user_id, entity_type, payload (jsonb), client_created_at,
  sync_status ('pending'|'synced'|'conflict'|'rejected'), server_processed_at, conflict_reason
```

Client-generated UUIDs as real primary keys (rather than server-assigned autoincrement) is what makes offline-created attendance/payment records mergeable without a remapping step — the same policy from `docs/01` §1.3: non-financial conflicts resolve last-write-wins with an audit entry; financial conflicts (e.g., two devices recorded a cash payment for the same invoice while offline) are never auto-merged — both land in `sync_status = 'conflict'` for explicit teacher resolution.

## 3.10 Generic audit log (cross-cutting)

```
audit_logs
  id, actor_id, actor_role, action, entity_type, entity_id, institute_id nullable,
  before_state (jsonb nullable), after_state (jsonb nullable), ip_address, user_agent, created_at
```

Written by a shared interceptor on every mutating admin/teacher action touching students, fees, or role/permission changes — not per-module bespoke logging — so security review (`docs/` security section) has one place to look.

## 3.11 Report export jobs (docs/04 §4.7, an addition beyond this doc's original scope)

```
export_jobs
  id, requested_by, report_type ('attendance'|'fees'), format ('pdf'|'csv'),
  from_date, to_date, institute_id nullable, status ('pending'|'processing'|'completed'|'failed'),
  object_key nullable, error_message nullable, created_at, completed_at nullable
```

Backs docs/04 §4.7's async-export pattern for the two report types large enough to warrant it (`GET /reports/attendance`, `GET /reports/fees`) — the per-student report (`GET /reports/students/:id`) is inherently bounded to one record, so it has no job counterpart and stays a plain synchronous GET. `institute_id` is a plain column, not a foreign key with referential integrity — it's a snapshot of the request parameter the job was created with (meaningful only for super_admin drilling into one institute), not a relationship. The generated file is written through the same `common/storage/` `StorageAdapter` Notes/Assignments already share (`object_key` into the same `uploads/` object-key namespace), read back via `GET /export-jobs/:id/file` once `status` is `completed`.

**Implementation note**: docs/04 §4.7 frames this as running "on a BullMQ worker" — no BullMQ/Redis is wired up anywhere in this codebase (the same documented gap as Notifications' digest batching, docs/07 Phase 4 step 8). The job row is created and returned immediately, and the actual work runs via a fire-and-forget async call in the same process right after — genuinely non-blocking and pollable/retryable, satisfying the behavioral contract this doc actually cares about, without pretending to a queue infrastructure this MVP doesn't have.

## 3.12 Student CSV import jobs (docs/04 §4.4/§4.7, an addition beyond this doc's original scope)

```
student_import_jobs
  id, requested_by, status ('pending'|'processing'|'completed'|'failed'),
  total_rows, success_count, failure_count, errors (jsonb array of {row, message}),
  created_at, completed_at nullable
```

Backs docs/04 §4.4's `POST /students/import` "CSV, async job" the exact same way §3.11's
`export_jobs` backs Reports' async path — same reasoning (no BullMQ/Redis, a fire-and-forget
in-process call right after the job row is created and returned). `errors` is a per-row failure
list, not a single error field — one malformed row never aborts the rest of the import (docs/04
§4.7's own "gives every bulk operation a natural retry point if it fails partway"), and the job
only ends `failed` outright when *every* row failed. Row-level validation reuses
`CreateStudentDto`'s own class-validator decorators rather than a second hand-rolled check, so a
bad CSV row and a bad `POST /students` body get identically worded errors. Mobile has no screen
for this yet — the same missing `file_picker` dependency already documented as the reason
Notes/Assignments stayed link-only (docs/07 Phase 5 step 7).
