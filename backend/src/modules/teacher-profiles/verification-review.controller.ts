import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { VerificationReviewService } from './verification-review.service';
import { ReviewVerificationRequestDto } from './dto/review-verification-request.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';

// docs/08 §8.2 Admin Web Panel "Verification queue | Review submitted docs, approve/reject with
// reason." `POST .../verification-request` (submit) stays permission-open to any teacher on
// `TeacherProfilesController`; the review side is its own controller, gated separately.
@Controller()
export class VerificationReviewController {
  constructor(
    private readonly verificationReviewService: VerificationReviewService,
  ) {}

  @RequirePermission('verification.review')
  @Get('verification-requests')
  listQueue() {
    return this.verificationReviewService.listQueue();
  }

  @RequirePermission('verification.review')
  @Patch('verification-requests/:id')
  review(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReviewVerificationRequestDto,
  ) {
    return this.verificationReviewService.review(id, user, dto);
  }
}
