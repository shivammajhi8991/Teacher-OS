// docs/04 §4.4 "POST /payments/gateway/initiate" / "POST /payments/gateway/webhook". This
// interface is the real integration seam — swapping in Razorpay/Stripe later means writing one
// adapter class against this contract, not touching FeesService or the controller. No real
// gateway is wired up in this pass (no account/API keys exist for this project), so
// MockPaymentGatewayAdapter is what's actually registered — see that file for exactly what it
// fakes and why the webhook-processing logic around it is still real, tested code.
export interface PaymentGatewaySession {
  sessionId: string;
  checkoutUrl: string;
}

export interface PaymentGatewayAdapter {
  initiate(params: {
    invoiceId: string;
    amount: string;
    currency: string;
  }): Promise<PaymentGatewaySession>;

  /**
   * Verifies a webhook payload actually came from the gateway (HMAC signature check against a
   * shared secret, in a real adapter) and extracts the fields FeesService needs to reconcile a
   * payment. Throws if the signature is invalid.
   */
  verifyAndParseWebhook(params: {
    rawBody: string;
    signatureHeader: string | undefined;
  }): {
    gatewayReference: string;
    sessionId: string;
    status: 'succeeded' | 'failed';
  };
}

export const PAYMENT_GATEWAY_ADAPTER = Symbol('PAYMENT_GATEWAY_ADAPTER');
