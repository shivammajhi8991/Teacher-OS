// docs/02 §2.5 "FCM" / docs/07 roadmap "FCM wiring". This interface is the real integration seam
// — swapping in a genuine Firebase Admin SDK adapter later means writing one class against this
// contract, not touching NotificationsService. No Firebase project exists for this codebase (no
// google-services.json / APNs keys), so MockPushNotificationAdapter is what's actually
// registered — see that file for exactly what it fakes.
export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface PushSendResult {
  successCount: number;
  // Tokens the provider reported as no-longer-valid (app uninstalled, token rotated, etc.) — a
  // real FCM multicast response reports these explicitly so the caller can prune them.
  // NotificationsService does exactly that after every send (see its pushNow()).
  invalidTokens: string[];
}

export interface PushNotificationAdapter {
  send(tokens: string[], payload: PushPayload): Promise<PushSendResult>;
}

export const PUSH_NOTIFICATION_ADAPTER = Symbol('PUSH_NOTIFICATION_ADAPTER');
