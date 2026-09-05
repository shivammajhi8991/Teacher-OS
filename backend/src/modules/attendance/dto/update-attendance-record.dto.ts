import { IsIn, IsOptional, IsString } from 'class-validator';
import { AttendanceStatus } from '../entities/attendance-record.entity';

// docs/04 §4.4 PATCH /attendance-records/:id. `reason` is required (not optional) — docs/01 §1.5
// wants every post-initial-mark edit to say why, since it's exactly the kind of change that
// might need explaining later (a parent disputing a mark, or a fee recalculation once Fees ships).
export class UpdateAttendanceRecordDto {
  @IsIn([
    AttendanceStatus.PRESENT,
    AttendanceStatus.ABSENT,
    AttendanceStatus.LATE,
    AttendanceStatus.EXCUSED,
    AttendanceStatus.HOLIDAY,
    AttendanceStatus.CANCELLED,
  ])
  status: AttendanceStatus;

  @IsString()
  reason: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
