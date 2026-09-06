import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeacherCategory } from './entities/teacher-category.entity';
import { TeacherProfile } from './entities/teacher-profile.entity';
import { VerificationRequest } from './entities/verification-request.entity';
import { TeacherProfilesService } from './teacher-profiles.service';
import { TeacherProfilesController } from './teacher-profiles.controller';
import { TeacherCategoryAdminService } from './teacher-category-admin.service';
import { TeacherCategoryAdminController } from './teacher-category-admin.controller';
import { VerificationReviewService } from './verification-review.service';
import { VerificationReviewController } from './verification-review.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TeacherCategory,
      TeacherProfile,
      VerificationRequest,
    ]),
  ],
  controllers: [
    TeacherProfilesController,
    TeacherCategoryAdminController,
    VerificationReviewController,
  ],
  providers: [
    TeacherProfilesService,
    TeacherCategoryAdminService,
    VerificationReviewService,
  ],
  exports: [TeacherProfilesService],
})
export class TeacherProfilesModule {}
