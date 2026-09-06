import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum ReportType {
  ATTENDANCE = 'attendance',
  FEES = 'fees',
}

export enum ReportFormat {
  PDF = 'pdf',
  CSV = 'csv',
}

export enum ExportJobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

// docs/04 §4.7 "Large exports run as an async job." Only attendance/fees go through this path —
// the per-student report (GET /reports/students/:id) is inherently bounded (one student), so it
// stays a plain synchronous GET, matching ReportsService's header comment on why student reports
// have no ExportJob counterpart. `instituteId` is stored as a plain column, not a real FK — it's
// a request parameter this job was created with (meaningful for super_admin drilling into one
// institute; ignored for teacher/institute_admin, whose scope is always their own), not a
// relationship to enforce referential integrity on.
@Entity('export_jobs')
export class ExportJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'requested_by' })
  requestedBy: User;

  @Column({ name: 'report_type', type: 'varchar' })
  reportType: ReportType;

  @Column({ type: 'varchar' })
  format: ReportFormat;

  @Column({ name: 'from_date', type: 'date' })
  fromDate: string;

  @Column({ name: 'to_date', type: 'date' })
  toDate: string;

  @Column({ name: 'institute_id', type: 'uuid', nullable: true })
  instituteId?: string | null;

  @Column({ type: 'varchar', default: ExportJobStatus.PENDING })
  status: ExportJobStatus;

  // `type: 'varchar'` is required, not decorative — a `string | null` union with no explicit
  // `type` makes TypeORM's reflection-based inference report `Object`, which Postgres rejects
  // outright at `migration:run` (`DataTypeNotSupportedError`), caught live running this exact
  // migration. This is the same bug class `AssignmentSubmission.grade` hit in Phase 5 step 2 —
  // every other nullable-string column in this codebase already declares its type explicitly;
  // this one didn't, until now.
  @Column({ name: 'object_key', type: 'varchar', nullable: true })
  objectKey?: string | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt?: Date | null;
}
