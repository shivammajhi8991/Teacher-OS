import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum StudentImportJobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export interface StudentImportRowError {
  row: number; // 1-indexed, counting the header as row 1 (so row 2 is the first data row)
  message: string;
}

// docs/04 §4.4 `POST /students/import` "CSV, async job — returns job id, see 4.7" — an addition
// beyond docs/03's schema sketch (which never named a table for this), mirroring
// reports/entities/export-job.entity.ts's shape and reasoning: no BullMQ/Redis is wired up
// anywhere in this codebase, so the job row is created and returned immediately, and the real
// work runs via a fire-and-forget async call in this same process right after. `errors` is a
// per-row failure list (docs/04 §4.7 "gives every bulk operation a natural retry point if it
// fails partway") — one malformed row never aborts the whole import, matching how this codebase
// treats every other partial-failure case (a failed notification doesn't roll back its triggering
// write, an unparseable schedule rule returns no occurrences rather than throwing mid-request).
@Entity('student_import_jobs')
export class StudentImportJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'requested_by' })
  requestedBy: User;

  @Column({ type: 'varchar', default: StudentImportJobStatus.PENDING })
  status: StudentImportJobStatus;

  @Column({ name: 'total_rows', type: 'int', default: 0 })
  totalRows: number;

  @Column({ name: 'success_count', type: 'int', default: 0 })
  successCount: number;

  @Column({ name: 'failure_count', type: 'int', default: 0 })
  failureCount: number;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  errors: StudentImportRowError[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt?: Date | null;
}
