import { parseDurationToMs } from './duration.util';

describe('parseDurationToMs', () => {
  it('parses seconds', () => {
    expect(parseDurationToMs('30s')).toBe(30 * 1000);
  });

  it('parses minutes', () => {
    expect(parseDurationToMs('15m')).toBe(15 * 60 * 1000);
  });

  it('parses hours', () => {
    expect(parseDurationToMs('2h')).toBe(2 * 60 * 60 * 1000);
  });

  it('parses days', () => {
    expect(parseDurationToMs('30d')).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it('throws on an invalid format', () => {
    expect(() => parseDurationToMs('30')).toThrow(/Invalid duration format/);
    expect(() => parseDurationToMs('30 minutes')).toThrow(
      /Invalid duration format/,
    );
    expect(() => parseDurationToMs('')).toThrow(/Invalid duration format/);
  });
});
