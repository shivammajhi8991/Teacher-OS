import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Class } from './class.entity';
import { StudentProfile } from '../../students/entities/student-profile.entity';

export enum EnrollmentEntryStatus {
  ACTIVE = 'active',
  WAITLISTED = 'waitlisted',
  TRIAL = 'trial',
  ENDED = 'ended',
}

// docs/03 §3.5 `enrollments` — date-ranged: a batch change is a NEW row (`enrolledFrom` = the
// change date), never an update to which class a row points at (docs/01 §1.5 "student changes
// batch" — old attendance/records stay correctly attributed to the old batch's enrollment period).
@Entity('enrollments')
export class Enrollment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => StudentProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student: StudentProfile;

  @ManyToOne(() => Class, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'class_id' })
  class: Class;

  @Column({ name: 'enrolled_from', type: 'date' })
  enrolledFrom: string;

  // null = current/ongoing.
  @Column({ name: 'enrolled_to', type: 'date', nullable: true })
  enrolledTo?: string | null;

  @Column({ type: 'varchar', default: EnrollmentEntryStatus.ACTIVE })
  status: EnrollmentEntryStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
