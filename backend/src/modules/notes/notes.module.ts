import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Document } from './entities/document.entity';
import { DocumentShare } from './entities/document-share.entity';
import { DocumentAccessLog } from './entities/document-access-log.entity';
import { Class } from '../classes/entities/class.entity';
import { Enrollment } from '../classes/entities/enrollment.entity';
import { StudentProfile } from '../students/entities/student-profile.entity';
import { StudentGuardianLink } from '../students/entities/student-guardian-link.entity';
import { StudentTeacherAssignment } from '../students/entities/student-teacher-assignment.entity';
import { NotesService } from './notes.service';
import { NotesController } from './notes.controller';
import { TeacherProfilesModule } from '../teacher-profiles/teacher-profiles.module';
import { STORAGE_ADAPTER } from './storage/storage.adapter';
import { LocalDiskStorageAdapter } from './storage/local-disk-storage.adapter';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Document,
      DocumentShare,
      DocumentAccessLog,
      // Read-only cross-references — see classes.module.ts's comment for the pattern.
      Class,
      Enrollment,
      StudentProfile,
      StudentGuardianLink,
      StudentTeacherAssignment,
    ]),
    TeacherProfilesModule,
  ],
  controllers: [NotesController],
  providers: [
    NotesService,
    // No cloud storage account exists for this project — see storage/storage.adapter.ts.
    // Swapping in a real S3/R2 adapter later is a one-line DI change here.
    { provide: STORAGE_ADAPTER, useClass: LocalDiskStorageAdapter },
  ],
  exports: [NotesService],
})
export class NotesModule {}
