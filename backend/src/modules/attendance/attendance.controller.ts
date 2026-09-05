import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { BulkMarkAttendanceDto } from './dto/bulk-mark-attendance.dto';
import { UpdateAttendanceRecordDto } from './dto/update-attendance-record.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';

// docs/04 §4.4 "Attendance". QR/location-based check-in (spec §5 "Advanced features") is
// deliberately not built in this pass — see docs/07 Phase 4 step 5 for the reasoning; every
// route here covers the roster/bulk-mark/edit/history surface that docs/08 §8.3's Quick
// Attendance flow actually needs.
@Controller()
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @RequirePermission('attendance.mark')
  @Get('classes/:id/attendance/:date')
  getRoster(
    @Param('id') classId: string,
    @Param('date') date: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attendanceService.getRoster(classId, date, user);
  }

  @RequirePermission('attendance.mark')
  @Post('classes/:id/attendance/:date/bulk')
  bulkMark(
    @Param('id') classId: string,
    @Param('date') date: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: BulkMarkAttendanceDto,
  ) {
    return this.attendanceService.bulkMark(classId, date, user, dto);
  }

  @RequirePermission('attendance.mark')
  @Patch('attendance-records/:id')
  updateRecord(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateAttendanceRecordDto,
  ) {
    return this.attendanceService.updateRecord(id, user, dto);
  }

  @RequirePermission('attendance.read')
  @Get('students/:id/attendance')
  getStudentAttendance(
    @Param('id') studentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.attendanceService.getStudentAttendance(studentId, user, {
      from,
      to,
    });
  }
}
