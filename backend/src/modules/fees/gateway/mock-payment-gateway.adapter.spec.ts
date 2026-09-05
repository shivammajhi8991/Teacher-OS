import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { AppConfig } from '../../../config/configuration';
import { MockPaymentGatewayAdapter } from './mock-payment-gateway.adapter';

// docs/04 §4.4 gateway webhook — this signature check is the ONLY thing standing between "any
// caller can mark any payment confirmed" and a real auth boundary, so it gets its own direct test
// rather than only being exercised indirectly through FeesService.
describe('MockPaymentGatewayAdapter', () => {
  const secret = 'test-webhook-secret';
  const configService = {
    get: jest.fn().mockReturnValue(secret),
  } as unknown as ConfigService<AppConfig, true>;
  const adapter = new MockPaymentGatewayAdapter(configService);

  function sign(rawBody: string): string {
    return createHmac('sha256', secret).update(rawBody).digest('hex');
  }

  it('accepts a payload whose signature matches the shared secret', () => {
    const rawBody = JSON.stringify({
      sessionId: 'session-1',
      status: 'succeeded',
    });

    const result = adapter.verifyAndParseWebhook({
      rawBody,
      signatureHeader: sign(rawBody),
    });

    expect(result).toEqual({
      sessionId: 'session-1',
      gatewayReference: 'session-1',
      status: 'succeeded',
    });
  });

  it('rejects a payload signed with the wrong secret', () => {
    const rawBody = JSON.stringify({
      sessionId: 'session-1',
      status: 'succeeded',
    });
    const wrongSignature = createHmac('sha256', 'not-the-real-secret')
      .update(rawBody)
      .digest('hex');

    expect(() =>
      adapter.verifyAndParseWebhook({
        rawBody,
        signatureHeader: wrongSignature,
      }),
    ).toThrow();
  });

  it('rejects a tampered body even if a valid signature was captured for different content', () => {
    const originalBody = JSON.stringify({
      sessionId: 'session-1',
      status: 'failed',
    });
    const signatureForOriginal = sign(originalBody);
    const tamperedBody = JSON.stringify({
      sessionId: 'session-1',
      status: 'succeeded',
    });

    expect(() =>
      adapter.verifyAndParseWebhook({
        rawBody: tamperedBody,
        signatureHeader: signatureForOriginal,
      }),
    ).toThrow();
  });

  it('rejects a missing signature header', () => {
    const rawBody = JSON.stringify({
      sessionId: 'session-1',
      status: 'succeeded',
    });

    expect(() =>
      adapter.verifyAndParseWebhook({ rawBody, signatureHeader: undefined }),
    ).toThrow();
  });

  it('prefers an explicit gatewayReference over the sessionId when both are present', () => {
    const rawBody = JSON.stringify({
      sessionId: 'session-1',
      status: 'succeeded',
      gatewayReference: 'pay_real_gateway_id',
    });

    const result = adapter.verifyAndParseWebhook({
      rawBody,
      signatureHeader: sign(rawBody),
    });

    expect(result.gatewayReference).toBe('pay_real_gateway_id');
  });
});
