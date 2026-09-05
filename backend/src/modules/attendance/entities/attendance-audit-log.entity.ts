import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AttendanceRecord, AttendanceStatus } from './attendance-record.entity';
import { User } from '../../users/entities/user.entity';

// docs/03 §3.6 `attendance_audit_log` — append-only: every edit to an attendance_record after
// its initial mark writes here, never overwrites history. Spec §5 "Maintain proper logs for
// changes."
@Entity('attendance_audit_log')
export class AttendanceAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => AttendanceRecord, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'attendance_record_id' })
  attendanceRecord: AttendanceRecord;

  @Column({ name: 'previous_status', type: 'varchar' })
  previousStatus: AttendanceStatus;

  @Column({ name: 'new_status', type: 'varchar' })
  newStatus: AttendanceStatus;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'changed_by' })
  changedBy: User;

  @CreateDateColumn({ name: 'changed_at', type: 'timestamptz' })
  changedAt: Date;

  @Column({ nullable: true })
  reason?: string;
}
