import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Invoice } from './invoice.entity';
import { StudentProfile } from '../../students/entities/student-profile.entity';
import { User } from '../../users/entities/user.entity';

export enum PaymentMethod {
  CASH = 'cash',
  UPI = 'upi',
  BANK_TRANSFER = 'bank_transfer',
  GATEWAY = 'gateway',
}

export enum PaymentStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

export enum ConfirmedVia {
  WEBHOOK = 'webhook',
  MANUAL = 'manual',
}

// docs/03 §3.7 `payments`. `idempotencyKey` (client-generated, unique) is what resolves
// docs/01 §1.5 "duplicate payment" — a repeat submission with the same key returns the original
// payment rather than recording money twice; unlike attendance's upsert design, a payment isn't
// naturally mergeable (two legitimately-different cash payments can share every other field), so
// this stays a dedicated column rather than being folded into a broader constraint.
@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Invoice, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoice_id' })
  invoice: Invoice;

  @ManyToOne(() => StudentProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student: StudentProfile;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount: string;

  @Column({ type: 'char', length: 3, default: 'INR' })
  currency: string;

  @Column({ type: 'varchar' })
  method: PaymentMethod;

  @Column({ type: 'varchar', default: PaymentStatus.CONFIRMED })
  status: PaymentStatus;

  @Column({ name: 'gateway_reference', nullable: true })
  gatewayReference?: string;

  @Column({ name: 'idempotency_key', unique: true })
  idempotencyKey: string;

  // Nullable — a gateway-initiated payment is student-initiated, not "recorded by" a teacher.
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'recorded_by' })
  recordedBy?: User | null;

  @CreateDateColumn({ name: 'recorded_at', type: 'timestamptz' })
  recordedAt: Date;

  // docs/01 §1.5 "payment succeeds but API confirmation fails" — a gateway payment only ever
  // moves to CONFIRMED via the webhook handler, never the client's own initiate/return response.
  @Column({ name: 'confirmed_via', type: 'varchar', nullable: true })
  confirmedVia?: ConfirmedVia | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
