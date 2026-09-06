import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { TeacherProfilesService } from './teacher-profiles.service';
import { CreateTeacherProfileDto } from './dto/create-teacher-profile.dto';
import { UpdateTeacherProfileDto } from './dto/update-teacher-profile.dto';
import { SubmitVerificationDto } from './dto/submit-verification.dto';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';

// docs/04 §4.4 "Teacher profile", docs/08 §8.5 "Teacher onboarding" flow.
@Controller()
export class TeacherProfilesController {
  constructor(
    private readonly teacherProfilesService: TeacherProfilesService,
  ) {}

  @Public()
  @Get('teacher-categories')
  listCategories() {
    return this.teacherProfilesService.listCategories();
  }

  @RequirePermission('teacher_profile.manage')
  @Post('teacher-profiles')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTeacherProfileDto,
  ) {
    return this.teacherProfilesService.createProfile(user.userId, dto);
  }

  // docs/06 §6.2 — teacher_profile.read is granted to every role, so any authenticated user can
  // view a teacher's profile; only the owner can write to it (enforced in the service, not here).
  @RequirePermission('teacher_profile.read')
  @Get('teacher-profiles/:id')
  findOne(@Param('id') id: string) {
    return this.teacherProfilesService.findById(id);
  }

  @RequirePermission('teacher_profile.manage')
  @Patch('teacher-profiles/:id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateTeacherProfileDto,
  ) {
    return this.teacherProfilesService.update(id, user.userId, dto);
  }

  @RequirePermission('teacher_profile.manage')
  @Post('teacher-profiles/:id/verification-request')
  submitVerification(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SubmitVerificationDto,
  ) {
    return this.teacherProfilesService.submitVerificationRequest(
      id,
      user.userId,
      dto,
    );
  }

  // docs/08 §8.2 Institute Admin "Teachers list ... Roster" — lives here (not
  // InstitutesController) the same way FeesController's `institutes/:id/revenue-summary`
  // does: the module that owns the underlying data owns the institute-scoped read of it.
  @RequirePermission('teacher_profile.read')
  @Get('institutes/:id/teachers')
  listByInstitute(
    @Param('id') instituteId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.teacherProfilesService.listByInstitute(instituteId, user);
  }
}
