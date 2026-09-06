import { MigrationInterface, QueryRunner } from 'typeorm';

// docs/04 §4.4 `POST /students/import` "CSV, async job" — an addition beyond docs/03's schema
// sketch (which never named a table for this), mirroring `export_jobs`' shape and reasoning (see
// student-import-job.entity.ts's header comment). No new permission — gated by the existing
// `student.manage` grant (bulk import is the same capability as manual add, at a different
// scale), so this migration only adds the table.
export class StudentImport1772843000000 implements MigrationInterface {
  name = 'StudentImport1772843000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "student_import_jobs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "requested_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "status" varchar NOT NULL DEFAULT 'pending',
        "total_rows" int NOT NULL DEFAULT 0,
        "success_count" int NOT NULL DEFAULT 0,
        "failure_count" int NOT NULL DEFAULT 0,
        "errors" jsonb NOT NULL DEFAULT '[]',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "completed_at" timestamptz
      );
      CREATE INDEX "idx_student_import_jobs_requested_by" ON "student_import_jobs" ("requested_by");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "student_import_jobs"`);
  }
}
