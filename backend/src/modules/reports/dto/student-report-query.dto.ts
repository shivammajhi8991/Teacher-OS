import { IsIn } from 'class-validator';
import { ReportFormat } from '../entities/export-job.entity';

// docs/04 §4.4 `GET /reports/students/:id?format=pdf` — the doc only ever shows `pdf` for this
// one; a consolidated one-student profile snapshot doesn't have an obviously useful tabular/CSV
// shape the way attendance/fees rows do, so `csv` is rejected here rather than built and left
// unused.
export class StudentReportQueryDto {
  @IsIn([ReportFormat.PDF])
  format: ReportFormat;
}
