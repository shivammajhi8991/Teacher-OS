// Parses '15m' / '30d' / '3600s' style durations (as used in .env JWT_*_EXPIRES_IN, docs/02 §2.4)
// into milliseconds, so AuthService can compute an absolute `expiresAt` for stored refresh tokens
// without pulling in a full duration-parsing library for one conversion.
const UNIT_TO_MS: Record<string, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

export function parseDurationToMs(duration: string): number {
  const match = /^(\d+)([smhd])$/.exec(duration.trim());
  if (!match) {
    throw new Error(
      `Invalid duration format: "${duration}" (expected e.g. "15m", "30d")`,
    );
  }
  const [, value, unit] = match;
  return parseInt(value, 10) * UNIT_TO_MS[unit];
}
