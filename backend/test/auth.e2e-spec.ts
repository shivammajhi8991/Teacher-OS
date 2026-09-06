import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { randomUUID } from 'crypto';
import Redis from 'ioredis';
import { AppModule } from '../src/app.module';

// docs/05 §5.7 lists "Registration/Login" as a critical workflow requiring an integration test —
// this is the backend counterpart. Requires a real Postgres reachable at DATABASE_URL with
// migrations applied (`docker compose -f infra/docker-compose.yml up -d && npm run migration:run`
// from backend/) — this is NOT run by `npm test` (see package.json's separate `test:e2e` script),
// matching docs/05 §5.7's "integration tests run on a nightly/pre-release pipeline" policy.
describe('Auth (e2e)', () => {
  let app: INestApplication;
  const email = `e2e-${randomUUID()}@example.com`;
  const password = 'correct-horse-battery-staple';
  const deviceId = `device-${randomUUID()}`;
  let accessToken: string;
  let refreshToken: string;

  beforeAll(async () => {
    // Phase 6 security review: the throttler storage is now Redis-backed (previously in-memory,
    // reset on every process start — see redis-throttler-storage.service.ts for why that never
    // actually satisfied docs/04 §4.8's "via Redis"). Login/register have no authenticated user
    // yet, so they're tracked by IP (always the same loopback address here), which means their
    // hit counts now genuinely persist in Redis across repeated runs of this exact suite within
    // the same 60s window — a real, previously-nonexistent flakiness source this file needs to
    // guard against, not a bug in the throttler itself. Flushing before the suite runs keeps this
    // suite's own repeated logins/registrations (five, well under any real attacker's budget) from
    // ever tripping a limit left over from the previous run.
    const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
    await redis.flushdb();
    redis.disconnect();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers a new teacher account and returns a token pair', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email,
        password,
        fullName: 'E2E Teacher',
        role: 'teacher',
        deviceId,
      })
      .expect(201);

    expect(res.body.user.email).toBe(email);
    expect(res.body.user.passwordHash).toBeUndefined(); // docs/04 §4.8
    expect(res.body.tokens.accessToken).toEqual(expect.any(String));
    expect(res.body.tokens.refreshToken).toEqual(expect.any(String));
    accessToken = res.body.tokens.accessToken;
    refreshToken = res.body.tokens.refreshToken;
  });

  it('rejects a duplicate registration with the same email', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email,
        password,
        fullName: 'Dup',
        role: 'teacher',
        deviceId: `dup-${deviceId}`,
      })
      .expect(409);
  });

  it('rejects login with the wrong password without revealing whether the account exists', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ identifier: email, password: 'wrong-password', deviceId })
      .expect(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('logs in with correct credentials', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ identifier: email, password, deviceId })
      .expect(200);
    expect(res.body.tokens.accessToken).toEqual(expect.any(String));
  });

  it('rejects /auth/me without a token', async () => {
    await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
  });

  it('returns the current user, roles, and permissions with a valid token', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(res.body.user.email).toBe(email);
    expect(res.body.roles).toEqual(
      expect.arrayContaining([expect.objectContaining({ role: 'teacher' })]),
    );
    expect(res.body.permissions).toEqual(
      expect.arrayContaining(['profile.manage_own']),
    );
  });

  it('rotates the refresh token and rejects reuse of the old one', async () => {
    const first = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken, deviceId })
      .expect(200);
    expect(first.body.accessToken).toEqual(expect.any(String));

    // docs/03 §3.7 rotation policy: the token just used is now revoked — reusing it must fail.
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken, deviceId })
      .expect(401);
  });
});
