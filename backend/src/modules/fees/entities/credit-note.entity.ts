import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Invoice } from './invoice.entity';
import { User } from '../../users/entities/user.entity';

// docs/03 §3.7 `credit_notes` — the ONLY mechanism to correct an issued invoice. Never edit
// Invoice's amount columns directly once issued.
@Entity('credit_notes')
export class CreditNote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Invoice, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoice_id' })
  invoice: Invoice;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount: string;

  @Column()
  reason: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'issued_by' })
  issuedBy: User;

  @CreateDateColumn({ name: 'issued_at', type: 'timestamptz' })
  issuedAt: Date;
}
