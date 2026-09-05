import { Injectable, Logger } from '@nestjs/common';
import {
  PushNotificationAdapter,
  PushPayload,
  PushSendResult,
} from './push-notification.adapter';

// The registered PushNotificationAdapter in this pass — see push-notification.adapter.ts for
// why. What this fakes: the actual HTTP call to FCM. What it does instead: logs the send (so
// behavior is observable in dev/tests) and reports every token as delivered with none invalid.
// Because this always-succeeds mock can't itself demonstrate NotificationsService's invalid-
// token-pruning path, notifications.service.spec.ts exercises that against a small fake adapter
// that *does* report an invalid token, rather than against this class.
@Injectable()
export class MockPushNotificationAdapter implements PushNotificationAdapter {
  private readonly logger = new Logger(MockPushNotificationAdapter.name);

  async send(tokens: string[], payload: PushPayload): Promise<PushSendResult> {
    if (tokens.length > 0) {
      this.logger.log(
        `[mock push] → ${tokens.length} device(s): "${payload.title}" — ${payload.body}`,
      );
    }
    return { successCount: tokens.length, invalidTokens: [] };
  }
}
