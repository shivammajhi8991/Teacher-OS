import { MigrationInterface, QueryRunner } from 'typeorm';

// docs/04 §4.4/§4.7, docs/06 §6.2 "Reports/analytics | F (own scope) | – | – | F (institute
// scope) | F (platform scope)." One `report.generate` permission covers every route on this
// module — the doc's matrix has no separate verbs here, just F/– — with the actual scope
// (own classes/students, own institute, or any institute/platform-wide) resolved in
// ReportsService, not by a granted permission variant. `export_jobs` backs docs/04 §4.7's async
// export pattern for the two "large" report types (attendance/fees); see export-job.entity.ts's
// header comment for why the per-student report has no job counterpart.
const NEW_PERMISSIONS: Record<string, string> = {
  'report.generate':
    'Generate an attendance/fees/student report or a bulk async export job (scope enforced in the service layer, not here)',
};

const GRANTS: Record<string, string[]> = {
  teacher: ['report.generate'],
  institute_admin: ['report.generate'],
  super_admin: ['report.generate'],
};

export class Reports1772842800000 implements MigrationInterface {
  name = 'Reports1772842800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "export_jobs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "requested_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "report_type" varchar NOT NULL,
        "format" varchar NOT NULL,
        "from_date" date NOT NULL,
        "to_date" date NOT NULL,
        "institute_id" uuid,
        "status" varchar NOT NULL DEFAULT 'pending',
        "object_key" varchar,
        "error_message" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "completed_at" timestamptz
      );
      CREATE INDEX "idx_export_jobs_requested_by" ON "export_jobs" ("requested_by");
    `);

    // --- Seed the new permission and grant it per role -------------------------------------
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
      `DELETE FROM "role_permissions" WHERE "permission_id" IN (SELECT "id" FROM "permissions" WHERE "key" IN ('report.generate'))`,
    );
    await queryRunner.query(
      `DELETE FROM "permissions" WHERE "key" IN ('report.generate')`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "export_jobs"`);
  }
}
