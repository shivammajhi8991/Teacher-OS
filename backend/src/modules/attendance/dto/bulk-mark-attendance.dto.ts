import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { AttendanceRecordInputDto } from './attendance-record-input.dto';

// docs/04 §4.4 POST /classes/:id/attendance/:date/bulk — docs/08 §8.3 Quick Attendance's Save.
export class BulkMarkAttendanceDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AttendanceRecordInputDto)
  records: AttendanceRecordInputDto[];
}
