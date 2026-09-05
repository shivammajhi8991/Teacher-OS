import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { StudentProfile } from '../../students/entities/student-profile.entity';
import { Payment } from './payment.entity';
import { Invoice } from './invoice.entity';

// Addition beyond docs/03's explicit table list — the doc describes overpayment as resolving to
// "a credit balance on the student's account... consumable against the next invoice" without
// naming a table for it. Modeled as an append-only ledger (balance = SUM(amount)) rather than a
// single mutable balance column, matching this codebase's audit-everywhere convention elsewhere
// (docs/01 §1.5) — every credit grant and consumption is its own dated, attributable row.
@Entity('student_credit_ledger_entries')
export class StudentCreditLedgerEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => StudentProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student: StudentProfile;

  // Positive = credit granted (an overpayment); negative = credit consumed (applied to a later
  // invoice as a discount-like reduction).
  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount: string;

  @ManyToOne(() => Payment, { nullable: true })
  @JoinColumn({ name: 'source_payment_id' })
  sourcePayment?: Payment | null;

  @ManyToOne(() => Invoice, { nullable: true })
  @JoinColumn({ name: 'source_invoice_id' })
  sourceInvoice?: Invoice | null;

  @Column({ nullable: true })
  note?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
