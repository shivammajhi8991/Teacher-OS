import { RRule } from 'rrule';

export interface Occurrence {
  start: Date;
  end: Date;
}

interface MaterializableSchedule {
  effectiveFrom: string;
  effectiveTo?: string | null;
  recurrenceRule: string;
  startTime: string;
  endTime: string;
}

// docs/03 §3.5 conflict-detection — materializes a schedule version's RRULE into concrete
// start/end datetimes within [windowStart, windowEnd). Deliberately treats `effectiveFrom` +
// `startTime`/`endTime` as UTC wall-clock, ignoring the version's `timezone` field — comparing
// two classes taught by the same teacher in genuinely different timezones needs real IANA tz
// math (e.g. via `date-fns-tz`), which is a documented follow-up; the overwhelmingly common case
// (one teacher, one timezone) is unaffected by this simplification.
export function materializeOccurrences(
  version: MaterializableSchedule,
  windowStart: Date,
  windowEnd: Date,
): Occurrence[] {
  const [startHour, startMinute] = parseTime(version.startTime);
  const [endHour, endMinute] = parseTime(version.endTime);
  const durationMs =
    (endHour * 60 + endMinute - (startHour * 60 + startMinute)) * 60 * 1000;

  const dtstart = new Date(`${version.effectiveFrom}T00:00:00.000Z`);
  dtstart.setUTCHours(startHour, startMinute, 0, 0);

  let options;
  try {
    options = RRule.parseString(version.recurrenceRule);
  } catch {
    return []; // malformed rule — fail safe (surface no conflicts) rather than throw mid-request
  }
  options.dtstart = dtstart;
  if (version.effectiveTo) {
    const until = new Date(`${version.effectiveTo}T23:59:59.999Z`);
    options.until =
      options.until && options.until < until ? options.until : until;
  }

  const rule = new RRule(options);
  return rule.between(windowStart, windowEnd, true).map((start) => ({
    start,
    end: new Date(start.getTime() + durationMs),
  }));
}

export function occurrencesOverlap(a: Occurrence, b: Occurrence): boolean {
  return a.start < b.end && b.start < a.end;
}

function parseTime(value: string): [number, number] {
  const [hourStr, minuteStr] = value.split(':');
  return [parseInt(hourStr, 10), parseInt(minuteStr, 10)];
}
