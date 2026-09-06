import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudentProfile } from './entities/student-profile.entity';
import { Guardian } from './entities/guardian.entity';
import { StudentGuardianLink } from './entities/student-guardian-link.entity';
import { StudentTeacherAssignment } from './entities/student-teacher-assignment.entity';
import { StudentMergeLog } from './entities/student-merge-log.entity';
import { StudentInvite } from './entities/student-invite.entity';
import { StudentImportJob } from './entities/student-import-job.entity';
import { StudentsService } from './students.service';
import { StudentsController } from './students.controller';
import { StudentImportService } from './student-import.service';
import { StudentImportController } from './student-import.controller';
import { TeacherProfilesModule } from '../teacher-profiles/teacher-profiles.module';

@Module({
  imports: [
    // Guardian and StudentMergeLog aren't injected as repositories in the service (all writes to
    // them go through the transactional EntityManager, see students.service.ts) but still need to
    // be registered here so TypeORM's metadata (autoLoadEntities, app.module.ts) picks them up.
    TypeOrmModule.forFeature([
      StudentProfile,
      Guardian,
      StudentGuardianLink,
      StudentTeacherAssignment,
      StudentMergeLog,
      StudentInvite,
      StudentImportJob,
    ]),
    TeacherProfilesModule,
  ],
  controllers: [StudentsController, StudentImportController],
  providers: [StudentsService, StudentImportService],
  exports: [StudentsService],
})
export class StudentsModule {}
