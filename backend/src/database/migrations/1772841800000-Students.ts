import { MigrationInterface, QueryRunner } from 'typeorm';

// docs/03 §3.4 — guardians/student_profiles/student_guardian_links/student_teacher_assignments/
// student_merge_log, plus student_invites (an addition beyond docs/03, see student-invite.entity.ts).
// Also grants the 'student.manage' / 'student.read' permissions this module's routes require
// (docs/06 §6.2) — roles/permissions tables already exist from the initial migration.
const NEW_PERMISSIONS: Record<string, string> = {
  'student.manage':
    'Create/update/archive students, manage guardians, merge duplicates',
  'student.read':
    "Read a student's profile (scope enforced in the service layer, not here)",
};

const GRANTS: Record<string, string[]> = {
  teacher: ['student.manage', 'student.read'],
  student: ['student.read'],
  parent: ['student.read'],
  institute_admin: ['student.manage', 'student.read'],
  super_admin: ['student.manage', 'student.read'],
};

export class Students1772841800000 implements MigrationInterface {
  name = 'Students1772841800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "guardians" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "institute_id" uuid REFERENCES "institutes"("id") ON DELETE SET NULL,
        "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "full_name" varchar NOT NULL,
        "phone" varchar,
        "email" varchar,
        "relationship" varchar,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "student_profiles" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "institute_id" uuid REFERENCES "institutes"("id") ON DELETE SET NULL,
        "full_name" varchar NOT NULL,
        "dob" date,
        "gender" varchar,
        "avatar_url" varchar,
        "emergency_contact_name" varchar,
        "emergency_contact_phone" varchar,
        "medical_notes" text,
        "join_date" date NOT NULL,
        "enrollment_status" varchar NOT NULL DEFAULT 'active',
        "status_changed_at" timestamptz NOT NULL,
        "source" varchar NOT NULL DEFAULT 'manual',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "student_guardian_links" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "student_id" uuid NOT NULL REFERENCES "student_profiles"("id") ON DELETE CASCADE,
        "guardian_id" uuid NOT NULL REFERENCES "guardians"("id") ON DELETE CASCADE,
        "is_primary" boolean NOT NULL DEFAULT false,
        "consent_data_sharing" boolean NOT NULL DEFAULT false,
        "consent_recorded_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        UNIQUE ("student_id", "guardian_id")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "student_teacher_assignments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "student_id" uuid NOT NULL REFERENCES "student_profiles"("id") ON DELETE CASCADE,
        "teacher_profile_id" uuid NOT NULL REFERENCES "teacher_profiles"("id") ON DELETE CASCADE,
        "subject_or_skill" varchar,
        "assigned_from" timestamptz NOT NULL,
        "assigned_to" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX "idx_sta_teacher_active" ON "student_teacher_assignments" ("teacher_profile_id") WHERE "assigned_to" IS NULL;
      CREATE INDEX "idx_sta_student" ON "student_teacher_assignments" ("student_id");
    `);

    await queryRunner.query(`
      CREATE TABLE "student_merge_log" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "surviving_student_id" uuid NOT NULL REFERENCES "student_profiles"("id") ON DELETE CASCADE,
        "merged_student_id" uuid NOT NULL REFERENCES "student_profiles"("id") ON DELETE CASCADE,
        "merged_by" uuid NOT NULL REFERENCES "users"("id"),
        "merged_at" timestamptz NOT NULL DEFAULT now(),
        "reason" varchar
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "student_invites" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "code" varchar NOT NULL UNIQUE,
        "created_by_teacher_id" uuid NOT NULL REFERENCES "teacher_profiles"("id") ON DELETE CASCADE,
        "institute_id" uuid REFERENCES "institutes"("id") ON DELETE SET NULL,
        "status" varchar NOT NULL DEFAULT 'pending',
        "expires_at" timestamptz,
        "used_by_student_id" uuid REFERENCES "student_profiles"("id"),
        "used_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now()
      );
    `);

    // --- Seed the new permissions and grant them per role -------------------------------------
    const roleRows: Array<{ id: string; name: string }> =
      await queryRunner.query(`SELECT "id", "name" FROM "roles"`);
    const roleIdByName = new Map(roleRows.map((r) => [r.name, r.id]));

    const permissionIdByKey = new Map<string, string>();
    for (const [key, description] of Object.entries(NEW_PERMISSIONS)) {
      const [{ id }] = await queryRunner.query(
        `INSERT INTO "permissions" ("key", "description") VALUES ($1, $2) RETURNING "id"`,
        [key, description],
      );
      permissionIdByKey.set(key, id);
    }

    for (const [roleName, permissionKeys] of Object.entries(GRANTS)) {
      const roleId = roleIdByName.get(roleName);
      if (!roleId) continue; // defensive — every role above was seeded by the initial migration
      for (const permissionKey of permissionKeys) {
        await queryRunner.query(
          `INSERT INTO "role_permissions" ("role_id", "permission_id") VALUES ($1, $2)`,
          [roleId, permissionIdByKey.get(permissionKey)],
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "role_permissions" WHERE "permission_id" IN (SELECT "id" FROM "permissions" WHERE "key" IN ('student.manage', 'student.read'))`,
    );
    await queryRunner.query(
      `DELETE FROM "permissions" WHERE "key" IN ('student.manage', 'student.read')`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "student_invites"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "student_merge_log"`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS "student_teacher_assignments"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "student_guardian_links"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "student_profiles"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "guardians"`);
  }
}
