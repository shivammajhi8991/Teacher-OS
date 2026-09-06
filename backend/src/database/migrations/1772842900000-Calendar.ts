import { MigrationInterface, QueryRunner } from 'typeorm';

// docs/04 §4.4 `GET /calendar`, docs/06 §6.2 "Calendar | F (own) | R (own) | R (child's) |
// R (institute) | R" — one `calendar.read` permission for every role: "F (own)" for a teacher
// doesn't make Calendar itself writable, it means their own calendar reflects classes they can
// already schedule/reschedule elsewhere (ClassesController's own `class.manage`). No new tables —
// see calendar.service.ts's header comment for why `calendar_events` is computed live instead of
// persisted.
const NEW_PERMISSIONS: Record<string, string> = {
  'calendar.read':
    "View your own calendar (scope enforced in the service layer — a teacher's own classes, a student's own enrolled classes, a parent's linked children's, an institute_admin's own institute, or platform-wide for super_admin), or an explicit class/institute calendar you have access to",
};

const GRANTS: Record<string, string[]> = {
  teacher: ['calendar.read'],
  student: ['calendar.read'],
  parent: ['calendar.read'],
  institute_admin: ['calendar.read'],
  super_admin: ['calendar.read'],
};

export class Calendar1772842900000 implements MigrationInterface {
  name = 'Calendar1772842900000';

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
      `DELETE FROM "role_permissions" WHERE "permission_id" IN (SELECT "id" FROM "permissions" WHERE "key" IN ('calendar.read'))`,
    );
    await queryRunner.query(
      `DELETE FROM "permissions" WHERE "key" IN ('calendar.read')`,
    );
  }
}
