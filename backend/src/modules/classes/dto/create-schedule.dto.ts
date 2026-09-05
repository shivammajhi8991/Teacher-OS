import { IsOptional, IsString, Matches } from 'class-validator';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

// docs/04 §4.4 POST /classes/:id/schedule — creates a new class_schedule_versions row (docs/03
// §3.5); the service closes out the previous current version's `effectiveTo`, this DTO never
// carries one.
export class CreateScheduleDto {
  @IsString()
  effectiveFrom: string; // ISO date

  @IsString()
  recurrenceRule: string; // RFC 5545 RRULE, e.g. "FREQ=WEEKLY;BYDAY=MO,WE,FR" — validated server-side

  @Matches(TIME_PATTERN, { message: 'startTime must be HH:mm or HH:mm:ss' })
  startTime: string;

  @Matches(TIME_PATTERN, { message: 'endTime must be HH:mm or HH:mm:ss' })
  endTime: string;

  @IsOptional()
  @IsString()
  timezone?: string;
}
