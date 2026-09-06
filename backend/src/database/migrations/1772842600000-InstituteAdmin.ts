import { MigrationInterface, QueryRunner } from 'typeorm';

// docs/03 §3.7/§3.8, docs/07 Phase 5 step 4 "Institute/admin module." Four pieces:
// - `branches.deleted_at` — soft-delete, matching this project's never-hard-delete convention;
//   missing from the original Phase 4 step 1 entity, added here alongside its first real use
//   (InstitutesService.archiveBranch).
// - `teacher_profiles.payout_percent` — answers docs/03 §3.7's own prior note that the payouts
//   table "needs a payout-percent config that doesn't exist on any entity yet."
// - `teacher_institute_invites` — mirrors student_invites' shape (see Students migration): a
//   short-lived code a teacher redeems to join an institute.
// - `announcements` — docs/03 §3.8, with `target_id` polymorphic (resolved in code, same shape as
//   document_shares.shared_with_id) and a PLATFORM target added beyond the doc's sketch — see
//   announcement.entity.ts's header comment for the full reasoning on both deviations.
// - `institute_teacher_payouts` — one row per CONFIRMED payment (not per invoice), `payment_id`
//   unique — see institute-teacher-payout.entity.ts's header comment.
//
// Grants match docs/06 §6.2: institute_admin/super_admin manage branches, teacher invites, and
// payouts for their own institute (super_admin: any institute); teacher requests+redeems its own
// institute invites and reads its own payouts; announcements follow the matrix's per-role
// send scope (teacher→class, institute_admin→institute, super_admin→platform) with `read` open
// to all five roles (everyone can see announcements addressed to them).
const NEW_PERMISSIONS: Record<string, string> = {
  'branch.manage':
    'Create/update/archive a branch of your own institute (super_admin: any)',
  'teacher_invite.manage':
    'Generate and list teacher-institute invite codes for your own institute (super_admin: any)',
  'teacher_invite.redeem':
    'Redeem a teacher-institute invite code to join an institute',
  'announcement.manage':
    'Send an announcement to a class you teach, your own institute, or (super_admin) the platform',
  'announcement.read': 'List announcements addressed to you',
  'payout.manage':
    "Configure a teacher's payout percent and mark a generated payout paid, for your own institute (super_admin: any)",
  'payout.read':
    'List institute-teacher payouts (own, for a teacher; own institute, for an admin)',
};

const GRANTS: Record<string, string[]> = {
  teacher: [
    'teacher_invite.redeem',
    'announcement.manage',
    'announcement.read',
    'payout.read',
  ],
  student: ['announcement.read'],
  parent: ['announcement.read'],
  institute_admin: [
    'branch.manage',
    'teacher_invite.manage',
    'announcement.manage',
    'announcement.read',
    'payout.manage',
    'payout.read',
  ],
  super_admin: [
    'branch.manage',
    'teacher_invite.manage',
    'announcement.manage',
    'announcement.read',
    'payout.manage',
    'payout.read',
  ],
};

export class InstituteAdmin1772842600000 implements MigrationInterface {
  name = 'InstituteAdmin1772842600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "branches" ADD COLUMN "deleted_at" timestamptz;
    `);

    await queryRunner.query(`
      ALTER TABLE "teacher_profiles" ADD COLUMN "payout_percent" numeric(5, 2);
    `);

    await queryRunner.query(`
      CREATE TABLE "teacher_institute_invites" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "institute_id" uuid NOT NULL REFERENCES "institutes"("id") ON DELETE CASCADE,
        "code" varchar NOT NULL UNIQUE,
        "created_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "expires_at" timestamptz NOT NULL,
        "redeemed_at" timestamptz,
        "redeemed_by_teacher_profile_id" uuid REFERENCES "teacher_profiles"("id") ON DELETE SET NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX "idx_teacher_invites_institute" ON "teacher_institute_invites" ("institute_id");
    `);

    await queryRunner.query(`
      CREATE TABLE "announcements" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "institute_id" uuid REFERENCES "institutes"("id") ON DELETE CASCADE,
        "created_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "target_type" varchar NOT NULL,
        "target_id" uuid,
        "title" varchar NOT NULL,
        "body" text NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX "idx_announcements_target" ON "announcements" ("target_type", "target_id");
    `);

    await queryRunner.query(`
      CREATE TABLE "institute_teacher_payouts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "institute_id" uuid NOT NULL REFERENCES "institutes"("id") ON DELETE CASCADE,
        "teacher_profile_id" uuid NOT NULL REFERENCES "teacher_profiles"("id") ON DELETE CASCADE,
        "invoice_id" uuid NOT NULL REFERENCES "invoices"("id") ON DELETE CASCADE,
        "payment_id" uuid NOT NULL UNIQUE REFERENCES "payments"("id") ON DELETE CASCADE,
        "payout_percent" numeric(5, 2) NOT NULL,
        "payout_amount" numeric(12, 2) NOT NULL,
        "status" varchar NOT NULL DEFAULT 'pending',
        "paid_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX "idx_institute_payouts_institute" ON "institute_teacher_payouts" ("institute_id");
      CREATE INDEX "idx_institute_payouts_teacher" ON "institute_teacher_payouts" ("teacher_profile_id");
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
      `DELETE FROM "role_permissions" WHERE "permission_id" IN (SELECT "id" FROM "permissions" WHERE "key" IN ('branch.manage', 'teacher_invite.manage', 'teacher_invite.redeem', 'announcement.manage', 'announcement.read', 'payout.manage', 'payout.read'))`,
    );
    await queryRunner.query(
      `DELETE FROM "permissions" WHERE "key" IN ('branch.manage', 'teacher_invite.manage', 'teacher_invite.redeem', 'announcement.manage', 'announcement.read', 'payout.manage', 'payout.read')`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "institute_teacher_payouts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "announcements"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "teacher_institute_invites"`);
    await queryRunner.query(
      `ALTER TABLE "teacher_profiles" DROP COLUMN "payout_percent"`,
    );
    await queryRunner.query(`ALTER TABLE "branches" DROP COLUMN "deleted_at"`);
  }
}
