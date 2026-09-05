import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AttendanceSession } from './attendance-session.entity';
import { StudentProfile } from '../../students/entities/student-profile.entity';
import { User } from '../../users/entities/user.entity';

export enum AttendanceStatus {
  PRESENT = 'present',
  ABSENT = 'absent',
  LATE = 'late',
  EXCUSED = 'excused',
  HOLIDAY = 'holiday',
  CANCELLED = 'cancelled',
}

// docs/03 §3.6 `attendance_records`. Deliberately DROPS the doc sketch's separate
// `idempotency_key` column in favor of a UNIQUE(session, student) constraint plus upsert
// semantics in the service (docs/01 §1.5 "duplicate attendance submission"): re-submitting the
// same bulk-mark call is a no-op if nothing changed, and a real correction updates in place
// while writing attendance_audit_log — one mechanism covers both "safe retry" and "edit with
// audit trail" instead of two. This is also what makes a queued offline bulk-mark call safely
// replayable without a separate Idempotency-Key header (docs/04 §4.2) — see mobile core/sync.
@Entity('attendance_records')
@Index(['attendanceSession', 'student'], { unique: true })
export class AttendanceRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => AttendanceSession, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'attendance_session_id' })
  attendanceSession: AttendanceSession;

  @ManyToOne(() => StudentProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student: StudentProfile;

  @Column({ type: 'varchar' })
  status: AttendanceStatus;

  @Column({ name: 'marked_at', type: 'timestamptz' })
  markedAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'marked_by' })
  markedBy: User;

  @Column({ nullable: true })
  notes?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  // Reserved for the Fees module (docs/03 §3.7 `invoice_line_items.source_attendance_id`) — once
  // an invoice line references this record, edits must stop mutating it in place and instead
  // flag "recalculation suggested" (docs/01 §1.5). Nullable and unused until Fees ships.
  @Column({ name: 'invoiced', default: false })
  invoiced: boolean;
}
