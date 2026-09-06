import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import Redis from 'ioredis';

// `@nestjs/throttler`'s index barrel doesn't re-export `ThrottlerStorageRecord` itself (only the
// `ThrottlerStorage` interface that references it) — declared locally, structurally identical to
// the package's own type, rather than a fragile deep import into its `dist/`.
interface ThrottlerStorageRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

// docs/04 §4.8 "Rate limiting per-user and per-IP on all mutating endpoints via Redis sliding
// window". `ThrottlerModule.forRoot`'s default `ThrottlerStorageService` (an in-memory Map) never
// actually satisfied "via Redis" — this project's own recurring "the in-memory throttle store
// survives a hot-reload in confusing ways" gotcha (docs/07 roadmap, several steps) is a direct
// symptom of that gap. Fixed here as a Phase 6 security-review finding: a real sliding-window
// counter backed by Redis (already provisioned — infra/docker-compose.yml — but, until now,
// nothing in this codebase actually connected to it).
//
// Sliding window via a Redis sorted set: each hit is a member scored by its own timestamp;
// `ZREMRANGEBYSCORE` evicts anything older than the window on every call before counting, so the
// window truly slides rather than resetting on a fixed boundary (the naive INCR+EXPIRE "fixed
// window" pattern most tutorials call this). A short-lived block key (mirroring the in-memory
// implementation's own `isBlocked`/`blockExpiresAt` behavior — see
// node_modules/@nestjs/throttler/dist/throttler.service.js) avoids re-counting every request
// against the sorted set once a caller is already over the limit.
@Injectable()
export class RedisThrottlerStorageService
  implements ThrottlerStorage, OnApplicationShutdown
{
  // Takes an already-constructed client (app.module.ts builds it from `redisUrl`) rather than a
  // URL, so a unit test can hand this a fake client instead of opening a real socket — this
  // class's own logic (the sliding-window math) is what's worth unit-testing, not ioredis itself.
  constructor(private readonly redis: Redis) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const redisKey = `throttle:${throttlerName}:${key}`;
    const blockKey = `${redisKey}:blocked`;
    const now = Date.now();

    const blockedUntilRaw = await this.redis.get(blockKey);
    if (blockedUntilRaw) {
      const blockedUntil = Number(blockedUntilRaw);
      if (blockedUntil > now) {
        return {
          totalHits: limit + 1,
          timeToExpire: Math.ceil(ttl / 1000),
          isBlocked: true,
          timeToBlockExpire: Math.ceil((blockedUntil - now) / 1000),
        };
      }
      // Block expired — fall through to a fresh window, same as the in-memory
      // implementation's own resetBlockdRequest.
      await this.redis.del(blockKey);
      await this.redis.del(redisKey);
    }

    const windowStart = now - ttl;
    const member = `${now}-${Math.random().toString(36).slice(2)}`;

    const pipeline = this.redis.multi();
    pipeline.zremrangebyscore(redisKey, 0, windowStart);
    pipeline.zadd(redisKey, now, member);
    pipeline.zcard(redisKey);
    pipeline.pexpire(redisKey, ttl);
    const results = await pipeline.exec();

    // results is [[err, value], ...] in command order — zcard is the 3rd command.
    const totalHits = (results?.[2]?.[1] as number) ?? 1;
    const isBlocked = totalHits > limit;

    if (isBlocked && blockDuration > 0) {
      const blockedUntil = now + blockDuration;
      await this.redis.set(blockKey, blockedUntil, 'PX', blockDuration);
    }

    return {
      totalHits,
      timeToExpire: Math.ceil(ttl / 1000),
      isBlocked,
      timeToBlockExpire: isBlocked ? Math.ceil(blockDuration / 1000) : 0,
    };
  }

  onApplicationShutdown(): void {
    this.redis.disconnect();
  }
}
