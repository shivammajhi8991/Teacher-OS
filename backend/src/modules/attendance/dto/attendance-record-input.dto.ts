import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { AttendanceStatus } from '../entities/attendance-record.entity';

const STATUSES = [
  AttendanceStatus.PRESENT,
  AttendanceStatus.ABSENT,
  AttendanceStatus.LATE,
  AttendanceStatus.EXCUSED,
  AttendanceStatus.HOLIDAY,
  AttendanceStatus.CANCELLED,
];

export class AttendanceRecordInputDto {
  @IsUUID()
  studentId: string;

  @IsIn(STATUSES)
  status: AttendanceStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}
