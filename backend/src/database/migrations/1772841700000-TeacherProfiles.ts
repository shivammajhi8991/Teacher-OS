import { MigrationInterface, QueryRunner } from 'typeorm';

// docs/03 §3.3 — teacher_categories/teacher_profiles/verification_requests. Categories are
// seeded from the spec's starter list (docs/01 §1.1) — adding another one later is a data
// insert (or, once the admin module ships, an admin API call), never a migration.
const TEACHER_CATEGORIES: Array<{ name: string; slug: string; icon: string }> =
  [
    { name: 'Academic Teacher', slug: 'academic-teacher', icon: 'school' },
    { name: 'Home Tutor', slug: 'home-tutor', icon: 'home' },
    { name: 'Sports Coach', slug: 'sports-coach', icon: 'sports' },
    { name: 'Music Teacher', slug: 'music-teacher', icon: 'music_note' },
    { name: 'Dance Teacher', slug: 'dance-teacher', icon: 'directions_run' },
    {
      name: 'Fitness Trainer',
      slug: 'fitness-trainer',
      icon: 'fitness_center',
    },
    { name: 'Yoga Teacher', slug: 'yoga-teacher', icon: 'self_improvement' },
    {
      name: 'Art & Drawing Teacher',
      slug: 'art-drawing-teacher',
      icon: 'palette',
    },
    { name: 'Language Teacher', slug: 'language-teacher', icon: 'translate' },
    {
      name: 'Computer/Technical Trainer',
      slug: 'computer-technical-trainer',
      icon: 'computer',
    },
    {
      name: 'Coaching Institute Teacher',
      slug: 'coaching-institute-teacher',
      icon: 'groups',
    },
    { name: 'Freelance Tutor', slug: 'freelance-tutor', icon: 'person' },
    { name: 'Online Teacher', slug: 'online-teacher', icon: 'laptop' },
    { name: 'Other', slug: 'other', icon: 'more_horiz' },
  ];

export class TeacherProfiles1772841700000 implements MigrationInterface {
  name = 'TeacherProfiles1772841700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "teacher_categories" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar NOT NULL,
        "slug" varchar NOT NULL UNIQUE,
        "icon" varchar,
        "default_performance_template_id" uuid,
        "default_fee_model" varchar,
        "is_active" boolean NOT NULL DEFAULT true
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "teacher_profiles" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
        "institute_id" uuid REFERENCES "institutes"("id") ON DELETE SET NULL,
        "teacher_category_id" uuid NOT NULL REFERENCES "teacher_categories"("id"),
        "headline" varchar,
        "bio" text,
        "experience_years" int,
        "qualifications" jsonb NOT NULL DEFAULT '[]',
        "service_area" varchar,
        "teaching_mode" varchar NOT NULL,
        "subjects_or_skills" jsonb NOT NULL DEFAULT '[]',
        "class_duration_minutes_default" int,
        "fee_structure_default_id" uuid,
        "verification_status" varchar NOT NULL DEFAULT 'unverified',
        "rating_avg" numeric(3,2) NOT NULL DEFAULT 0,
        "rating_count" int NOT NULL DEFAULT 0,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "verification_requests" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "teacher_profile_id" uuid NOT NULL REFERENCES "teacher_profiles"("id") ON DELETE CASCADE,
        "document_urls" text[] NOT NULL,
        "status" varchar NOT NULL DEFAULT 'pending',
        "reviewed_by" uuid REFERENCES "users"("id"),
        "reviewed_at" timestamptz,
        "rejection_reason" varchar,
        "created_at" timestamptz NOT NULL DEFAULT now()
      );
    `);

    for (const category of TEACHER_CATEGORIES) {
      await queryRunner.query(
        `INSERT INTO "teacher_categories" ("name", "slug", "icon") VALUES ($1, $2, $3)`,
        [category.name, category.slug, category.icon],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "verification_requests"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "teacher_profiles"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "teacher_categories"`);
  }
}
