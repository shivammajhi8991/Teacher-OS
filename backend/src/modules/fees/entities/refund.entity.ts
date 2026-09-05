import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Payment } from './payment.entity';
import { User } from '../../users/entities/user.entity';

export enum RefundStatus {
  PENDING = 'pending',
  PROCESSED = 'processed',
  REJECTED = 'rejected',
}

// docs/03 §3.7 `refunds`. This pass only supports a full-amount refund, processed synchronously
// (no real payment gateway is wired up to reverse money — see gateway/README or
// mock-payment-gateway.adapter.ts — so "processing" a refund here means recording that it
// happened, matching how a cash refund actually works: the teacher hands the money back and
// logs it). Partial refunds are a documented follow-up.
@Entity('refunds')
export class Refund {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Payment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'payment_id' })
  payment: Payment;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount: string;

  @Column()
  reason: string;

  @Column({ type: 'varchar', default: RefundStatus.PENDING })
  status: RefundStatus;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'processed_by' })
  processedBy?: User | null;

  @Column({ name: 'processed_at', type: 'timestamptz', nullable: true })
  processedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
