import { MigrationInterface, QueryRunner } from 'typeorm';

// docs/03 §3.7 — fee_structures/discounts/invoices/invoice_line_items/credit_notes/payments/
// payment_audit_log/refunds, plus student_credit_ledger_entries (an addition beyond docs/03 —
// see that entity file for why). Grants 'fee.manage' (teacher/institute_admin/super_admin) and
// 'fee.read' (all roles, scoped per-resource in FeesService).
const NEW_PERMISSIONS: Record<string, string> = {
  'fee.manage': 'Manage fee structures, discounts, invoices, payments, refunds',
  'fee.read':
    "Read a student's invoices/payment history (scope enforced in the service layer)",
};

const GRANTS: Record<string, string[]> = {
  teacher: ['fee.manage', 'fee.read'],
  student: ['fee.read'],
  parent: ['fee.read'],
  institute_admin: ['fee.manage', 'fee.read'],
  super_admin: ['fee.manage', 'fee.read'],
};

export class Fees1772842100000 implements MigrationInterface {
  name = 'Fees1772842100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "fee_structures" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "institute_id" uuid REFERENCES "institutes"("id") ON DELETE SET NULL,
        "teacher_profile_id" uuid REFERENCES "teacher_profiles"("id") ON DELETE CASCADE,
        "class_id" uuid REFERENCES "classes"("id") ON DELETE CASCADE,
        "billing_model" varchar NOT NULL,
        "amount" numeric(12,2) NOT NULL,
        "currency" char(3) NOT NULL DEFAULT 'INR',
        "proration_policy" varchar NOT NULL DEFAULT 'none',
        "late_fee_rule" jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "discounts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "student_id" uuid REFERENCES "student_profiles"("id") ON DELETE CASCADE,
        "class_id" uuid REFERENCES "classes"("id") ON DELETE CASCADE,
        "type" varchar NOT NULL,
        "value" numeric(12,2) NOT NULL,
        "reason" varchar,
        "approved_by" uuid NOT NULL REFERENCES "users"("id"),
        "created_at" timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "invoices" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "student_id" uuid NOT NULL REFERENCES "student_profiles"("id") ON DELETE CASCADE,
        "institute_id" uuid REFERENCES "institutes"("id") ON DELETE SET NULL,
        "teacher_profile_id" uuid NOT NULL REFERENCES "teacher_profiles"("id") ON DELETE CASCADE,
        "billing_period_start" date NOT NULL,
        "billing_period_end" date NOT NULL,
        "subtotal" numeric(12,2) NOT NULL,
        "discount_total" numeric(12,2) NOT NULL DEFAULT 0,
        "late_fee_total" numeric(12,2) NOT NULL DEFAULT 0,
        "tax_total" numeric(12,2) NOT NULL DEFAULT 0,
        "total_amount" numeric(12,2) NOT NULL,
        "currency" char(3) NOT NULL DEFAULT 'INR',
        "status" varchar NOT NULL DEFAULT 'issued',
        "gstin" varchar,
        "hsn_sac_code" varchar,
        "issued_at" timestamptz NOT NULL DEFAULT now(),
        "due_date" date NOT NULL,
        "updated_at" timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX "idx_invoices_student" ON "invoices" ("student_id");
      CREATE INDEX "idx_invoices_institute" ON "invoices" ("institute_id");
    `);

    await queryRunner.query(`
      CREATE TABLE "invoice_line_items" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "invoice_id" uuid NOT NULL REFERENCES "invoices"("id") ON DELETE CASCADE,
        "description" varchar NOT NULL,
        "amount" numeric(12,2) NOT NULL,
        "source_attendance_id" uuid,
        "source_class_id" uuid
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "credit_notes" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "invoice_id" uuid NOT NULL REFERENCES "invoices"("id") ON DELETE CASCADE,
        "amount" numeric(12,2) NOT NULL,
        "reason" varchar NOT NULL,
        "issued_by" uuid NOT NULL REFERENCES "users"("id"),
        "issued_at" timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "payments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "invoice_id" uuid NOT NULL REFERENCES "invoices"("id") ON DELETE CASCADE,
        "student_id" uuid NOT NULL REFERENCES "student_profiles"("id") ON DELETE CASCADE,
        "amount" numeric(12,2) NOT NULL,
        "currency" char(3) NOT NULL DEFAULT 'INR',
        "method" varchar NOT NULL,
        "status" varchar NOT NULL DEFAULT 'confirmed',
        "gateway_reference" varchar,
        "idempotency_key" varchar NOT NULL UNIQUE,
        "recorded_by" uuid REFERENCES "users"("id"),
        "recorded_at" timestamptz NOT NULL DEFAULT now(),
        "confirmed_via" varchar,
        "updated_at" timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX "idx_payments_invoice" ON "payments" ("invoice_id");
    `);

    await queryRunner.query(`
      CREATE TABLE "payment_audit_log" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "payment_id" uuid NOT NULL REFERENCES "payments"("id") ON DELETE CASCADE,
        "previous_status" varchar NOT NULL,
        "new_status" varchar NOT NULL,
        "changed_by" uuid REFERENCES "users"("id"),
        "changed_at" timestamptz NOT NULL DEFAULT now(),
        "note" varchar
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "refunds" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "payment_id" uuid NOT NULL REFERENCES "payments"("id") ON DELETE CASCADE,
        "amount" numeric(12,2) NOT NULL,
        "reason" varchar NOT NULL,
        "status" varchar NOT NULL DEFAULT 'pending',
        "processed_by" uuid REFERENCES "users"("id"),
        "processed_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "student_credit_ledger_entries" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "student_id" uuid NOT NULL REFERENCES "student_profiles"("id") ON DELETE CASCADE,
        "amount" numeric(12,2) NOT NULL,
        "source_payment_id" uuid REFERENCES "payments"("id"),
        "source_invoice_id" uuid REFERENCES "invoices"("id"),
        "note" varchar,
        "created_at" timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX "idx_credit_ledger_student" ON "student_credit_ledger_entries" ("student_id");
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
      `DELETE FROM "role_permissions" WHERE "permission_id" IN (SELECT "id" FROM "permissions" WHERE "key" IN ('fee.manage', 'fee.read'))`,
    );
    await queryRunner.query(
      `DELETE FROM "permissions" WHERE "key" IN ('fee.manage', 'fee.read')`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "student_credit_ledger_entries"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "refunds"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "payment_audit_log"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "payments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "credit_notes"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "invoice_line_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "invoices"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "discounts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "fee_structures"`);
  }
}
