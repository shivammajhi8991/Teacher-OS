import { MigrationInterface, QueryRunner } from 'typeorm';

// docs/03 §3.8 (notes half) — documents/document_shares/document_access_log. Grants
// 'note.manage' (teacher/institute_admin/super_admin) and 'note.read' (all roles, scoped
// per-resource in NotesService — own uploads + relevant shares).
const NEW_PERMISSIONS: Record<string, string> = {
  'note.manage': 'Upload, share, and version documents/notes',
  'note.read':
    'List/read/download documents shared with you (scope enforced in the service layer)',
};

const GRANTS: Record<string, string[]> = {
  teacher: ['note.manage', 'note.read'],
  student: ['note.read'],
  parent: ['note.read'],
  institute_admin: ['note.manage', 'note.read'],
  super_admin: ['note.manage', 'note.read'],
};

export class Notes1772842200000 implements MigrationInterface {
  name = 'Notes1772842200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "documents" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "institute_id" uuid REFERENCES "institutes"("id") ON DELETE SET NULL,
        "uploaded_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "title" varchar NOT NULL,
        "file_url" varchar NOT NULL,
        "file_type" varchar NOT NULL,
        "folder_name" varchar,
        "expiry_date" timestamptz,
        "version" int NOT NULL DEFAULT 1,
        "previous_version_id" uuid REFERENCES "documents"("id") ON DELETE SET NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz
      );
      CREATE INDEX "idx_documents_uploaded_by" ON "documents" ("uploaded_by");
      CREATE INDEX "idx_documents_institute" ON "documents" ("institute_id");
    `);

    await queryRunner.query(`
      CREATE TABLE "document_shares" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "document_id" uuid NOT NULL REFERENCES "documents"("id") ON DELETE CASCADE,
        "shared_with_type" varchar NOT NULL,
        "shared_with_id" uuid NOT NULL,
        "allow_download" boolean NOT NULL DEFAULT true,
        "shared_at" timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX "idx_document_shares_target" ON "document_shares" ("shared_with_type", "shared_with_id");
      CREATE INDEX "idx_document_shares_document" ON "document_shares" ("document_id");
    `);

    await queryRunner.query(`
      CREATE TABLE "document_access_log" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "document_id" uuid NOT NULL REFERENCES "documents"("id") ON DELETE CASCADE,
        "accessed_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "accessed_at" timestamptz NOT NULL DEFAULT now(),
        "action" varchar NOT NULL
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
      `DELETE FROM "role_permissions" WHERE "permission_id" IN (SELECT "id" FROM "permissions" WHERE "key" IN ('note.manage', 'note.read'))`,
    );
    await queryRunner.query(
      `DELETE FROM "permissions" WHERE "key" IN ('note.manage', 'note.read')`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "document_access_log"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "document_shares"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "documents"`);
  }
}
