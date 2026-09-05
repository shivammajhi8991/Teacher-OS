import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { StudentProfile } from '../../students/entities/student-profile.entity';
import { Institute } from '../../institutes/entities/institute.entity';
import { TeacherProfile } from '../../teacher-profiles/entities/teacher-profile.entity';

export enum InvoiceStatus {
  ISSUED = 'issued',
  PAID = 'paid',
  PARTIAL = 'partial',
  OVERDUE = 'overdue',
  VOID = 'void',
}

// docs/03 §3.7 `invoices` — IMMUTABLE once created (no `draft` status in this pass: generation
// issues directly, see invoices.service.ts). Corrections only ever happen via `credit_notes`,
// never an in-place edit — `update`/`save` on this entity are only ever called by this module to
// flip `status` as payments come in, never to change amounts.
@Entity('invoices')
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => StudentProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student: StudentProfile;

  @ManyToOne(() => Institute, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'institute_id' })
  institute?: Institute | null;

  @ManyToOne(() => TeacherProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'teacher_profile_id' })
  teacherProfile: TeacherProfile;

  @Column({ name: 'billing_period_start', type: 'date' })
  billingPeriodStart: string;

  @Column({ name: 'billing_period_end', type: 'date' })
  billingPeriodEnd: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  subtotal: string;

  @Column({
    name: 'discount_total',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
  })
  discountTotal: string;

  @Column({
    name: 'late_fee_total',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
  })
  lateFeeTotal: string;

  @Column({
    name: 'tax_total',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
  })
  taxTotal: string;

  @Column({ name: 'total_amount', type: 'numeric', precision: 12, scale: 2 })
  totalAmount: string;

  @Column({ type: 'char', length: 3, default: 'INR' })
  currency: string;

  @Column({ type: 'varchar', default: InvoiceStatus.ISSUED })
  status: InvoiceStatus;

  @Column({ nullable: true })
  gstin?: string;

  @Column({ name: 'hsn_sac_code', nullable: true })
  hsnSacCode?: string;

  @CreateDateColumn({ name: 'issued_at', type: 'timestamptz' })
  issuedAt: Date;

  @Column({ name: 'due_date', type: 'date' })
  dueDate: string;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
