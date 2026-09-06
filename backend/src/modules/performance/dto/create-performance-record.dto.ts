import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreatePerformanceRecordDto {
  @IsUUID()
  studentId: string;

  @IsUUID()
  metricDefinitionId: string;

  @IsString()
  value: string;

  @IsOptional()
  @IsUUID()
  classId?: string;

  @IsOptional()
  @IsDateString()
  recordedAt?: string;
}
