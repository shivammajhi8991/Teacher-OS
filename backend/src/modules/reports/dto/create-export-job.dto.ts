import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { ReportFormat, ReportType } from '../entities/export-job.entity';

// docs/04 §4.7 `POST .../export-jobs` — the async counterpart of ReportQueryDto's two report
// types (attendance/fees only; see export-job.entity.ts's header comment for why students isn't
// one of these).
export class CreateExportJobDto {
  @IsIn([ReportType.ATTENDANCE, ReportType.FEES])
  reportType: ReportType;

  @IsIn([ReportFormat.PDF, ReportFormat.CSV])
  format: ReportFormat;

  @IsString()
  from: string;

  @IsString()
  to: string;

  @IsOptional()
  @IsUUID()
  instituteId?: string;
}
