import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TeacherProfile } from './teacher-profile.entity';
import { User } from '../../users/entities/user.entity';

export enum VerificationRequestStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

// docs/03 §3.2 `verification_requests` — docs/01 §1.2's point 6: "verification status" needs an
// actual admin-reviewed workflow, not a self-reported boolean. Review UI ships with the admin
// module (docs/07 Phase 5/6); this table + the submit endpoint exist now so a teacher can submit
// documents during onboarding without waiting on that.
@Entity('verification_requests')
export class VerificationRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => TeacherProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'teacher_profile_id' })
  teacherProfile: TeacherProfile;

  @Column({ name: 'document_urls', type: 'text', array: true })
  documentUrls: string[];

  @Column({ type: 'varchar', default: VerificationRequestStatus.PENDING })
  status: VerificationRequestStatus;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'reviewed_by' })
  reviewedBy?: User | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt?: Date | null;

  @Column({ name: 'rejection_reason', nullable: true })
  rejectionReason?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
