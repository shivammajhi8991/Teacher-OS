import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Assignment } from './entities/assignment.entity';
import { AssignmentSubmission } from './entities/assignment-submission.entity';
import { Class } from '../classes/entities/class.entity';
import { Enrollment } from '../classes/entities/enrollment.entity';
import { StudentProfile } from '../students/entities/student-profile.entity';
import { StudentGuardianLink } from '../students/entities/student-guardian-link.entity';
import { AssignmentsService } from './assignments.service';
import { AssignmentsController } from './assignments.controller';
import { TeacherProfilesModule } from '../teacher-profiles/teacher-profiles.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { StorageModule } from '../../common/storage/storage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Assignment,
      AssignmentSubmission,
      // Read-only cross-references — see classes.module.ts's comment for the pattern.
      Class,
      Enrollment,
      StudentProfile,
      StudentGuardianLink,
    ]),
    TeacherProfilesModule,
    NotificationsModule,
    // Shared with Notes — see common/storage/storage.adapter.ts's header comment.
    StorageModule,
  ],
  controllers: [AssignmentsController],
  providers: [AssignmentsService],
  exports: [AssignmentsService],
})
export class AssignmentsModule {}
