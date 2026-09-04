# classes module (not yet implemented)

Scaffolded per docs/07-roadmap.md Phase 4 step 4. Covers `classes`, `class_schedule_versions`,
`schedule_exceptions`, `enrollments`, `waitlist_entries` (docs/03 §3.5), including the
conflict-detection logic described there (materialize each schedule version's RRULE against the
relevant date window, check overlap by teacher/student/location).

Endpoints to implement: docs/04-api-design.md §4.4 "Classes / Batches / Schedules".
