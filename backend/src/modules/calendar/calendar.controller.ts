import { Controller, Get, Query } from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { CalendarQueryDto } from './dto/calendar-query.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';

// docs/04 §4.4 `GET /calendar?from=&to=&ownerType=&ownerId=`. docs/06 §6.2 grants `calendar.read`
// (this migration's own name for the permission) to every role — the actual scope (own, own
// institute, or explicit class/institute lookup) is resolved inside CalendarService.
@Controller()
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @RequirePermission('calendar.read')
  @Get('calendar')
  getCalendar(
    @Query() query: CalendarQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.calendarService.getCalendar(user, query);
  }
}
