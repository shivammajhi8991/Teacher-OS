import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

// docs/03 §3.3, docs/01 §1.1 — data, not an enum: the mechanism that lets a new teaching
// category ship as a migration + admin insert, never a code change. Seeded with the spec's
// starter list (see the migration); `admin` module (docs/07 Phase 5/6) adds CRUD for these once
// it exists — until then they're read-only via GET /teacher-categories.
@Entity('teacher_categories')
export class TeacherCategory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  slug: string;

  @Column({ nullable: true })
  icon?: string;

  // Reserved FKs/hints for modules that don't exist yet (performance §1.4, fees §3.7) — nullable
  // so this table doesn't have to wait for those to ship.
  @Column({
    name: 'default_performance_template_id',
    type: 'uuid',
    nullable: true,
  })
  defaultPerformanceTemplateId?: string | null;

  @Column({ name: 'default_fee_model', nullable: true })
  defaultFeeModel?: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;
}
