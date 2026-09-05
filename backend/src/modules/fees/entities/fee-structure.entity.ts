import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Institute } from '../../institutes/entities/institute.entity';
import { TeacherProfile } from '../../teacher-profiles/entities/teacher-profile.entity';
import { Class } from '../../classes/entities/class.entity';

export enum BillingModel {
  MONTHLY = 'monthly',
  PER_CLASS = 'per_class',
  COURSE = 'course',
  HOURLY = 'hourly',
  CUSTOM = 'custom',
  ONE_TIME_REGISTRATION = 'one_time_registration',
}

export enum ProrationPolicy {
  NONE = 'none',
  PER_CLASS_DEDUCTION = 'per_class_deduction',
  MANUAL_ADJUSTMENT_ONLY = 'manual_adjustment_only',
}

// docs/03 §3.7 `fee_structures`. `prorationPolicy` is what docs/01 §1.5 means by "attendance vs
// fee coupling is a policy, not an assumption" — `per_class_deduction` is the only one this pass
// actually implements the math for (InvoicesService.generateForClass); `manual_adjustment_only`
// means the amount is never auto-adjusted from attendance at all, which is already the default
// behavior for anything that isn't `per_class_deduction`.
@Entity('fee_structures')
export class FeeStructure {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Institute, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'institute_id' })
  institute?: Institute | null;

  @ManyToOne(() => TeacherProfile, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'teacher_profile_id' })
  teacherProfile?: TeacherProfile | null;

  @ManyToOne(() => Class, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'class_id' })
  class?: Class | null;

  @Column({ name: 'billing_model', type: 'varchar' })
  billingModel: BillingModel;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount: string; // numeric columns come back as strings from pg — kept as string end-to-end

  @Column({ type: 'char', length: 3, default: 'INR' })
  currency: string;

  @Column({
    name: 'proration_policy',
    type: 'varchar',
    default: ProrationPolicy.NONE,
  })
  prorationPolicy: ProrationPolicy;

  // {graceDays: number, flatOrPercent: 'flat'|'percent', amount: number} — read but not yet
  // applied anywhere (late-fee computation needs the overdue-detection pass, docs/07 follow-up).
  @Column({ name: 'late_fee_rule', type: 'jsonb', nullable: true })
  lateFeeRule?: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
