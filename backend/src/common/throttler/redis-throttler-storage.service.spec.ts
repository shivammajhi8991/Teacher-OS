import { RedisThrottlerStorageService } from './redis-throttler-storage.service';

// A hand-rolled fake matching only the surface this service actually calls — this codebase's
// established preference over pulling in an ioredis-mock package (see admin-users.service.spec.ts's
// own hand-rolled chainable QueryBuilder stub for the same reasoning). Backs the sorted set with a
// real in-memory Map<score, member> per key so the sliding-window eviction logic is genuinely
// exercised, not just asserted-as-called.
class FakeRedis {
  private readonly sortedSets = new Map<string, Map<string, number>>();
  private readonly strings = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.strings.get(key) ?? null;
  }

  async set(key: string, value: string | number): Promise<void> {
    this.strings.set(key, String(value));
  }

  async del(key: string): Promise<void> {
    this.strings.delete(key);
    this.sortedSets.delete(key);
  }

  multi() {
    const ops: Array<() => [Error | null, unknown]> = [];
    const pipeline = {
      zremrangebyscore: (key: string, min: number, max: number) => {
        ops.push(() => {
          const set = this.sortedSets.get(key);
          if (set) {
            for (const [member, score] of set) {
              if (score >= min && score <= max) set.delete(member);
            }
          }
          return [null, 0];
        });
        return pipeline;
      },
      zadd: (key: string, score: number, member: string) => {
        ops.push(() => {
          if (!this.sortedSets.has(key)) this.sortedSets.set(key, new Map());
          this.sortedSets.get(key)!.set(member, score);
          return [null, 1];
        });
        return pipeline;
      },
      zcard: (key: string) => {
        ops.push(() => [null, this.sortedSets.get(key)?.size ?? 0]);
        return pipeline;
      },
      pexpire: () => {
        ops.push(() => [null, 1]);
        return pipeline;
      },
      exec: async () => ops.map((op) => op()),
    };
    return pipeline;
  }
}

describe('RedisThrottlerStorageService', () => {
  let redis: FakeRedis;
  let storage: RedisThrottlerStorageService;

  beforeEach(() => {
    redis = new FakeRedis();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    storage = new RedisThrottlerStorageService(redis as any);
  });

  it('counts hits within the window and stays unblocked under the limit', async () => {
    const r1 = await storage.increment('user-1', 60_000, 5, 30_000, 'default');
    expect(r1).toEqual({
      totalHits: 1,
      timeToExpire: 60,
      isBlocked: false,
      timeToBlockExpire: 0,
    });

    const r2 = await storage.increment('user-1', 60_000, 5, 30_000, 'default');
    expect(r2.totalHits).toBe(2);
    expect(r2.isBlocked).toBe(false);
  });

  it('tracks separate keys independently', async () => {
    await storage.increment('user-1', 60_000, 5, 30_000, 'default');
    const other = await storage.increment(
      'user-2',
      60_000,
      5,
      30_000,
      'default',
    );
    expect(other.totalHits).toBe(1);
  });

  it('blocks once totalHits exceeds the limit and reports the block duration', async () => {
    for (let i = 0; i < 5; i++) {
      await storage.increment('user-1', 60_000, 5, 30_000, 'default');
    }
    const blocked = await storage.increment(
      'user-1',
      60_000,
      5,
      30_000,
      'default',
    );
    expect(blocked.isBlocked).toBe(true);
    expect(blocked.timeToBlockExpire).toBe(30);
  });

  it('short-circuits on an active block without touching the sorted set again', async () => {
    for (let i = 0; i < 6; i++) {
      await storage.increment('user-1', 60_000, 5, 30_000, 'default');
    }
    const stillBlocked = await storage.increment(
      'user-1',
      60_000,
      5,
      30_000,
      'default',
    );
    expect(stillBlocked).toEqual({
      totalHits: 6, // limit + 1, per the short-circuit branch — not re-counted
      timeToExpire: 60,
      isBlocked: true,
      timeToBlockExpire: 30,
    });
  });

  it('scopes hit counts per throttlerName even for the same tracker key', async () => {
    await storage.increment('user-1', 60_000, 5, 30_000, 'strict');
    const defaultThrottler = await storage.increment(
      'user-1',
      60_000,
      5,
      30_000,
      'default',
    );
    expect(defaultThrottler.totalHits).toBe(1); // a different Redis key — 'strict' vs 'default'
  });
});
