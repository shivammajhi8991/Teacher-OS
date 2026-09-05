import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Class } from './entities/class.entity';
import { ClassScheduleVersion } from './entities/class-schedule-version.entity';
import { ScheduleException } from './entities/schedule-exception.entity';
import { Enrollment } from './entities/enrollment.entity';
import { WaitlistEntry } from './entities/waitlist-entry.entity';
import { StudentProfile } from '../students/entities/student-profile.entity';
import { ClassesService } from './classes.service';
import { ClassesController } from './classes.controller';
import { TeacherProfilesModule } from '../teacher-profiles/teacher-profiles.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Class,
      ClassScheduleVersion,
      ScheduleException,
      Enrollment,
      WaitlistEntry,
      // Read-only cross-reference (existence checks for enrollment/waitlist) — StudentsModule
      // owns writes to this entity; registering it here too is the normal TypeORM/Nest pattern
      // for a module that only ever reads another module's entity.
      StudentProfile,
    ]),
    TeacherProfilesModule,
  ],
  controllers: [ClassesController],
  providers: [ClassesService],
  exports: [ClassesService],
})
export class ClassesModule {}
