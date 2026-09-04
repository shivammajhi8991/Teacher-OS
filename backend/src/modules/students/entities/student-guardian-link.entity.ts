import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { StudentProfile } from './student-profile.entity';
import { Guardian } from './guardian.entity';

// docs/03 §3.4 `student_guardian_links` — many-to-many from day one (docs/01 §1.3 "multiple
// parents/guardians" and "one guardian → many children"), never a single FK on either side.
@Entity('student_guardian_links')
@Index(['student', 'guardian'], { unique: true })
export class StudentGuardianLink {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => StudentProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student: StudentProfile;

  @ManyToOne(() => Guardian, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'guardian_id' })
  guardian: Guardian;

  @Column({ name: 'is_primary', default: false })
  isPrimary: boolean;

  // docs/01 §1.3 "consent & minor-data handling" — explicit, not implied by the link existing.
  @Column({ name: 'consent_data_sharing', default: false })
  consentDataSharing: boolean;

  @Column({ name: 'consent_recorded_at', type: 'timestamptz', nullable: true })
  consentRecordedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
