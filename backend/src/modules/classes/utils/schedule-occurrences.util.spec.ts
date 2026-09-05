import {
  materializeOccurrences,
  occurrencesOverlap,
} from './schedule-occurrences.util';

// docs/03 §3.5 conflict detection depends entirely on this being right — the highest-value unit
// test in this module. 2026-01-05 is a Monday (verified against a known reference date).
describe('materializeOccurrences', () => {
  const baseVersion = {
    effectiveFrom: '2026-01-05',
    effectiveTo: null,
    recurrenceRule: 'FREQ=WEEKLY;BYDAY=MO,WE,FR',
    startTime: '16:00:00',
    endTime: '17:00:00',
  };

  it('produces one occurrence per matching weekday within the window', () => {
    const occurrences = materializeOccurrences(
      baseVersion,
      new Date('2026-01-05T00:00:00.000Z'),
      new Date('2026-01-18T23:59:59.999Z'), // exactly two weeks: Mon 5th .. Sun 18th
    );

    // Mon/Wed/Fri each week × 2 weeks = 6.
    expect(occurrences).toHaveLength(6);
    expect(occurrences[0].start.toISOString()).toBe('2026-01-05T16:00:00.000Z');
    expect(occurrences[0].end.toISOString()).toBe('2026-01-05T17:00:00.000Z');
  });

  it('stops producing occurrences after effectiveTo', () => {
    const occurrences = materializeOccurrences(
      { ...baseVersion, effectiveTo: '2026-01-07' }, // cuts off after the first Wednesday
      new Date('2026-01-05T00:00:00.000Z'),
      new Date('2026-01-18T23:59:59.999Z'),
    );

    expect(occurrences).toHaveLength(2); // Mon 5th, Wed 7th only
  });

  it('returns an empty array for a malformed recurrence rule rather than throwing', () => {
    const occurrences = materializeOccurrences(
      { ...baseVersion, recurrenceRule: 'NOT A VALID RRULE' },
      new Date('2026-01-05T00:00:00.000Z'),
      new Date('2026-01-18T23:59:59.999Z'),
    );

    expect(occurrences).toEqual([]);
  });
});

describe('occurrencesOverlap', () => {
  it('detects an overlap when two ranges intersect', () => {
    const a = {
      start: new Date('2026-01-05T16:00:00Z'),
      end: new Date('2026-01-05T17:00:00Z'),
    };
    const b = {
      start: new Date('2026-01-05T16:30:00Z'),
      end: new Date('2026-01-05T18:00:00Z'),
    };
    expect(occurrencesOverlap(a, b)).toBe(true);
  });

  it('does not flag back-to-back classes with no overlap as conflicting', () => {
    const a = {
      start: new Date('2026-01-05T16:00:00Z'),
      end: new Date('2026-01-05T17:00:00Z'),
    };
    const b = {
      start: new Date('2026-01-05T17:00:00Z'),
      end: new Date('2026-01-05T18:00:00Z'),
    };
    expect(occurrencesOverlap(a, b)).toBe(false);
  });
});
