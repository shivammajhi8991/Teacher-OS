import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Announcement } from './entities/announcement.entity';
import { Class } from '../classes/entities/class.entity';
import { Enrollment } from '../classes/entities/enrollment.entity';
import { StudentProfile } from '../students/entities/student-profile.entity';
import { StudentGuardianLink } from '../students/entities/student-guardian-link.entity';
import { AnnouncementsService } from './announcements.service';
import { AnnouncementsController } from './announcements.controller';
import { TeacherProfilesModule } from '../teacher-profiles/teacher-profiles.module';

// docs/04 §4.7 "bulk notification fan-out is async" — an INSTITUTE or PLATFORM announcement can
// reach a large audience, so this module deliberately does NOT call NotificationsService.notify()
// per-recipient on creation (unlike Fees/Notes/Assignments' single- or few-recipient cases); a
// real fan-out belongs on a queued job, not a synchronous loop in the request path. Read
// (`GET /announcements`) already surfaces new ones without it — this is a documented scope
// boundary, not an oversight.
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Announcement,
      // Read-only cross-references — see classes.module.ts's comment for the pattern.
      Class,
      Enrollment,
      StudentProfile,
      StudentGuardianLink,
    ]),
    TeacherProfilesModule,
  ],
  controllers: [AnnouncementsController],
  providers: [AnnouncementsService],
  exports: [AnnouncementsService],
})
export class AnnouncementsModule {}
