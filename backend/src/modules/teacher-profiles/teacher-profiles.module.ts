import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeacherCategory } from './entities/teacher-category.entity';
import { TeacherProfile } from './entities/teacher-profile.entity';
import { VerificationRequest } from './entities/verification-request.entity';
import { TeacherProfilesService } from './teacher-profiles.service';
import { TeacherProfilesController } from './teacher-profiles.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TeacherCategory,
      TeacherProfile,
      VerificationRequest,
    ]),
  ],
  controllers: [TeacherProfilesController],
  providers: [TeacherProfilesService],
  exports: [TeacherProfilesService],
})
export class TeacherProfilesModule {}
