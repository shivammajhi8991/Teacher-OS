import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import {
  Notification,
  NotificationChannel,
} from './entities/notification.entity';
import { NotificationPreference } from './entities/notification-preference.entity';
import {
  DevicePlatform,
  DevicePushToken,
} from './entities/device-push-token.entity';
import { User } from '../users/entities/user.entity';
import {
  PUSH_NOTIFICATION_ADAPTER,
  PushNotificationAdapter,
} from './push/push-notification.adapter';
import {
  DEFAULT_CHANNEL_BY_CATEGORY,
  NOTIFICATION_TYPE_CATEGORY,
  NotificationCategory,
} from './notifications.constants';

export interface NotifyParams {
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface PreferenceSummary {
  category: NotificationCategory;
  channel: NotificationChannel;
}

// docs/03 §3.8 (notifications half). Called by other modules (FeesService, NotesService, ...)
// whenever something notification-worthy happens to one user — see notify() below for the
// always-persist-in-app, sometimes-also-push behavior docs/01 §1.3 describes.
@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @InjectRepository(NotificationPreference)
    private readonly preferenceRepo: Repository<NotificationPreference>,
    @InjectRepository(DevicePushToken)
    private readonly deviceTokenRepo: Repository<DevicePushToken>,
    @Inject(PUSH_NOTIFICATION_ADAPTER)
    private readonly pushAdapter: PushNotificationAdapter,
  ) {}

  // Always persists an in-app row regardless of the resolved channel — GET /notifications (the
  // notification center) never depends on push having succeeded, or even having been attempted.
  async notify(params: NotifyParams): Promise<Notification> {
    const category =
      NOTIFICATION_TYPE_CATEGORY[params.type] ?? NotificationCategory.GENERAL;
    const channel = await this.resolveChannel(params.userId, category);

    const notification = await this.notificationRepo.save(
      this.notificationRepo.create({
        user: { id: params.userId } as User,
        type: params.type,
        title: params.title,
        body: params.body,
        data: params.data ?? null,
        deliveryChannel: channel,
      }),
    );

    if (channel === NotificationChannel.PUSH) {
      await this.pushNow([notification]);
    }
    // digest_daily/digest_weekly: left pending (deliveredAt null) for the next scheduled batch —
    // see runDigestBatch(). 'off' and 'email' (not implemented, see notification.entity.ts):
    // in-app only, nothing more happens.
    return notification;
  }

  private async resolveChannel(
    userId: string,
    category: NotificationCategory,
  ): Promise<NotificationChannel> {
    const preference = await this.preferenceRepo.findOne({
      where: { user: { id: userId }, category },
    });
    return preference?.channel ?? DEFAULT_CHANNEL_BY_CATEGORY[category];
  }

  // Sends one push covering all of `notifications` (assumed to all belong to the same user —
  // notify() calls this with a single notification, runDigestBatch() with one user's whole
  // pending batch) and marks them delivered. Returns how many were actually delivered (0 if the
  // user has no registered device — the in-app row still exists, there's just nothing more to
  // do without a token).
  private async pushNow(notifications: Notification[]): Promise<number> {
    if (notifications.length === 0) return 0;
    const userId = notifications[0].user.id;
    const tokens = await this.deviceTokenRepo.find({
      where: { user: { id: userId } },
    });
    if (tokens.length === 0) return 0;

    const payload =
      notifications.length === 1
        ? { title: notifications[0].title, body: notifications[0].body }
        : {
            title: `${notifications.length} new updates`,
            body: notifications.map((n) => n.title).join(', '),
          };

    const result = await this.pushAdapter.send(
      tokens.map((t) => t.token),
      { ...payload, data: { count: String(notifications.length) } },
    );

    if (result.invalidTokens.length > 0) {
      await this.deviceTokenRepo.delete({
        token: In(result.invalidTokens),
      });
    }

    await this.notificationRepo.update(
      { id: In(notifications.map((n) => n.id)) },
      { deliveredAt: new Date() },
    );
    return notifications.length;
  }

  // ---------------------------------------------------------------- Notification center -------

  async listNotifications(
    userId: string,
    filters: { unreadOnly?: boolean },
  ): Promise<Notification[]> {
    return this.notificationRepo.find({
      where: {
        user: { id: userId },
        ...(filters.unreadOnly ? { readAt: IsNull() } : {}),
      },
      order: { createdAt: 'DESC' },
    });
  }

  async markRead(id: string, userId: string): Promise<Notification> {
    const notification = await this.notificationRepo.findOne({
      where: { id },
      relations: { user: true },
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        data: true,
        deliveryChannel: true,
        deliveredAt: true,
        readAt: true,
        createdAt: true,
        user: { id: true },
      },
    });
    if (!notification) {
      throw new NotFoundException({
        code: 'NOTIFICATION_NOT_FOUND',
        message: `Notification ${id} not found`,
      });
    }
    if (notification.user.id !== userId) {
      throw new ForbiddenException({
        code: 'NOT_AUTHORIZED_FOR_NOTIFICATION',
        message: 'This notification does not belong to you',
      });
    }
    if (!notification.readAt) {
      notification.readAt = new Date();
      await this.notificationRepo.save(notification);
    }
    return notification;
  }

  async markAllRead(userId: string): Promise<{ updated: number }> {
    const result = await this.notificationRepo.update(
      { user: { id: userId }, readAt: IsNull() },
      { readAt: new Date() },
    );
    return { updated: result.affected ?? 0 };
  }

  // ---------------------------------------------------------------- Preferences ----------------

  async getPreferences(userId: string): Promise<PreferenceSummary[]> {
    const rows = await this.preferenceRepo.find({
      where: { user: { id: userId } },
    });
    const byCategory = new Map(rows.map((r) => [r.category, r.channel]));
    return Object.values(NotificationCategory).map((category) => ({
      category,
      channel:
        byCategory.get(category) ?? DEFAULT_CHANNEL_BY_CATEGORY[category],
    }));
  }

  async updatePreference(
    userId: string,
    category: NotificationCategory,
    channel: NotificationChannel,
  ): Promise<void> {
    const existing = await this.preferenceRepo.findOne({
      where: { user: { id: userId }, category },
    });
    if (existing) {
      existing.channel = channel;
      await this.preferenceRepo.save(existing);
      return;
    }
    await this.preferenceRepo.save(
      this.preferenceRepo.create({
        user: { id: userId } as User,
        category,
        channel,
      }),
    );
  }

  // ---------------------------------------------------------------- Device tokens --------------

  // A token is unique across the whole table (see device-push-token.entity.ts) — re-registering
  // one already on file for a *different* user reassigns ownership rather than erroring, since a
  // real FCM token belongs to whichever app install currently holds it (shared device, or a
  // factory-reset-then-re-login under a new account).
  async registerDeviceToken(
    userId: string,
    token: string,
    platform: DevicePlatform,
  ): Promise<void> {
    const existing = await this.deviceTokenRepo.findOne({ where: { token } });
    if (existing) {
      existing.user = { id: userId } as User;
      existing.platform = platform;
      await this.deviceTokenRepo.save(existing);
      return;
    }
    await this.deviceTokenRepo.save(
      this.deviceTokenRepo.create({
        user: { id: userId } as User,
        token,
        platform,
      }),
    );
  }

  // ---------------------------------------------------------------- Digest batching -------------

  // docs/01 §1.3 "notification digesting / smart batching," triggered by NotificationsScheduler's
  // @Cron (in-process, via @nestjs/schedule — no Redis/BullMQ needed here, see
  // notifications.module.ts's comment for why that's the right scope for this pass). Pure,
  // directly unit-testable: group every still-pending row for this channel by user, send one
  // push per user, and mark whatever was actually delivered.
  async runDigestBatch(
    channel:
      NotificationChannel.DIGEST_DAILY | NotificationChannel.DIGEST_WEEKLY,
  ): Promise<{ usersNotified: number; notificationsDelivered: number }> {
    const pending = await this.notificationRepo.find({
      where: { deliveryChannel: channel, deliveredAt: IsNull() },
      relations: { user: true },
      order: { createdAt: 'ASC' },
    });

    const byUser = new Map<string, Notification[]>();
    for (const notification of pending) {
      const list = byUser.get(notification.user.id) ?? [];
      list.push(notification);
      byUser.set(notification.user.id, list);
    }

    let notificationsDelivered = 0;
    for (const notifications of byUser.values()) {
      notificationsDelivered += await this.pushNow(notifications);
    }
    return { usersNotified: byUser.size, notificationsDelivered };
  }
}
