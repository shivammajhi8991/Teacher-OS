import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Class } from './class.entity';
import { StudentProfile } from '../../students/entities/student-profile.entity';
import { Enrollment } from './enrollment.entity';

// docs/03 §3.5 `waitlist_entries`, docs/01 §1.3 "waitlist for full batches" — the fix for a
// teacher having to turn away "can you fit one more?" requests once a class hits capacity.
@Entity('waitlist_entries')
export class WaitlistEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Class, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'class_id' })
  class: Class;

  @ManyToOne(() => StudentProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student: StudentProfile;

  @CreateDateColumn({ name: 'requested_at', type: 'timestamptz' })
  requestedAt: Date;

  @Column({ name: 'notified_at', type: 'timestamptz', nullable: true })
  notifiedAt?: Date | null;

  // Set once a capacity slot opens and this waitlist entry becomes a real enrollment (a later
  // Attendance/Fees-adjacent workflow step, not built in this pass — see students.module.ts's
  // ownership TODOs for the pattern of flagging exactly this kind of "not yet, but the column is
  // ready" gap).
  @ManyToOne(() => Enrollment, { nullable: true })
  @JoinColumn({ name: 'converted_to_enrollment_id' })
  convertedToEnrollment?: Enrollment | null;
}
