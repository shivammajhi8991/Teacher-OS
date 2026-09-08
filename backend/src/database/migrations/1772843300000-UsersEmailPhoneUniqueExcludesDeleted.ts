import { MigrationInterface, QueryRunner } from 'typeorm';

// Phase 6 — building self-service account deletion (docs/01 §1.3's own "data export /
// account deletion request flow... absence of this is a compliance gap") surfaced a real,
// previously-unreachable gap: `uq_users_email`/`uq_users_phone` (InitialSchema, Phase 4 step 1)
// never excluded soft-deleted rows, so a deleted user's email/phone stayed permanently
// "taken" — nobody, including the same real person signing up again, could ever register with
// it. This was invisible until now because nothing before this step ever soft-deleted a `users`
// row in the first place (`@DeleteDateColumn` was declared from day one per docs/01 §1.3/§1.5's
// "never a hard delete," but no code path actually exercised it). Fixed by adding
// `deleted_at IS NULL` to both partial unique indexes.
export class UsersEmailPhoneUniqueExcludesDeleted1772843300000 implements MigrationInterface {
  name = 'UsersEmailPhoneUniqueExcludesDeleted1772843300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_users_email"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_users_phone"`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_users_email"
        ON "users" ("email")
        WHERE "email" IS NOT NULL AND "deleted_at" IS NULL;
      CREATE UNIQUE INDEX "uq_users_phone"
        ON "users" ("phone")
        WHERE "phone" IS NOT NULL AND "deleted_at" IS NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_users_phone"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_users_email"`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_users_email" ON "users" ("email") WHERE "email" IS NOT NULL;
      CREATE UNIQUE INDEX "uq_users_phone" ON "users" ("phone") WHERE "phone" IS NOT NULL;
    `);
  }
}
