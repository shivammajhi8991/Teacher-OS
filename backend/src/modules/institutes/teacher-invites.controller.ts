import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { TeacherInvitesService } from './teacher-invites.service';
import { CreateTeacherInviteDto } from './dto/create-teacher-invite.dto';
import { RedeemTeacherInviteDto } from './dto/redeem-teacher-invite.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';

@Controller()
export class TeacherInvitesController {
  constructor(private readonly teacherInvitesService: TeacherInvitesService) {}

  @RequirePermission('teacher_invite.manage')
  @Post('institutes/:id/teacher-invites')
  createInvite(
    @Param('id') instituteId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTeacherInviteDto,
  ) {
    return this.teacherInvitesService.createInvite(instituteId, user, dto);
  }

  @RequirePermission('teacher_invite.manage')
  @Get('institutes/:id/teacher-invites')
  listInvites(
    @Param('id') instituteId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.teacherInvitesService.listInvites(instituteId, user);
  }

  @RequirePermission('teacher_invite.redeem')
  @Post('teacher-invites/redeem')
  redeemInvite(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RedeemTeacherInviteDto,
  ) {
    return this.teacherInvitesService.redeemInvite(user, dto.code);
  }
}
