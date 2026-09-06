import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { ReportFormat } from '../entities/export-job.entity';

// docs/04 §4.4 `GET /reports/attendance?scope=&from=&to=&format=`, `GET /reports/fees?...` —
// `scope` is replaced here by an optional `instituteId` rather than the doc's single composite
// `scope=` string: a teacher's and an institute_admin's scope is always "their own" (resolved
// server-side from the caller, never client-supplied — same as every other module's resource-
// level scoping in this codebase), so the only role that ever needs to name a scope explicitly
// is super_admin drilling into one institute; omitting it there means platform-wide. A single
// well-typed optional field says that more clearly than a composite string would.
export class ReportQueryDto {
  @IsString()
  from: string; // ISO date

  @IsString()
  to: string; // ISO date

  @IsIn([ReportFormat.PDF, ReportFormat.CSV])
  format: ReportFormat;

  @IsOptional()
  @IsUUID()
  instituteId?: string;
}
