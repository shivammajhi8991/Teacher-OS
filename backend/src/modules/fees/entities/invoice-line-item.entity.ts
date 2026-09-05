import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Invoice } from './invoice.entity';

// docs/03 §3.7 `invoice_line_items` — a per-invoice itemized breakdown (base fee, attendance
// deduction, discount) purely for display; the authoritative totals live on `Invoice` itself,
// computed once at generation time (docs/03's column list), not derived from these on read.
@Entity('invoice_line_items')
export class InvoiceLineItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Invoice, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoice_id' })
  invoice: Invoice;

  @Column()
  description: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount: string; // negative for a deduction/discount line

  // docs/01 §1.5 "attendance edited after fee calculation" — this is what a future recalculation
  // check would trace a deduction line back to. Reserved for the sourcing FK; not enforced at the
  // DB level (attendance_records may live in a differently-scoped table set) to avoid a hard
  // cross-module FK dependency here.
  @Column({ name: 'source_attendance_id', type: 'uuid', nullable: true })
  sourceAttendanceId?: string | null;

  @Column({ name: 'source_class_id', type: 'uuid', nullable: true })
  sourceClassId?: string | null;
}
