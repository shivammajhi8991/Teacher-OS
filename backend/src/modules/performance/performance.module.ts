import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PerformanceMetricDefinition } from './entities/performance-metric-definition.entity';
import { PerformanceRecord } from './entities/performance-record.entity';
import { TeacherCategory } from '../teacher-profiles/entities/teacher-category.entity';
import { TeacherProfile } from '../teacher-profiles/entities/teacher-profile.entity';
import { StudentProfile } from '../students/entities/student-profile.entity';
import { StudentGuardianLink } from '../students/entities/student-guardian-link.entity';
import { StudentTeacherAssignment } from '../students/entities/student-teacher-assignment.entity';
import { Class } from '../classes/entities/class.entity';
import { PerformanceService } from './performance.service';
import { PerformanceController } from './performance.controller';
import { TeacherProfilesModule } from '../teacher-profiles/teacher-profiles.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PerformanceMetricDefinition,
      PerformanceRecord,
      // Read-only cross-references — see classes.module.ts's comment for the pattern.
      TeacherCategory,
      TeacherProfile,
      StudentProfile,
      StudentGuardianLink,
      StudentTeacherAssignment,
      Class,
    ]),
    TeacherProfilesModule,
  ],
  controllers: [PerformanceController],
  providers: [PerformanceService],
  exports: [PerformanceService],
})
export class PerformanceModule {}
