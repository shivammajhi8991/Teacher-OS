import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { RegisterDeviceTokenDto } from './dto/register-device-token.dto';
import { UpdateNotificationPreferenceDto } from './dto/update-notification-preference.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';

// docs/04 §4.4 "Communication / Notifications" — note there's no @RequirePermission anywhere in
// this controller: every route here operates on the caller's own data (their notifications,
// their preferences, their own device), the same "authenticated is enough" pattern already used
// for /auth/me (see permissions.guard.ts's no-op-without-a-decorator behavior).
//
// Route surface is a documented refinement of docs/04's sketch ("GET/PATCH /notifications"):
// mark-one and mark-all-read are separate PATCH routes rather than one generic PATCH taking a
// body, for clearer REST semantics — the same kind of concrete-ization every prior module did to
// its doc sketch.
@Controller()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('device-tokens')
  registerDeviceToken(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RegisterDeviceTokenDto,
  ) {
    return this.notificationsService.registerDeviceToken(
      user.userId,
      dto.token,
      dto.platform,
    );
  }

  @Get('notifications')
  listNotifications(
    @CurrentUser() user: AuthenticatedUser,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    return this.notificationsService.listNotifications(user.userId, {
      unreadOnly: unreadOnly === 'true',
    });
  }

  @Patch('notifications/read-all')
  markAllRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.markAllRead(user.userId);
  }

  @Patch('notifications/:id/read')
  markRead(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.markRead(id, user.userId);
  }

  @Get('notification-preferences')
  getPreferences(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.getPreferences(user.userId);
  }

  @Patch('notification-preferences')
  updatePreference(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateNotificationPreferenceDto,
  ) {
    return this.notificationsService.updatePreference(
      user.userId,
      dto.category,
      dto.channel,
    );
  }
}
