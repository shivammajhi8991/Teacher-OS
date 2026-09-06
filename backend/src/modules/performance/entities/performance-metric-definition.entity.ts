import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TeacherCategory } from '../../teacher-profiles/entities/teacher-category.entity';
import { TeacherProfile } from '../../teacher-profiles/entities/teacher-profile.entity';
import { Institute } from '../../institutes/entities/institute.entity';

export enum MetricType {
  NUMERIC = 'numeric',
  SCALE_1_5 = 'scale_1_5',
  PASS_FAIL = 'pass_fail',
  TEXT = 'text',
  PERCENTAGE = 'percentage',
}

// docs/01 §1.4 / docs/03 §3.8 "configurable performance metrics" — the mechanism that gives an
// academic teacher "test score," a sports coach "40m sprint time," and a music teacher "scale
// mastery level" through the same two tables (this one + performance-record.entity.ts), never
// hard-coded per teacher category.
//
// Exactly one of teacherCategory/institute/teacherProfile is set (enforced in
// PerformanceService), matching docs/06 §6.2's three separate "define" grants: super_admin
// defines teacherCategory-scoped defaults ("category defaults"), institute_admin defines
// institute-scoped defaults ("institute defaults"), a teacher defines their own
// teacherProfile-scoped metrics ("own"). `institute` is an addition beyond docs/03's original
// sketch (which only listed teacher_category_id/teacher_profile_id) — the doc names "institute
// defaults" as a thing institute_admin can define in docs/06 §6.2, but the schema sketch had
// nowhere to attach one; see docs/03's note.
//
// teacher_categories.default_performance_template_id (docs/03 §3.3, a reserved hint column) is
// NOT wired to this table by a single FK — a category's "default template" is realized as
// however many teacherCategory-scoped rows exist here (plural), not one template id pointing at
// a single row. That reserved column stays an unused hint; see docs/07-roadmap.md's note.
@Entity('performance_metric_definitions')
export class PerformanceMetricDefinition {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => TeacherCategory, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'teacher_category_id' })
  teacherCategory?: TeacherCategory | null;

  @ManyToOne(() => Institute, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'institute_id' })
  institute?: Institute | null;

  @ManyToOne(() => TeacherProfile, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'teacher_profile_id' })
  teacherProfile?: TeacherProfile | null;

  @Column()
  name: string;

  @Column({ name: 'metric_type', type: 'varchar' })
  metricType: MetricType;

  @Column({ nullable: true })
  unit?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt?: Date;
}
