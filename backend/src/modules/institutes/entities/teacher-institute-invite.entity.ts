import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Institute } from './institute.entity';
import { User } from '../../users/entities/user.entity';
import { TeacherProfile } from '../../teacher-profiles/entities/teacher-profile.entity';

// docs/08 §8.2 Institute Admin "Teachers list / detail: Roster, invite, verification status,
// payout config." Mirrors StudentInvite's shape (students/entities/student-invite.entity.ts) —
// a short-lived code, redeemed once. Redeeming sets the redeeming teacher's own
// `teacher_profile.institute` — it never creates a new profile (a teacher must already have
// completed onboarding, docs/07 Phase 4 step 2, before they can join an institute this way).
@Entity('teacher_institute_invites')
export class TeacherInstituteInvite {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Institute, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'institute_id' })
  institute: Institute;

  @Column({ unique: true })
  code: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'created_by' })
  createdBy: User;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'redeemed_at', type: 'timestamptz', nullable: true })
  redeemedAt?: Date | null;

  @ManyToOne(() => TeacherProfile, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'redeemed_by_teacher_profile_id' })
  redeemedByTeacherProfile?: TeacherProfile | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
