import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { PayoutsService } from './payouts.service';
import { SetPayoutPercentDto } from './dto/set-payout-percent.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';

// docs/01 §1.3 "Institute → Teacher revenue split," docs/08 §8.2 "payout config" /
// "Revenue/payouts | Teacher revenue-split summary | Reports".
@Controller()
export class PayoutsController {
  constructor(private readonly payoutsService: PayoutsService) {}

  @RequirePermission('payout.manage')
  @Patch('teacher-profiles/:id/payout-percent')
  setPayoutPercent(
    @Param('id') teacherProfileId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SetPayoutPercentDto,
  ) {
    return this.payoutsService.setPayoutPercent(
      teacherProfileId,
      user,
      dto.payoutPercent,
    );
  }

  @RequirePermission('payout.read')
  @Get('institute-teacher-payouts')
  listPayouts(@CurrentUser() user: AuthenticatedUser) {
    return this.payoutsService.listPayouts(user);
  }

  @RequirePermission('payout.manage')
  @Patch('institute-teacher-payouts/:id/mark-paid')
  markPaid(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.payoutsService.markPaid(id, user);
  }
}
