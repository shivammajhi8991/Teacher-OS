# students module (not yet implemented)

Scaffolded per docs/07-roadmap.md Phase 4 step 3. Entities/service/controller to follow the
same pattern as `modules/institutes`: `entities/` (student_profiles, guardians,
student_guardian_links, student_teacher_assignments, student_merge_log — docs/03 §3.4),
DTOs, service, controller wired to `@RequirePermission` per docs/06 §6.2, plus a migration
under `src/database/migrations/`.

Endpoints to implement: docs/04-api-design.md §4.4 "Students".
