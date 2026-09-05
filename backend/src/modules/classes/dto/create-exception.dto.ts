import { IsIn, IsOptional, IsString } from 'class-validator';
import { ScheduleExceptionType } from '../entities/schedule-exception.entity';

// docs/04 §4.4 POST /classes/:id/exceptions.
export class CreateExceptionDto {
  @IsString()
  occurrenceDate: string; // ISO date — which scheduled occurrence this overrides

  @IsIn([
    ScheduleExceptionType.HOLIDAY,
    ScheduleExceptionType.CANCELLED,
    ScheduleExceptionType.RESCHEDULED,
    ScheduleExceptionType.MAKEUP,
    ScheduleExceptionType.TEACHER_ABSENT,
    ScheduleExceptionType.EXTRA_CLASS,
  ])
  exceptionType: ScheduleExceptionType;

  @IsOptional()
  @IsString()
  newDate?: string;

  @IsOptional()
  @IsString()
  newStartTime?: string;

  @IsOptional()
  @IsString()
  newEndTime?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
