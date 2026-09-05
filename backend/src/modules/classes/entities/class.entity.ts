import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Institute } from '../../institutes/entities/institute.entity';
import { TeacherProfile } from '../../teacher-profiles/entities/teacher-profile.entity';

export enum ClassType {
  RECURRING = 'recurring',
  ONE_TIME = 'one_time',
  TRIAL = 'trial',
}

export enum ClassMode {
  ONLINE = 'online',
  OFFLINE = 'offline',
}

export enum ClassStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

// docs/03 §3.5 `classes` — a batch/course/group or 1:1 arrangement. Cancellation is a status
// transition (PATCH .../classes/:id), never a delete; `deletedAt` is reserved for the rare
// erroneous-record case, matching the convention used across every other table (docs/03 §3.1).
@Entity('classes')
export class Class {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Institute, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'institute_id' })
  institute?: Institute | null;

  @ManyToOne(() => TeacherProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'teacher_profile_id' })
  teacherProfile: TeacherProfile;

  @Column()
  name: string;

  @Column({ name: 'subject_or_activity', nullable: true })
  subjectOrActivity?: string;

  @Column({ name: 'class_type', type: 'varchar', default: ClassType.RECURRING })
  classType: ClassType;

  @Column({ type: 'varchar' })
  mode: ClassMode;

  @Column({ name: 'location_or_meeting_link', nullable: true })
  locationOrMeetingLink?: string;

  @Column({ name: 'capacity_max', type: 'int', nullable: true })
  capacityMax?: number | null;

  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate?: string | null;

  @Column({ type: 'varchar', default: ClassStatus.ACTIVE })
  status: ClassStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt?: Date;
}
