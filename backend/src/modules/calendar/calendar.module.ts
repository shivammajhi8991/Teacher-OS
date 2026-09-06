import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Class } from '../classes/entities/class.entity';
import { ClassScheduleVersion } from '../classes/entities/class-schedule-version.entity';
import { Enrollment } from '../classes/entities/enrollment.entity';
import { Assignment } from '../assignments/entities/assignment.entity';
import { Invoice } from '../fees/entities/invoice.entity';
import { StudentProfile } from '../students/entities/student-profile.entity';
import { StudentGuardianLink } from '../students/entities/student-guardian-link.entity';
import { CalendarService } from './calendar.service';
import { CalendarController } from './calendar.controller';
import { TeacherProfilesModule } from '../teacher-profiles/teacher-profiles.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      // Read-only cross-references — see classes.module.ts's comment for the pattern. Calendar
      // has no entities of its own (see calendar.service.ts's header comment on why).
      Class,
      ClassScheduleVersion,
      Enrollment,
      Assignment,
      Invoice,
      StudentProfile,
      StudentGuardianLink,
    ]),
    TeacherProfilesModule,
  ],
  controllers: [CalendarController],
  providers: [CalendarService],
})
export class CalendarModule {}
