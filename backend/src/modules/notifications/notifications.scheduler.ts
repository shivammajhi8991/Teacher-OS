import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationsService } from './notifications.service';
import { NotificationChannel } from './entities/notification.entity';

// docs/01 §1.3 "notification digesting / smart batching" — the actual trigger for
// NotificationsService.runDigestBatch(). In-process cron (@nestjs/schedule) rather than a BullMQ
// repeatable job is a deliberate scope choice for this pass: no Redis is wired up anywhere in
// this codebase yet (config carries a `redisUrl` placeholder, nothing actually connects), and
// docs/02 §2.5 itself frames BullMQ as a *scale* concern ("move the heaviest module into its own
// deployable") rather than something MVP correctness needs — a real, tested, directly-callable
// batching method behind an in-process schedule is the honest amount of infrastructure for this
// stage; moving the trigger to a BullMQ repeatable job later doesn't change
// NotificationsService.runDigestBatch() at all.
@Injectable()
export class NotificationsScheduler {
  private readonly logger = new Logger(NotificationsScheduler.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async runDailyDigest(): Promise<void> {
    const result = await this.notificationsService.runDigestBatch(
      NotificationChannel.DIGEST_DAILY,
    );
    this.logger.log(
      `Daily digest: ${result.usersNotified} user(s), ${result.notificationsDelivered} notification(s) delivered`,
    );
  }

  @Cron(CronExpression.EVERY_WEEK)
  async runWeeklyDigest(): Promise<void> {
    const result = await this.notificationsService.runDigestBatch(
      NotificationChannel.DIGEST_WEEKLY,
    );
    this.logger.log(
      `Weekly digest: ${result.usersNotified} user(s), ${result.notificationsDelivered} notification(s) delivered`,
    );
  }
}
