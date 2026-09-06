import { MigrationInterface, QueryRunner } from 'typeorm';

// docs/03 §3.8 (assignments half) — assignments/assignment_submissions. Grants match docs/06
// §6.2's matrix literally: only teacher gets 'assignment.manage' (create/review); institute_admin
// and super_admin get 'assignment.read' only (the matrix marks both R, not F, for this resource —
// see assignments.service.ts's class header comment on why super_admin still gets a service-layer
// bypass despite that). Parent gets nothing — docs/08's Parent screen inventory has no
// Assignments tab at all, so this isn't a gap, it matches the designed navigation.
const NEW_PERMISSIONS: Record<string, string> = {
  'assignment.manage':
    'Create and review assignments for your own classes/students',
  'assignment.read':
    'List/read assignments and their attachments (scope enforced in the service layer)',
  'assignment.submit': 'Submit or resubmit your own assignment work',
};

const GRANTS: Record<string, string[]> = {
  teacher: ['assignment.manage', 'assignment.read'],
  student: ['assignment.read', 'assignment.submit'],
  institute_admin: ['assignment.read'],
  super_admin: ['assignment.manage', 'assignment.read'],
};

export class Assignments1772842400000 implements MigrationInterface {
  name = 'Assignments1772842400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "assignments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "class_id" uuid REFERENCES "classes"("id") ON DELETE CASCADE,
        "student_id" uuid REFERENCES "student_profiles"("id") ON DELETE CASCADE,
        "teacher_profile_id" uuid NOT NULL REFERENCES "teacher_profiles"("id") ON DELETE CASCADE,
        "title" varchar NOT NULL,
        "description" text,
        "attachment_urls" text[] NOT NULL DEFAULT '{}',
        "due_at" timestamptz NOT NULL,
        "allow_late_submission" boolean NOT NULL DEFAULT true,
        "allow_resubmission" boolean NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz
      );
      CREATE INDEX "idx_assignments_class" ON "assignments" ("class_id");
      CREATE INDEX "idx_assignments_student" ON "assignments" ("student_id");
      CREATE INDEX "idx_assignments_teacher_profile" ON "assignments" ("teacher_profile_id");
    `);

    await queryRunner.query(`
      CREATE TABLE "assignment_submissions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "assignment_id" uuid NOT NULL REFERENCES "assignments"("id") ON DELETE CASCADE,
        "student_id" uuid NOT NULL REFERENCES "student_profiles"("id") ON DELETE CASCADE,
        "attachment_urls" text[] NOT NULL DEFAULT '{}',
        "submitted_at" timestamptz NOT NULL DEFAULT now(),
        "is_late" boolean NOT NULL DEFAULT false,
        "attempt_number" int NOT NULL DEFAULT 1,
        "status" varchar NOT NULL DEFAULT 'submitted',
        "grade" varchar,
        "feedback" text,
        "reviewed_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "reviewed_at" timestamptz
      );
      CREATE INDEX "idx_assignment_submissions_assignment_student"
        ON "assignment_submissions" ("assignment_id", "student_id");
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
      `DELETE FROM "role_permissions" WHERE "permission_id" IN (SELECT "id" FROM "permissions" WHERE "key" IN ('assignment.manage', 'assignment.read', 'assignment.submit'))`,
    );
    await queryRunner.query(
      `DELETE FROM "permissions" WHERE "key" IN ('assignment.manage', 'assignment.read', 'assignment.submit')`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "assignment_submissions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "assignments"`);
  }
}
