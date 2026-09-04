# TeacherOS Backend

NestJS modular monolith — see [../docs/02-architecture.md](../docs/02-architecture.md) for the
full design rationale, [../docs/03-database-schema.md](../docs/03-database-schema.md) for the
schema, and [../docs/04-api-design.md](../docs/04-api-design.md) for the API contract.

## Implemented so far (docs/07 Phase 4, steps 1–2)

- `modules/auth` — register, login, refresh (rotating), logout, logout-all, `/auth/me`
- `modules/users` — User/Role/Permission/UserRole entities, effective-permission resolution
- `modules/institutes` — institutes CRUD (soft-delete only)
- `modules/teacher-profiles` — `teacher_categories` (seeded with the spec's starter list),
  `teacher_profiles` (create/read/update, owner-only writes), `verification_requests`
  (submit only — admin review UI is a later module)
- `common/` — global JWT guard (protected-by-default, opt out with `@Public()`), permissions
  guard (`@RequirePermission`), standard error envelope, request-correlated logging
- Two migrations: initial schema (users/roles/institutes, seeded roles + a starter permission
  set — docs/06 §6.2, grows as later modules ship) and teacher-profiles (seeded categories)

Every other module under `src/modules/` is a stub `README.md` pointing at the roadmap step and
doc sections that define it — see [docs/07-roadmap.md](../docs/07-roadmap.md).

## Local setup

```bash
# 1. Start Postgres + Redis
docker compose -f ../infra/docker-compose.yml up -d

# 2. Install deps
npm install

# 3. Configure env
cp .env.example .env   # defaults already match the docker-compose service

# 4. Run the initial migration
npm run migration:run

# 5. Start the API (watch mode)
npm run start:dev
```

API is served at `http://localhost:3000/api/v1`.

## Testing

```bash
npm test            # unit tests
npm run test:e2e    # integration tests — needs Postgres up + migrations applied, see test/auth.e2e-spec.ts
```

## Adding a migration

Never hand-edit a table with `synchronize: true` — it's deliberately off (`app.module.ts`).
Generate a migration from entity changes, review the SQL it produces, then run it:

```bash
npm run migration:generate -- src/database/migrations/DescriptiveName
npm run migration:run
```
