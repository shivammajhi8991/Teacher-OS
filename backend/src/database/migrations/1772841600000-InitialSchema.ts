import { MigrationInterface, QueryRunner } from 'typeorm';

// docs/03-database-schema.md §3.2 — identity/roles/institutes, the foundation everything else's
// institute_id FK points at. Later migrations add students/classes/attendance/fees/... as each
// Phase 4 roadmap step (docs/07) ships — this one only covers what auth + institutes (the two
// modules scaffolded so far) actually need.

const ROLES = [
  'teacher',
  'student',
  'parent',
  'institute_admin',
  'super_admin',
] as const;

// docs/06-roles-permissions.md §6.2 — coarse resource-level grants for the modules scaffolded so
// far (auth, institutes); resource-level scoping (e.g. "only YOUR class") is enforced in each
// module's service layer, not by permission granularity (docs/04 §4.5). Finer-grained keys are
// added by later migrations as each module ships, matching docs/07's build order — this list is
// deliberately not the full docs/06 matrix yet.
const PERMISSIONS: Record<string, string> = {
  'profile.manage_own': 'Manage own user profile',
  'teacher_profile.read': "Read another user's teacher profile",
  'teacher_profile.manage': 'Create/update a teacher profile',
  'institute.manage': 'Create/update/archive institutes and branches',
  'user.administer': "Manage users within one's own institute",
  'audit_log.read': 'Read audit log entries',
};

const ROLE_PERMISSIONS: Record<(typeof ROLES)[number], string[]> = {
  teacher: [
    'profile.manage_own',
    'teacher_profile.manage',
    'teacher_profile.read',
  ],
  student: ['profile.manage_own', 'teacher_profile.read'],
  parent: ['profile.manage_own', 'teacher_profile.read'],
  institute_admin: [
    'profile.manage_own',
    'teacher_profile.read',
    'teacher_profile.manage',
    'institute.manage',
    'user.administer',
    'audit_log.read',
  ],
  super_admin: [
    'profile.manage_own',
    'teacher_profile.read',
    'teacher_profile.manage',
    'institute.manage',
    'user.administer',
    'audit_log.read',
  ],
};

export class InitialSchema1772841600000 implements MigrationInterface {
  name = 'InitialSchema1772841600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`); // gen_random_uuid()

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "email" varchar,
        "phone" varchar,
        "password_hash" varchar NOT NULL,
        "full_name" varchar NOT NULL,
        "avatar_url" varchar,
        "preferred_language" varchar NOT NULL DEFAULT 'en',
        "timezone" varchar NOT NULL DEFAULT 'UTC',
        "status" varchar NOT NULL DEFAULT 'active',
        "last_login_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz
      );
      CREATE UNIQUE INDEX "uq_users_email" ON "users" ("email") WHERE "email" IS NOT NULL;
      CREATE UNIQUE INDEX "uq_users_phone" ON "users" ("phone") WHERE "phone" IS NOT NULL;
    `);

    await queryRunner.query(`
      CREATE TABLE "roles" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar NOT NULL UNIQUE
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "permissions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "key" varchar NOT NULL UNIQUE,
        "description" varchar
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "role_permissions" (
        "role_id" uuid NOT NULL REFERENCES "roles"("id") ON DELETE CASCADE,
        "permission_id" uuid NOT NULL REFERENCES "permissions"("id") ON DELETE CASCADE,
        PRIMARY KEY ("role_id", "permission_id")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "institutes" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar NOT NULL,
        "logo_url" varchar,
        "address" varchar,
        "contact_email" varchar,
        "contact_phone" varchar,
        "subscription_plan_id" uuid,
        "allow_admin_attendance_override" boolean NOT NULL DEFAULT false,
        "status" varchar NOT NULL DEFAULT 'active',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "branches" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "institute_id" uuid NOT NULL REFERENCES "institutes"("id") ON DELETE CASCADE,
        "name" varchar NOT NULL,
        "address" varchar,
        "timezone" varchar NOT NULL DEFAULT 'UTC',
        "created_at" timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "user_roles" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "role_id" uuid NOT NULL REFERENCES "roles"("id") ON DELETE CASCADE,
        "institute_id" uuid REFERENCES "institutes"("id") ON DELETE CASCADE,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        UNIQUE ("user_id", "role_id", "institute_id")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "refresh_tokens" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "token_hash" varchar NOT NULL,
        "device_id" varchar,
        "expires_at" timestamptz NOT NULL,
        "revoked_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX "idx_refresh_tokens_lookup" ON "refresh_tokens" ("token_hash", "device_id");
    `);

    // --- Seed roles, permissions, and the role→permission grants above -------------------------
    const roleIds: Record<string, string> = {};
    for (const roleName of ROLES) {
      const [{ id }] = await queryRunner.query(
        `INSERT INTO "roles" ("name") VALUES ($1) RETURNING "id"`,
        [roleName],
      );
      roleIds[roleName] = id;
    }

    const permissionIds: Record<string, string> = {};
    for (const [key, description] of Object.entries(PERMISSIONS)) {
      const [{ id }] = await queryRunner.query(
        `INSERT INTO "permissions" ("key", "description") VALUES ($1, $2) RETURNING "id"`,
        [key, description],
      );
      permissionIds[key] = id;
    }

    for (const roleName of ROLES) {
      for (const permissionKey of ROLE_PERMISSIONS[roleName]) {
        await queryRunner.query(
          `INSERT INTO "role_permissions" ("role_id", "permission_id") VALUES ($1, $2)`,
          [roleIds[roleName], permissionIds[permissionKey]],
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "refresh_tokens"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_roles"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "branches"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "institutes"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "role_permissions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "permissions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "roles"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
  }
}
