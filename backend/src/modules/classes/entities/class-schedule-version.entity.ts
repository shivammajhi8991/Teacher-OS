import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Class } from './class.entity';

// docs/03 §3.5 `class_schedule_versions` — effective-dated: a reschedule creates a NEW row (with
// `effectiveFrom` = the change date) rather than editing this one, and closes the previous
// version's `effectiveTo` (docs/01 §1.5 "teacher reschedules a recurring class" — past occurrences
// keep referencing the schedule that was actually active then). `recurrenceRule` is an RFC 5545
// RRULE string (e.g. "FREQ=WEEKLY;BYDAY=MO,WE,FR"); combined with `effectiveFrom` as DTSTART when
// materializing occurrences (see utils/schedule-occurrences.util.ts).
@Entity('class_schedule_versions')
export class ClassScheduleVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Class, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'class_id' })
  class: Class;

  @Column({ name: 'effective_from', type: 'date' })
  effectiveFrom: string;

  // null = this is the current/active version (docs/03 §3.5).
  @Column({ name: 'effective_to', type: 'date', nullable: true })
  effectiveTo?: string | null;

  @Column({ name: 'recurrence_rule' })
  recurrenceRule: string;

  @Column({ name: 'start_time', type: 'time' })
  startTime: string; // "HH:mm:ss"

  @Column({ name: 'end_time', type: 'time' })
  endTime: string;

  @Column({ default: 'UTC' })
  timezone: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
