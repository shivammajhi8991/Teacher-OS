import { MigrationInterface, QueryRunner } from 'typeorm';

// docs/03 §3.5 — classes/class_schedule_versions/schedule_exceptions/enrollments/
// waitlist_entries. Grants 'class.manage' / 'class.read' per docs/06 §6.2.
const NEW_PERMISSIONS: Record<string, string> = {
  'class.manage':
    'Create/update classes, schedules, exceptions, enrollments, waitlist',
  'class.read':
    "Read a class's details (scope enforced in the service layer, not here)",
};

const GRANTS: Record<string, string[]> = {
  teacher: ['class.manage', 'class.read'],
  student: ['class.read'],
  parent: ['class.read'],
  institute_admin: ['class.manage', 'class.read'],
  super_admin: ['class.manage', 'class.read'],
};

export class Classes1772841900000 implements MigrationInterface {
  name = 'Classes1772841900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "classes" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "institute_id" uuid REFERENCES "institutes"("id") ON DELETE SET NULL,
        "teacher_profile_id" uuid NOT NULL REFERENCES "teacher_profiles"("id") ON DELETE CASCADE,
        "name" varchar NOT NULL,
        "subject_or_activity" varchar,
        "class_type" varchar NOT NULL DEFAULT 'recurring',
        "mode" varchar NOT NULL,
        "location_or_meeting_link" varchar,
        "capacity_max" int,
        "start_date" date NOT NULL,
        "end_date" date,
        "status" varchar NOT NULL DEFAULT 'active',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz
      );
      CREATE INDEX "idx_classes_teacher" ON "classes" ("teacher_profile_id");
    `);

    await queryRunner.query(`
      CREATE TABLE "class_schedule_versions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "class_id" uuid NOT NULL REFERENCES "classes"("id") ON DELETE CASCADE,
        "effective_from" date NOT NULL,
        "effective_to" date,
        "recurrence_rule" varchar NOT NULL,
        "start_time" time NOT NULL,
        "end_time" time NOT NULL,
        "timezone" varchar NOT NULL DEFAULT 'UTC',
        "created_at" timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX "idx_csv_class_current" ON "class_schedule_versions" ("class_id") WHERE "effective_to" IS NULL;
    `);

    await queryRunner.query(`
      CREATE TABLE "schedule_exceptions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "class_id" uuid NOT NULL REFERENCES "classes"("id") ON DELETE CASCADE,
        "occurrence_date" date NOT NULL,
        "exception_type" varchar NOT NULL,
        "new_date" date,
        "new_start_time" time,
        "new_end_time" time,
        "reason" varchar,
        "created_by" uuid NOT NULL REFERENCES "users"("id"),
        "created_at" timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX "idx_se_class" ON "schedule_exceptions" ("class_id");
    `);

    await queryRunner.query(`
      CREATE TABLE "enrollments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "student_id" uuid NOT NULL REFERENCES "student_profiles"("id") ON DELETE CASCADE,
        "class_id" uuid NOT NULL REFERENCES "classes"("id") ON DELETE CASCADE,
        "enrolled_from" date NOT NULL,
        "enrolled_to" date,
        "status" varchar NOT NULL DEFAULT 'active',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX "idx_enrollments_class" ON "enrollments" ("class_id");
      CREATE INDEX "idx_enrollments_student" ON "enrollments" ("student_id");
    `);

    await queryRunner.query(`
      CREATE TABLE "waitlist_entries" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "class_id" uuid NOT NULL REFERENCES "classes"("id") ON DELETE CASCADE,
        "student_id" uuid NOT NULL REFERENCES "student_profiles"("id") ON DELETE CASCADE,
        "requested_at" timestamptz NOT NULL DEFAULT now(),
        "notified_at" timestamptz,
        "converted_to_enrollment_id" uuid REFERENCES "enrollments"("id")
      );
      CREATE INDEX "idx_waitlist_class" ON "waitlist_entries" ("class_id");
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
      if (!roleId) continue;
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
      `DELETE FROM "role_permissions" WHERE "permission_id" IN (SELECT "id" FROM "permissions" WHERE "key" IN ('class.manage', 'class.read'))`,
    );
    await queryRunner.query(
      `DELETE FROM "permissions" WHERE "key" IN ('class.manage', 'class.read')`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "waitlist_entries"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "enrollments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "schedule_exceptions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "class_schedule_versions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "classes"`);
  }
}
