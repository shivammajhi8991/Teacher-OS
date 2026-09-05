import { Test } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotificationsService } from './notifications.service';
import {
  Notification,
  NotificationChannel,
} from './entities/notification.entity';
import { NotificationPreference } from './entities/notification-preference.entity';
import {
  DevicePlatform,
  DevicePushToken,
} from './entities/device-push-token.entity';
import { PUSH_NOTIFICATION_ADAPTER } from './push/push-notification.adapter';
import { NotificationCategory } from './notifications.constants';

// docs/01 §1.3 "notification digesting / smart batching" is the interesting logic here: which
// channel a notify() call resolves to (preference override vs. category default), whether a push
// actually goes out (and to which devices), invalid-token pruning, and the digest batch's
// per-user grouping + delivered-count bookkeeping.
describe('NotificationsService', () => {
  let service: NotificationsService;
  const notificationRepo = {
    create: jest.fn((d) => d),
    save: jest.fn((d) => Promise.resolve({ id: 'notif-1', ...d })),
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
    update: jest.fn().mockResolvedValue({ affected: 0 }),
  };
  const preferenceRepo = {
    create: jest.fn((d) => d),
    save: jest.fn((d) => Promise.resolve(d)),
    findOne: jest.fn().mockResolvedValue(null),
    find: jest.fn().mockResolvedValue([]),
  };
  const deviceTokenRepo = {
    create: jest.fn((d) => d),
    save: jest.fn((d) => Promise.resolve(d)),
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    delete: jest.fn().mockResolvedValue({ affected: 0 }),
  };
  const pushAdapter = { send: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: getRepositoryToken(Notification),
          useValue: notificationRepo,
        },
        {
          provide: getRepositoryToken(NotificationPreference),
          useValue: preferenceRepo,
        },
        {
          provide: getRepositoryToken(DevicePushToken),
          useValue: deviceTokenRepo,
        },
        { provide: PUSH_NOTIFICATION_ADAPTER, useValue: pushAdapter },
      ],
    }).compile();

    service = module.get(NotificationsService);

    // Safe, explicit defaults — jest.clearAllMocks() drops call history but not a mock's
    // last-set resolved value, so every test below only overrides what it actually needs.
    preferenceRepo.findOne.mockResolvedValue(null);
    deviceTokenRepo.find.mockResolvedValue([]);
    deviceTokenRepo.findOne.mockResolvedValue(null);
    notificationRepo.update.mockResolvedValue({ affected: 0 });
    pushAdapter.send.mockResolvedValue({ successCount: 0, invalidTokens: [] });
  });

  describe('notify — channel resolution', () => {
    it('defaults an unregistered event type to the GENERAL category', async () => {
      await service.notify({
        userId: 'u1',
        type: 'something_unmapped',
        title: 't',
        body: 'b',
      });
      expect(preferenceRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            category: NotificationCategory.GENERAL,
          }),
        }),
      );
    });

    it("uses the category's default channel when the user has no preference row", async () => {
      preferenceRepo.findOne.mockResolvedValue(null);
      deviceTokenRepo.find.mockResolvedValue([{ token: 'tok-1' }]);
      pushAdapter.send.mockResolvedValue({
        successCount: 1,
        invalidTokens: [],
      });

      // 'payment_confirmed' → PAYMENT category → defaults to PUSH (docs/01 §1.3 "critical").
      await service.notify({
        userId: 'u1',
        type: 'payment_confirmed',
        title: 'Paid',
        body: 'Thanks',
      });

      expect(pushAdapter.send).toHaveBeenCalledWith(
        ['tok-1'],
        expect.objectContaining({ title: 'Paid' }),
      );
    });

    it("a user's explicit preference overrides the category default", async () => {
      preferenceRepo.findOne.mockResolvedValue({
        channel: NotificationChannel.DIGEST_DAILY,
      });

      await service.notify({
        userId: 'u1',
        type: 'payment_confirmed',
        title: 'Paid',
        body: 'Thanks',
      });

      // Chose digest instead of the PAYMENT category's PUSH default — no immediate push call.
      expect(pushAdapter.send).not.toHaveBeenCalled();
      expect(notificationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          deliveryChannel: NotificationChannel.DIGEST_DAILY,
        }),
      );
    });

    it('persists the in-app row even when the channel is push but the user has no device', async () => {
      preferenceRepo.findOne.mockResolvedValue({
        channel: NotificationChannel.PUSH,
      });
      deviceTokenRepo.find.mockResolvedValue([]);

      const result = await service.notify({
        userId: 'u1',
        type: 'general_thing',
        title: 't',
        body: 'b',
      });

      expect(result).toBeDefined();
      expect(pushAdapter.send).not.toHaveBeenCalled();
    });

    it("channel 'off' never calls the push adapter", async () => {
      preferenceRepo.findOne.mockResolvedValue({
        channel: NotificationChannel.OFF,
      });
      await service.notify({
        userId: 'u1',
        type: 'payment_confirmed',
        title: 't',
        body: 'b',
      });
      expect(pushAdapter.send).not.toHaveBeenCalled();
    });
  });

  describe('notify — invalid token pruning', () => {
    it('deletes device tokens the adapter reports as invalid after a push', async () => {
      preferenceRepo.findOne.mockResolvedValue({
        channel: NotificationChannel.PUSH,
      });
      deviceTokenRepo.find.mockResolvedValue([
        { token: 'tok-good' },
        { token: 'tok-stale' },
      ]);
      pushAdapter.send.mockResolvedValue({
        successCount: 1,
        invalidTokens: ['tok-stale'],
      });

      await service.notify({
        userId: 'u1',
        type: 'payment_confirmed',
        title: 't',
        body: 'b',
      });

      expect(deviceTokenRepo.delete).toHaveBeenCalledWith({
        token: expect.anything(),
      });
    });
  });

  describe('registerDeviceToken', () => {
    it('reassigns an existing token to a new user rather than erroring (shared/reset device)', async () => {
      const existing = {
        id: 'dt-1',
        token: 'tok-1',
        user: { id: 'old-user' },
        platform: DevicePlatform.ANDROID,
      };
      deviceTokenRepo.findOne.mockResolvedValue(existing);

      await service.registerDeviceToken(
        'new-user',
        'tok-1',
        DevicePlatform.IOS,
      );

      expect(deviceTokenRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'dt-1',
          user: { id: 'new-user' },
          platform: DevicePlatform.IOS,
        }),
      );
    });

    it('creates a new row when the token has never been seen', async () => {
      deviceTokenRepo.findOne.mockResolvedValue(null);
      await service.registerDeviceToken('u1', 'tok-new', DevicePlatform.WEB);
      expect(deviceTokenRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          token: 'tok-new',
          platform: DevicePlatform.WEB,
        }),
      );
    });
  });

  describe('markRead', () => {
    it("rejects marking someone else's notification", async () => {
      notificationRepo.findOne.mockResolvedValue({
        id: 'n1',
        user: { id: 'owner' },
        readAt: null,
      });
      await expect(
        service.markRead('n1', 'not-the-owner'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(notificationRepo.save).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for an unknown id', async () => {
      notificationRepo.findOne.mockResolvedValue(null);
      await expect(service.markRead('missing', 'u1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('is idempotent — marking an already-read notification again does not re-save', async () => {
      notificationRepo.findOne.mockResolvedValue({
        id: 'n1',
        user: { id: 'u1' },
        readAt: new Date('2026-01-01'),
      });
      await service.markRead('n1', 'u1');
      expect(notificationRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('getPreferences', () => {
    it('returns every known category with a default channel when nothing is set', async () => {
      preferenceRepo.find.mockResolvedValue([]);
      const result = await service.getPreferences('u1');
      expect(result).toEqual(
        expect.arrayContaining([
          {
            category: NotificationCategory.PAYMENT,
            channel: NotificationChannel.PUSH,
          },
          {
            category: NotificationCategory.FEE,
            channel: NotificationChannel.DIGEST_DAILY,
          },
        ]),
      );
    });

    it("reflects a user's stored preference over the default for that category", async () => {
      preferenceRepo.find.mockResolvedValue([
        {
          category: NotificationCategory.FEE,
          channel: NotificationChannel.OFF,
        },
      ]);
      const result = await service.getPreferences('u1');
      expect(result).toContainEqual({
        category: NotificationCategory.FEE,
        channel: NotificationChannel.OFF,
      });
    });
  });

  describe('runDigestBatch', () => {
    it('groups pending notifications by user and sends one push per user', async () => {
      notificationRepo.find.mockResolvedValue([
        { id: 'n1', user: { id: 'u1' }, title: 'A', body: 'a' },
        { id: 'n2', user: { id: 'u1' }, title: 'B', body: 'b' },
        { id: 'n3', user: { id: 'u2' }, title: 'C', body: 'c' },
      ]);
      deviceTokenRepo.find.mockResolvedValue([{ token: 'tok-1' }]);
      pushAdapter.send.mockResolvedValue({
        successCount: 1,
        invalidTokens: [],
      });

      const result = await service.runDigestBatch(
        NotificationChannel.DIGEST_DAILY,
      );

      expect(result.usersNotified).toBe(2);
      expect(result.notificationsDelivered).toBe(3); // 2 for u1 (one combined push) + 1 for u2
      expect(pushAdapter.send).toHaveBeenCalledTimes(2);
    });

    it("skips (but doesn't fail) a user with pending notifications but no registered device", async () => {
      notificationRepo.find.mockResolvedValue([
        { id: 'n1', user: { id: 'u1' }, title: 'A', body: 'a' },
      ]);
      deviceTokenRepo.find.mockResolvedValue([]);

      const result = await service.runDigestBatch(
        NotificationChannel.DIGEST_WEEKLY,
      );

      expect(result.usersNotified).toBe(1);
      expect(result.notificationsDelivered).toBe(0);
      expect(pushAdapter.send).not.toHaveBeenCalled();
    });
  });
});
