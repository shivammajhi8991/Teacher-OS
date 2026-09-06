import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Institute } from '../../institutes/entities/institute.entity';
import { TeacherCategory } from './teacher-category.entity';

export enum TeachingMode {
  ONLINE = 'online',
  OFFLINE = 'offline',
  BOTH = 'both',
}

export enum VerificationStatus {
  UNVERIFIED = 'unverified',
  PENDING = 'pending',
  VERIFIED = 'verified',
}

// docs/03 §3.3 `teacher_profiles`. One profile per user (OneToOne) — a user who also teaches at
// a second institute is a docs/07 Phase 7 concern (currently modeled as one profile scoped by
// `institute`, matching docs/06 §6.1's "an institute owner who also teaches" via a separate
// `user_roles` row, not a second profile).
@Entity('teacher_profiles')
export class TeacherProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Institute, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'institute_id' })
  institute?: Institute | null;

  @ManyToOne(() => TeacherCategory, { eager: true })
  @JoinColumn({ name: 'teacher_category_id' })
  teacherCategory: TeacherCategory;

  @Column({ nullable: true })
  headline?: string;

  @Column({ type: 'text', nullable: true })
  bio?: string;

  @Column({ name: 'experience_years', type: 'int', nullable: true })
  experienceYears?: number;

  // docs/03 §3.3 `qualifications (jsonb array)` — free-form {title, institution, year} objects;
  // no fixed schema so this stays usable across wildly different teacher categories.
  @Column({ type: 'jsonb', default: () => "'[]'" })
  qualifications: unknown[];

  @Column({ name: 'service_area', nullable: true })
  serviceArea?: string;

  @Column({ name: 'teaching_mode', type: 'varchar' })
  teachingMode: TeachingMode;

  // docs/03 §3.3 `subjects_or_skills (jsonb array of {name, level})`.
  @Column({ name: 'subjects_or_skills', type: 'jsonb', default: () => "'[]'" })
  subjectsOrSkills: Array<{ name: string; level?: string }>;

  @Column({
    name: 'class_duration_minutes_default',
    type: 'int',
    nullable: true,
  })
  classDurationMinutesDefault?: number;

  // Reserved — no FK yet, docs/03 §3.7 fee_structures doesn't exist until docs/07 Phase 4 step 6.
  @Column({ name: 'fee_structure_default_id', type: 'uuid', nullable: true })
  feeStructureDefaultId?: string | null;

  // docs/03 §3.7 `institute_teacher_payouts`'s own note: "needs a payout-percent config that
  // doesn't exist on any entity yet." Addition, Phase 5 step 4 — null means "not an
  // institute-collected-fees arrangement" (an independent teacher, or an institute that hasn't
  // configured a split yet); a payout row is only ever generated when this is set AND the
  // teacher's invoice is institute-scoped (FeesService's payment-confirmation hook).
  @Column({
    name: 'payout_percent',
    type: 'numeric',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  payoutPercent?: string | null;

  @Column({
    name: 'verification_status',
    type: 'varchar',
    default: VerificationStatus.UNVERIFIED,
  })
  verificationStatus: VerificationStatus;

  @Column({
    name: 'rating_avg',
    type: 'numeric',
    precision: 3,
    scale: 2,
    default: 0,
  })
  ratingAvg: number;

  @Column({ name: 'rating_count', type: 'int', default: 0 })
  ratingCount: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt?: Date;
}
