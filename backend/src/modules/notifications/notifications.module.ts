import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationPreference } from './entities/notification-preference.entity';
import { DevicePushToken } from './entities/device-push-token.entity';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsScheduler } from './notifications.scheduler';
import { PUSH_NOTIFICATION_ADAPTER } from './push/push-notification.adapter';
import { MockPushNotificationAdapter } from './push/mock-push-notification.adapter';

// ScheduleModule.forRoot() is registered once in AppModule (Nest's own recommended pattern —
// @Cron/@Interval/@Timeout decorators are discovered app-wide regardless of which module the
// provider carrying them lives in), not here.
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Notification,
      NotificationPreference,
      DevicePushToken,
    ]),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsScheduler,
    // No Firebase project exists for this codebase — see push/push-notification.adapter.ts.
    // Swapping in a real Admin-SDK-backed adapter later is a one-line change here.
    {
      provide: PUSH_NOTIFICATION_ADAPTER,
      useClass: MockPushNotificationAdapter,
    },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
