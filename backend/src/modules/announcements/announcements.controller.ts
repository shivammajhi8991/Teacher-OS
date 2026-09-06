import { Body, Controller, Get, Post } from '@nestjs/common';
import { AnnouncementsService } from './announcements.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';

// docs/04 §4.4 "Communication / Notifications / Calendar" (announcements half), docs/06 §6.2.
@Controller('announcements')
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @RequirePermission('announcement.manage')
  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAnnouncementDto,
  ) {
    return this.announcementsService.createAnnouncement(user, dto);
  }

  @RequirePermission('announcement.read')
  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.announcementsService.listAnnouncements(user);
  }
}
