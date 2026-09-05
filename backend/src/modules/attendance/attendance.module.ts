import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttendanceSession } from './entities/attendance-session.entity';
import { AttendanceRecord } from './entities/attendance-record.entity';
import { AttendanceAuditLog } from './entities/attendance-audit-log.entity';
import { Class } from '../classes/entities/class.entity';
import { Institute } from '../institutes/entities/institute.entity';
import { ScheduleException } from '../classes/entities/schedule-exception.entity';
import { Enrollment } from '../classes/entities/enrollment.entity';
import { StudentProfile } from '../students/entities/student-profile.entity';
import { StudentGuardianLink } from '../students/entities/student-guardian-link.entity';
import { StudentTeacherAssignment } from '../students/entities/student-teacher-assignment.entity';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';
import { TeacherProfilesModule } from '../teacher-profiles/teacher-profiles.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AttendanceSession,
      AttendanceRecord,
      AttendanceAuditLog,
      // Read-only cross-references — Classes/Institutes/Students own writes to these; see
      // classes.module.ts's comment for why re-registering them here is the normal pattern.
      Class,
      Institute,
      ScheduleException,
      Enrollment,
      StudentProfile,
      StudentGuardianLink,
      StudentTeacherAssignment,
    ]),
    TeacherProfilesModule,
  ],
  controllers: [AttendanceController],
  providers: [AttendanceService],
  exports: [AttendanceService],
})
export class AttendanceModule {}
