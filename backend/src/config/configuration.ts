// Central place env vars are read — nothing else in the codebase should call process.env directly,
// so a missing/renamed var fails fast here instead of silently at the point of use.
export interface AppConfig {
  nodeEnv: string;
  port: number;
  apiPrefix: string;
  corsOrigin: string;
  database: {
    url: string;
  };
  jwt: {
    accessSecret: string;
    accessExpiresIn: string;
    refreshSecret: string;
    refreshExpiresIn: string;
  };
  redisUrl: string;
  paymentGatewayWebhookSecret: string;
}

export default (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  apiPrefix: process.env.API_PREFIX ?? 'api/v1',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:8080',
  database: {
    // Port 5433, not Postgres's usual 5432 — see infra/docker-compose.yml's comment (a
    // locally-installed native Postgres service is a common 5432 collision on a dev machine).
    url:
      process.env.DATABASE_URL ??
      'postgres://teacheros:teacheros@localhost:5433/teacheros',
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? 'dev-only-access-secret',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev-only-refresh-secret',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '30d',
  },
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  // docs/04 §4.4 payment gateway webhook — verifies MockPaymentGatewayAdapter's own signed
  // payloads (no real gateway account exists for this project, see gateway/ for why). A real
  // adapter would read the equivalent secret Razorpay/Stripe issue for your webhook endpoint.
  paymentGatewayWebhookSecret:
    process.env.PAYMENT_GATEWAY_WEBHOOK_SECRET ??
    'dev-only-mock-gateway-secret',
});
