import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Payment, PaymentStatus } from './payment.entity';
import { User } from '../../users/entities/user.entity';

// docs/03 §3.7 `payment_audit_log` — every status transition (including webhook-driven ones,
// where `changedBy` is null) and every manual correction. Spec §6 "Every financial action should
// maintain a proper transaction and audit history."
@Entity('payment_audit_log')
export class PaymentAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Payment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'payment_id' })
  payment: Payment;

  @Column({ name: 'previous_status', type: 'varchar' })
  previousStatus: PaymentStatus;

  @Column({ name: 'new_status', type: 'varchar' })
  newStatus: PaymentStatus;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'changed_by' })
  changedBy?: User | null;

  @CreateDateColumn({ name: 'changed_at', type: 'timestamptz' })
  changedAt: Date;

  @Column({ nullable: true })
  note?: string;
}
