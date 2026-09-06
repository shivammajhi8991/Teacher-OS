import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Assignment } from './assignment.entity';
import { StudentProfile } from '../../students/entities/student-profile.entity';
import { User } from '../../users/entities/user.entity';

export enum SubmissionStatus {
  SUBMITTED = 'submitted',
  REVIEWED = 'reviewed',
}

// docs/03 §3.8 `assignment_submissions`. No unique constraint on (assignment, student): when
// `Assignment.allowResubmission` is true, a resubmission is a NEW row with an incremented
// `attemptNumber`, never an overwrite of the previous attempt — matches this schema's
// audit-everywhere convention (every attempt stays a dated, attributable row, same reasoning as
// the credit ledger in fees).
@Entity('assignment_submissions')
@Index(['assignment', 'student'])
export class AssignmentSubmission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Assignment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'assignment_id' })
  assignment: Assignment;

  @ManyToOne(() => StudentProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student: StudentProfile;

  @Column({ name: 'attachment_urls', type: 'text', array: true, default: '{}' })
  attachmentUrls: string[];

  @CreateDateColumn({ name: 'submitted_at', type: 'timestamptz' })
  submittedAt: Date;

  @Column({ name: 'is_late', default: false })
  isLate: boolean;

  @Column({ name: 'attempt_number', default: 1 })
  attemptNumber: number;

  @Column({ type: 'varchar', default: SubmissionStatus.SUBMITTED })
  status: SubmissionStatus;

  // Deliberately an untyped, nullable string rather than a numeric column — docs/01 §1.4's
  // configurable-metrics idea (numeric/scale/pass-fail/text/percentage) applies here too, and a
  // full performance_metric_definitions-backed grading scheme is Phase 5's own separate
  // Performance-tracking item, not built yet; a free-form grade string ("A", "85/100", "Pass")
  // is the honest amount of structure until that lands.
  @Column({ nullable: true })
  grade?: string | null;

  @Column('text', { nullable: true })
  feedback?: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reviewed_by' })
  reviewedBy?: User | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt?: Date | null;
}
