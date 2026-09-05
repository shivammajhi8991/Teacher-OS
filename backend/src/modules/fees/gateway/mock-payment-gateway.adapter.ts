import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { AppConfig } from '../../../config/configuration';
import {
  PaymentGatewayAdapter,
  PaymentGatewaySession,
} from './payment-gateway.adapter';

interface MockWebhookPayload {
  sessionId: string;
  status: 'succeeded' | 'failed';
  gatewayReference?: string;
}

// The registered PaymentGatewayAdapter in this pass — see payment-gateway.adapter.ts for why.
// What's real here: HMAC-SHA256 webhook signature verification against a shared secret, the
// same mechanism a real gateway (Razorpay, Stripe, etc.) actually uses, so
// FeesService.confirmGatewayPayment's reconciliation logic is exercised end-to-end by a test that
// signs its own payload — only `initiate()`'s "call out to a real checkout page" half is faked.
@Injectable()
export class MockPaymentGatewayAdapter implements PaymentGatewayAdapter {
  constructor(private readonly configService: ConfigService<AppConfig, true>) {}

  async initiate(params: {
    invoiceId: string;
    amount: string;
    currency: string;
  }): Promise<PaymentGatewaySession> {
    const sessionId = randomUUID();
    // A real adapter calls the gateway's API here (with invoiceId/amount/currency) and returns
    // ITS hosted checkout URL. Nothing at this URL processes an actual payment — invoiceId is
    // only carried along so the mock URL at least reads like a real one would.
    return {
      sessionId,
      checkoutUrl: `https://mock-gateway.invalid/checkout/${sessionId}?invoice=${params.invoiceId}`,
    };
  }

  verifyAndParseWebhook(params: {
    rawBody: string;
    signatureHeader: string | undefined;
  }): {
    gatewayReference: string;
    sessionId: string;
    status: 'succeeded' | 'failed';
  } {
    const secret = this.configService.get('paymentGatewayWebhookSecret', {
      infer: true,
    });
    const expected = createHmac('sha256', secret)
      .update(params.rawBody)
      .digest('hex');

    const provided = params.signatureHeader ?? '';
    const signatureValid =
      provided.length === expected.length &&
      timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
    if (!signatureValid) {
      throw new Error('Invalid webhook signature');
    }

    const payload = JSON.parse(params.rawBody) as MockWebhookPayload;
    return {
      gatewayReference: payload.gatewayReference ?? payload.sessionId,
      sessionId: payload.sessionId,
      status: payload.status,
    };
  }
}
