import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TeacherProfile } from '../../teacher-profiles/entities/teacher-profile.entity';
import { Institute } from '../../institutes/entities/institute.entity';
import { StudentProfile } from './student-profile.entity';

export enum StudentInviteStatus {
  PENDING = 'pending',
  USED = 'used',
  EXPIRED = 'expired',
  REVOKED = 'revoked',
}

// Addition beyond docs/03's original table list — the spec (and docs/08 §8.5 "Student invite")
// calls for "invite students using a link/code," which needs somewhere to live. This pass only
// implements code *generation* (POST /students/invite); the *redemption* side (a student opening
// the link, registering, and landing in a teacher-confirm queue as `enrollments.status =
// 'pending'`, per docs/08 §8.5) is a documented follow-up — it depends on `enrollments`, which
// belongs to the Classes module (docs/07 Phase 4 step 4), not this one.
@Entity('student_invites')
export class StudentInvite {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  code: string;

  @ManyToOne(() => TeacherProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'created_by_teacher_id' })
  createdByTeacher: TeacherProfile;

  @ManyToOne(() => Institute, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'institute_id' })
  institute?: Institute | null;

  @Column({ type: 'varchar', default: StudentInviteStatus.PENDING })
  status: StudentInviteStatus;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt?: Date | null;

  @ManyToOne(() => StudentProfile, { nullable: true })
  @JoinColumn({ name: 'used_by_student_id' })
  usedByStudent?: StudentProfile | null;

  @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
  usedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
