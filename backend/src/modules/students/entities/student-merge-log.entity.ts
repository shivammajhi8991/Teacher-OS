import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { StudentProfile } from './student-profile.entity';
import { User } from '../../users/entities/user.entity';

// docs/03 §3.4 `student_merge_log` — resolves "duplicate student records" (docs/01 §1.3) with an
// explicit, audited merge rather than a silent delete. The merged-away record is archived, never
// removed, so this log (plus its archived `student_profiles` row) is the durable trail of what
// got merged into what and why.
@Entity('student_merge_log')
export class StudentMergeLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => StudentProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'surviving_student_id' })
  survivingStudent: StudentProfile;

  @ManyToOne(() => StudentProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'merged_student_id' })
  mergedStudent: StudentProfile;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'merged_by' })
  mergedBy: User;

  @CreateDateColumn({ name: 'merged_at', type: 'timestamptz' })
  mergedAt: Date;

  @Column({ nullable: true })
  reason?: string;
}
