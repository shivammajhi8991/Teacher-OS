import { MigrationInterface, QueryRunner } from 'typeorm';

// docs/07 Phase 5 step 8 "Admin web panel," docs/06 §6.2. Two new permissions, both super_admin
// only, matching the matrix's literal "F" in the Super Admin column and "–" everywhere else for
// both rows: "Teacher category management" and "Verification review." `user.administer` (Users
// admin search/suspend/role-assign) and `institute.manage`/read (Institutes list/drill-in) are
// both reused as-is — no new grant needed for either, see this step's own README/roadmap notes
// for why.
const NEW_PERMISSIONS: Record<string, string> = {
  'teacher_category.manage':
    'Add/edit teacher categories (docs/01 §1.1 — the mechanism a new teaching vertical ships through, never a code change)',
  'verification.review':
    "Review a teacher's submitted verification documents and approve/reject with a reason",
};

const GRANTS: Record<string, string[]> = {
  super_admin: ['teacher_category.manage', 'verification.review'],
};

export class AdminPanel1772843100000 implements MigrationInterface {
  name = 'AdminPanel1772843100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
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
      `DELETE FROM "role_permissions" WHERE "permission_id" IN (SELECT "id" FROM "permissions" WHERE "key" IN ('teacher_category.manage', 'verification.review'))`,
    );
    await queryRunner.query(
      `DELETE FROM "permissions" WHERE "key" IN ('teacher_category.manage', 'verification.review')`,
    );
  }
}
