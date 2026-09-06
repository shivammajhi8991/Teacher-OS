import { NotificationChannel } from './entities/notification.entity';

// docs/01 §1.3 "notification digesting / smart batching." A small, fixed set — see
// notification-preference.entity.ts for why this isn't an admin-extensible table.
export enum NotificationCategory {
  PAYMENT = 'payment',
  FEE = 'fee',
  NOTE = 'note',
  ASSIGNMENT = 'assignment',
  GENERAL = 'general',
}

// Maps a specific event `type` string (what actually gets stored on Notification.type — e.g.
// 'payment_confirmed') to the broader category a user sets one preference for. Every module
// calling NotificationsService.notify() with a new event type should add it here; anything
// unregistered falls back to GENERAL rather than throwing — see notifications.service.ts.
export const NOTIFICATION_TYPE_CATEGORY: Record<string, NotificationCategory> =
  {
    payment_confirmed: NotificationCategory.PAYMENT,
    invoice_issued: NotificationCategory.FEE,
    document_shared: NotificationCategory.NOTE,
    assignment_created: NotificationCategory.ASSIGNMENT,
    submission_reviewed: NotificationCategory.ASSIGNMENT,
  };

// The channel used when a user has never set a preference for this category. docs/01 §1.3's own
// example split: real-time push for critical events (payment confirmation), digest for
// informational ones (a new invoice, a shared document) — once a user sets a preference, their
// choice always overrides this. ASSIGNMENT defaults to PUSH rather than a digest: both events in
// it are time-sensitive in a way a passive fee/document isn't — a new assignment carries a
// deadline, and graded feedback is exactly the kind of thing a student wants to know promptly.
export const DEFAULT_CHANNEL_BY_CATEGORY: Record<
  NotificationCategory,
  NotificationChannel
> = {
  [NotificationCategory.PAYMENT]: NotificationChannel.PUSH,
  [NotificationCategory.FEE]: NotificationChannel.DIGEST_DAILY,
  [NotificationCategory.NOTE]: NotificationChannel.DIGEST_DAILY,
  [NotificationCategory.ASSIGNMENT]: NotificationChannel.PUSH,
  [NotificationCategory.GENERAL]: NotificationChannel.PUSH,
};
