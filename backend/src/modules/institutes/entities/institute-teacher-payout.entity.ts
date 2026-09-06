import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Institute } from './institute.entity';
import { TeacherProfile } from '../../teacher-profiles/entities/teacher-profile.entity';
import { Invoice } from '../../fees/entities/invoice.entity';
import { Payment } from '../../fees/entities/payment.entity';

export enum PayoutStatus {
  PENDING = 'pending',
  PAID = 'paid',
}

// docs/03 §3.7 `institute_teacher_payouts` — that doc's own note flagged this as "NOT YET
// IMPLEMENTED... needs a payout-percent config that doesn't exist on any entity yet"
// (teacher_profiles.payout_percent, added alongside this table). One row per *payment*, not per
// invoice — an addition beyond the doc's sketch (`payment_id`, unique) so a partially-paid
// invoice generates payouts correctly as each payment lands, rather than double-counting or
// waiting for full payment, and so a webhook retry can never generate a duplicate payout for the
// same payment.
@Entity('institute_teacher_payouts')
@Unique(['payment'])
export class InstituteTeacherPayout {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Institute, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'institute_id' })
  institute: Institute;

  @ManyToOne(() => TeacherProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'teacher_profile_id' })
  teacherProfile: TeacherProfile;

  @ManyToOne(() => Invoice, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoice_id' })
  invoice: Invoice;

  @ManyToOne(() => Payment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'payment_id' })
  payment: Payment;

  @Column({ name: 'payout_percent', type: 'numeric', precision: 5, scale: 2 })
  payoutPercent: string;

  @Column({ name: 'payout_amount', type: 'numeric', precision: 12, scale: 2 })
  payoutAmount: string;

  @Column({ type: 'varchar', default: PayoutStatus.PENDING })
  status: PayoutStatus;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
