import { MigrationInterface, QueryRunner } from 'typeorm';

// docs/01 §1.4 / docs/03 §3.8 "configurable performance metrics" — performance_metric_definitions
// (with `institute_id`, an addition beyond docs/03's original sketch — see
// performance-metric-definition.entity.ts's header comment for why) and performance_records.
// Grants match docs/06 §6.2's two separate rows literally: teacher gets all three; institute_admin
// and super_admin get `define`+`read` but never `record` (they never record a value themselves);
// student/parent get `read` only (their own / their linked child's, scoped in the service).
const NEW_PERMISSIONS: Record<string, string> = {
  'performance.define':
    'Define a performance metric (own, institute-default, or category-default per role)',
  'performance.record':
    'Record a value against a metric for one of your own students',
  'performance.read':
    "List applicable metric definitions and view a student's performance history",
};

const GRANTS: Record<string, string[]> = {
  teacher: ['performance.define', 'performance.record', 'performance.read'],
  student: ['performance.read'],
  parent: ['performance.read'],
  institute_admin: ['performance.define', 'performance.read'],
  super_admin: ['performance.define', 'performance.read'],
};

export class Performance1772842500000 implements MigrationInterface {
  name = 'Performance1772842500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "performance_metric_definitions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "teacher_category_id" uuid REFERENCES "teacher_categories"("id") ON DELETE CASCADE,
        "institute_id" uuid REFERENCES "institutes"("id") ON DELETE CASCADE,
        "teacher_profile_id" uuid REFERENCES "teacher_profiles"("id") ON DELETE CASCADE,
        "name" varchar NOT NULL,
        "metric_type" varchar NOT NULL,
        "unit" varchar,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz
      );
      CREATE INDEX "idx_perf_defs_teacher_category" ON "performance_metric_definitions" ("teacher_category_id");
      CREATE INDEX "idx_perf_defs_institute" ON "performance_metric_definitions" ("institute_id");
      CREATE INDEX "idx_perf_defs_teacher_profile" ON "performance_metric_definitions" ("teacher_profile_id");
    `);

    await queryRunner.query(`
      CREATE TABLE "performance_records" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "student_id" uuid NOT NULL REFERENCES "student_profiles"("id") ON DELETE CASCADE,
        "metric_definition_id" uuid NOT NULL REFERENCES "performance_metric_definitions"("id") ON DELETE CASCADE,
        "class_id" uuid REFERENCES "classes"("id") ON DELETE SET NULL,
        "value" varchar NOT NULL,
        "recorded_at" timestamptz NOT NULL,
        "recorded_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "created_at" timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX "idx_perf_records_student_metric" ON "performance_records" ("student_id", "metric_definition_id");
    `);

    // --- Seed a handful of category-level default metrics — demonstrates the mechanism (docs/01
    // §1.4's own examples: academic marks, a sports coach's timed metric, a music teacher's
    // scale-mastery level) without pretending to enumerate every category's real needs. ---------
    const categoryRows: Array<{ id: string; slug: string }> =
      await queryRunner.query(`SELECT "id", "slug" FROM "teacher_categories"`);
    const categoryIdBySlug = new Map(categoryRows.map((c) => [c.slug, c.id]));

    const seedDefaults: Array<{
      slug: string;
      name: string;
      metricType: string;
      unit: string | null;
    }> = [
      {
        slug: 'academic-teacher',
        name: 'Test Score',
        metricType: 'percentage',
        unit: null,
      },
      {
        slug: 'sports-coach',
        name: '40m Sprint Time',
        metricType: 'numeric',
        unit: 'seconds',
      },
      {
        slug: 'music-teacher',
        name: 'Scale Mastery',
        metricType: 'scale_1_5',
        unit: null,
      },
    ];
    for (const seed of seedDefaults) {
      const categoryId = categoryIdBySlug.get(seed.slug);
      if (!categoryId) continue; // that category isn't seeded in this environment — skip, don't fail
      await queryRunner.query(
        `INSERT INTO "performance_metric_definitions" ("teacher_category_id", "name", "metric_type", "unit") VALUES ($1, $2, $3, $4)`,
        [categoryId, seed.name, seed.metricType, seed.unit],
      );
    }

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
      `DELETE FROM "role_permissions" WHERE "permission_id" IN (SELECT "id" FROM "permissions" WHERE "key" IN ('performance.define', 'performance.record', 'performance.read'))`,
    );
    await queryRunner.query(
      `DELETE FROM "permissions" WHERE "key" IN ('performance.define', 'performance.record', 'performance.read')`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "performance_records"`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS "performance_metric_definitions"`,
    );
  }
}
