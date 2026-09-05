import { IsIn } from 'class-validator';
import { NotificationChannel } from '../entities/notification.entity';
import { NotificationCategory } from '../notifications.constants';

// docs/04 §4.4 PATCH /notification-preferences — one category's channel per call.
export class UpdateNotificationPreferenceDto {
  @IsIn(Object.values(NotificationCategory))
  category: NotificationCategory;

  @IsIn(Object.values(NotificationChannel))
  channel: NotificationChannel;
}
