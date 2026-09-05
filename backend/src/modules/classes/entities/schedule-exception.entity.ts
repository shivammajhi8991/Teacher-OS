import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Class } from './class.entity';
import { User } from '../../users/entities/user.entity';

export enum ScheduleExceptionType {
  HOLIDAY = 'holiday',
  CANCELLED = 'cancelled',
  RESCHEDULED = 'rescheduled',
  MAKEUP = 'makeup',
  TEACHER_ABSENT = 'teacher_absent',
  EXTRA_CLASS = 'extra_class',
}

// docs/03 §3.5 `schedule_exceptions` — single-occurrence overrides layered on top of the
// recurrence rule, so a one-off holiday/cancellation/reschedule doesn't touch the recurring
// schedule itself (docs/01 §1.5 handles holidays/cancellation/reschedule/makeup/teacher-absence/
// extra-class this way, uniformly).
@Entity('schedule_exceptions')
export class ScheduleException {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Class, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'class_id' })
  class: Class;

  @Column({ name: 'occurrence_date', type: 'date' })
  occurrenceDate: string;

  @Column({ name: 'exception_type', type: 'varchar' })
  exceptionType: ScheduleExceptionType;

  // Only meaningful for 'rescheduled'/'makeup' — where the occurrence actually happens instead.
  @Column({ name: 'new_date', type: 'date', nullable: true })
  newDate?: string | null;

  @Column({ name: 'new_start_time', type: 'time', nullable: true })
  newStartTime?: string | null;

  @Column({ name: 'new_end_time', type: 'time', nullable: true })
  newEndTime?: string | null;

  @Column({ nullable: true })
  reason?: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  createdBy: User;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
