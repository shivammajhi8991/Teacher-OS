import { MigrationInterface, QueryRunner } from 'typeorm';

// docs/03 §3.6 — attendance_sessions/attendance_records/attendance_audit_log. Note:
// attendance_records has NO idempotency_key column (unlike the doc sketch) — see
// attendance-record.entity.ts for why a UNIQUE(session, student) constraint + upsert semantics
// replaces it. Grants 'attendance.mark' (teacher only — NOT institute_admin/super_admin by
// default, docs/06 §6.3) and 'attendance.read' (docs/06 §6.2, all roles).
const NEW_PERMISSIONS: Record<string, string> = {
  'attendance.mark':
    'Mark/edit attendance for a class (teacher-owned; admin override is opt-in)',
  'attendance.read':
    "Read a student's attendance history (scope enforced in the service layer)",
};

// docs/06 §6.3 — deliberately NOT granted to institute_admin/super_admin here; the
// AttendanceService checks `institutes.allow_admin_attendance_override` at runtime for
// institute_admin instead of a blanket permission grant, and super_admin is special-cased in
// code (bypasses the permission-scoped check entirely, same pattern as every other module).
const GRANTS: Record<string, string[]> = {
  teacher: ['attendance.mark', 'attendance.read'],
  student: ['attendance.read'],
  parent: ['attendance.read'],
  institute_admin: ['attendance.read'],
  super_admin: ['attendance.read'],
};

export class Attendance1772842000000 implements MigrationInterface {
  name = 'Attendance1772842000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "attendance_sessions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "class_id" uuid NOT NULL REFERENCES "classes"("id") ON DELETE CASCADE,
        "occurrence_date" date NOT NULL,
        "status" varchar NOT NULL DEFAULT 'scheduled',
        "marked_by" uuid REFERENCES "users"("id"),
        "marked_at" timestamptz,
        "marking_method" varchar,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        UNIQUE ("class_id", "occurrence_date")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "attendance_records" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "attendance_session_id" uuid NOT NULL REFERENCES "attendance_sessions"("id") ON DELETE CASCADE,
        "student_id" uuid NOT NULL REFERENCES "student_profiles"("id") ON DELETE CASCADE,
        "status" varchar NOT NULL,
        "marked_at" timestamptz NOT NULL,
        "marked_by" uuid NOT NULL REFERENCES "users"("id"),
        "notes" varchar,
        "invoiced" boolean NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        UNIQUE ("attendance_session_id", "student_id")
      );
      CREATE INDEX "idx_ar_student" ON "attendance_records" ("student_id");
    `);

    await queryRunner.query(`
      CREATE TABLE "attendance_audit_log" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "attendance_record_id" uuid NOT NULL REFERENCES "attendance_records"("id") ON DELETE CASCADE,
        "previous_status" varchar NOT NULL,
        "new_status" varchar NOT NULL,
        "changed_by" uuid NOT NULL REFERENCES "users"("id"),
        "changed_at" timestamptz NOT NULL DEFAULT now(),
        "reason" varchar
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
      `DELETE FROM "role_permissions" WHERE "permission_id" IN (SELECT "id" FROM "permissions" WHERE "key" IN ('attendance.mark', 'attendance.read'))`,
    );
    await queryRunner.query(
      `DELETE FROM "permissions" WHERE "key" IN ('attendance.mark', 'attendance.read')`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "attendance_audit_log"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "attendance_records"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "attendance_sessions"`);
  }
}
