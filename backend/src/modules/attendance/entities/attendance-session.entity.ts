import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Class } from '../../classes/entities/class.entity';
import { User } from '../../users/entities/user.entity';

export enum AttendanceSessionStatus {
  SCHEDULED = 'scheduled',
  HELD = 'held',
  CANCELLED = 'cancelled',
}

export enum MarkingMethod {
  MANUAL = 'manual',
  QR = 'qr',
  LOCATION = 'location',
  BULK = 'bulk',
}

// docs/03 §3.6 `attendance_sessions` — one row per (class, occurrence_date), the "roll call"
// instance. Created lazily by the first bulk-mark call (docs/04 §4.4 POST .../bulk), not by the
// roster GET, so simply opening the Quick Attendance screen (docs/08 §8.3) never writes anything.
@Entity('attendance_sessions')
@Index(['class', 'occurrenceDate'], { unique: true })
export class AttendanceSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Class, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'class_id' })
  class: Class;

  @Column({ name: 'occurrence_date', type: 'date' })
  occurrenceDate: string;

  @Column({ type: 'varchar', default: AttendanceSessionStatus.SCHEDULED })
  status: AttendanceSessionStatus;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'marked_by' })
  markedBy?: User | null;

  @Column({ name: 'marked_at', type: 'timestamptz', nullable: true })
  markedAt?: Date | null;

  @Column({ name: 'marking_method', type: 'varchar', nullable: true })
  markingMethod?: MarkingMethod | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
