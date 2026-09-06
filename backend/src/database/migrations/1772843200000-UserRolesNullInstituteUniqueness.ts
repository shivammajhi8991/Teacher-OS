import { MigrationInterface, QueryRunner } from 'typeorm';

// A real, previously-undiscovered data-integrity bug, caught live testing this step's new
// `POST /admin/users/:id/roles` endpoint: `user_roles`' original UNIQUE (user_id, role_id,
// institute_id) constraint (InitialSchema, Phase 4 step 1) relies on standard SQL's own
// NULL-is-distinct-from-NULL rule for unique constraints — so it has never actually blocked a
// SECOND identical (user, role) grant with a null `institute_id` (a platform-level role, or an
// independent, non-institute teacher/student/parent). Every *institute-scoped* grant was always
// correctly protected (neither operand is null there); only the null-institute case was silently
// unenforced, invisible until something actually tried to grant the same role twice — which
// nothing did, until this step's admin panel. Fixed with two partial unique indexes: one for
// institute-scoped grants (unchanged behavior) and one specifically for null-institute grants
// (finally enforced). Existing duplicate rows (if any slipped in before this point) are
// de-duplicated first, keeping the earliest.
export class UserRolesNullInstituteUniqueness1772843200000 implements MigrationInterface {
  name = 'UserRolesNullInstituteUniqueness1772843200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "user_roles" ur
      USING (
        SELECT "id",
               ROW_NUMBER() OVER (
                 PARTITION BY "user_id", "role_id", "institute_id"
                 ORDER BY "created_at" ASC
               ) AS rn
        FROM "user_roles"
      ) dupes
      WHERE ur."id" = dupes."id" AND dupes.rn > 1;
    `);

    await queryRunner.query(`
      ALTER TABLE "user_roles" DROP CONSTRAINT "user_roles_user_id_role_id_institute_id_key";
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_user_roles_with_institute"
        ON "user_roles" ("user_id", "role_id", "institute_id")
        WHERE "institute_id" IS NOT NULL;
      CREATE UNIQUE INDEX "uq_user_roles_without_institute"
        ON "user_roles" ("user_id", "role_id")
        WHERE "institute_id" IS NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "uq_user_roles_without_institute"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "uq_user_roles_with_institute"`,
    );
    await queryRunner.query(`
      ALTER TABLE "user_roles"
        ADD CONSTRAINT "user_roles_user_id_role_id_institute_id_key"
        UNIQUE ("user_id", "role_id", "institute_id");
    `);
  }
}
