import { MigrationInterface, QueryRunner } from 'typeorm';

// docs/03 §3.8 (notifications half) — notifications/notification_preferences, plus
// device_push_tokens (an addition beyond this doc's sketch — see docs/03's note on it).
//
// Unlike every migration before this one, nothing here seeds new permissions/grants: every
// notifications endpoint operates on the caller's own data (their own notifications,
// preferences, and device) — the same "authenticated is enough, no @RequirePermission" pattern
// already used for /auth/me (see notifications.controller.ts's header comment).
export class Notifications1772842300000 implements MigrationInterface {
  name = 'Notifications1772842300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "notifications" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "type" varchar NOT NULL,
        "title" varchar NOT NULL,
        "body" text NOT NULL,
        "data" jsonb,
        "delivery_channel" varchar NOT NULL,
        "delivered_at" timestamptz,
        "read_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX "idx_notifications_user_created" ON "notifications" ("user_id", "created_at");
      CREATE INDEX "idx_notifications_pending_digest" ON "notifications" ("delivery_channel", "delivered_at");
    `);

    await queryRunner.query(`
      CREATE TABLE "notification_preferences" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "category" varchar NOT NULL,
        "channel" varchar NOT NULL,
        UNIQUE ("user_id", "category")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "device_push_tokens" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "token" varchar NOT NULL UNIQUE,
        "platform" varchar NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "last_seen_at" timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX "idx_device_push_tokens_user" ON "device_push_tokens" ("user_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "device_push_tokens"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "notification_preferences"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "notifications"`);
  }
}
