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
import { User } from '../../users/entities/user.entity';
import { Institute } from '../../institutes/entities/institute.entity';

export enum EnrollmentStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  LEFT = 'left',
  ARCHIVED = 'archived',
}

export enum StudentSource {
  MANUAL = 'manual',
  INVITE_LINK = 'invite_link',
  IMPORT = 'import',
}

// docs/03 §3.4 `student_profiles`. Deliberately carries NO direct "owner teacher" column —
// who manages this student is entirely expressed through `student_teacher_assignments`
// (docs/01 §1.3 "a student having multiple teachers"), so a second/third teacher taking over
// is a new assignment row, never a column update here.
@Entity('student_profiles')
export class StudentProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // A student under 13, or one whose guardian manages everything, may never have their own
  // login — docs/03 §3.4 "user_id (nullable — a student under 13 may have no login...)".
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user?: User | null;

  @ManyToOne(() => Institute, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'institute_id' })
  institute?: Institute | null;

  @Column({ name: 'full_name' })
  fullName: string;

  @Column({ type: 'date', nullable: true })
  dob?: string;

  @Column({ nullable: true })
  gender?: string;

  @Column({ name: 'avatar_url', nullable: true })
  avatarUrl?: string;

  @Column({ name: 'emergency_contact_name', nullable: true })
  emergencyContactName?: string;

  @Column({ name: 'emergency_contact_phone', nullable: true })
  emergencyContactPhone?: string;

  @Column({ name: 'medical_notes', type: 'text', nullable: true })
  medicalNotes?: string;

  @Column({ name: 'join_date', type: 'date' })
  joinDate: string;

  @Column({
    name: 'enrollment_status',
    type: 'varchar',
    default: EnrollmentStatus.ACTIVE,
  })
  enrollmentStatus: EnrollmentStatus;

  // docs/01 §1.5 "student leaving mid-month / rejoining" — every status transition is dated, so
  // "was this student active on <date>" stays answerable even across a leave-and-rejoin gap.
  @Column({ name: 'status_changed_at', type: 'timestamptz' })
  statusChangedAt: Date;

  @Column({ type: 'varchar', default: StudentSource.MANUAL })
  source: StudentSource;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  // Reserved for an actual erroneous-record removal (rare, admin-only) — routine "remove a
  // student" always goes through `enrollmentStatus = 'archived'` instead (docs/01 §1.3), never
  // this column. Kept for consistency with the rest of the schema's soft-delete convention.
  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt?: Date;
}
