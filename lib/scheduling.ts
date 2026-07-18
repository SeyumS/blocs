import { addDays, format, isBefore, isAfter, addMinutes, parse } from 'date-fns';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';

export interface AvailabilityRule {
  day_of_week: number;
  start_time: string; // "08:00:00"
  end_time: string;
}

export interface Exception {
  date: string; // "2026-07-15"
  is_blocked: boolean;
  start_time: string | null;
  end_time: string | null;
}

export interface BusySlot {
  starts_at: string; // ISO timestamp
  ends_at: string;
  // Only populated when the caller has trainer-level access to the real
  // booking (the public customer-facing view never passes these).
  id?: string;
  series_id?: string | null;
  client_name?: string;
}

export interface CalendarSlot {
  start: Date;
  end: Date;
  available: boolean;
  blocked: boolean;
  // The gap between two availability rules on the same day (a trainer's
  // configured break) — never bookable, distinct from `blocked` (a one-off
  // exception like a vacation day).
  isBreak?: boolean;
  booking?: {
    id: string;
    clientName: string;
    seriesId: string | null;
  };
}

export const DAY_TO_INT: { [key: string]: number } = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(mins: number): string {
  const h = String(Math.floor(mins / 60)).padStart(2, '0');
  const m = String(mins % 60).padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * Takes the Set of selected cellIds (e.g. "Mon-06:00") from the schedule
 * grid and returns merged availability_rules rows ready for Supabase.
 */
export function extractAvailabilityRules(selectedCells: string[], slotDurationMinutes = 30) {
  // Group selected times by day
  const byDay: { [key: string]: number[] } = {};
  for (const cellId of selectedCells) {
    const [day, time] = cellId.split('-');
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(timeToMinutes(time));
  }

  const rules = [];

  for (const [day, minutesList] of Object.entries(byDay)) {
    const sorted = [...minutesList].sort((a, b) => a - b);

    let rangeStart = sorted[0];
    let prev = sorted[0];

    for (let i = 1; i <= sorted.length; i++) {
      const current = sorted[i];
      const isContiguous = current === prev + slotDurationMinutes;

      if (!isContiguous) {
        // close out the current range
        rules.push({
          day_of_week: DAY_TO_INT[day],
          start_time: minutesToTime(rangeStart),
          end_time: minutesToTime(prev + slotDurationMinutes), // end = last slot's end
        });
        rangeStart = current;
      }
      prev = current;
    }
  }

  return rules;
}

export function parseTimeOnDate(dateStr: string, timeStr: string, timezone: string): Date {
  const naive = parse(`${dateStr} ${timeStr}`, 'yyyy-MM-dd HH:mm:ss', new Date());
  return fromZonedTime(naive, timezone); // converts trainer's local time -> UTC
}

export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return isBefore(aStart, bEnd) && isAfter(aEnd, bStart);
}

/**
 * Server-side guard for /api/book — checks a requested [startsAt, endsAt)
 * window actually falls inside one of the trainer's availability_rules
 * windows (not straddling a break) and isn't covered by a blocking
 * exception. The customer-facing UI only ever lets people click slots that
 * are already known-available, but nothing stops a direct API request with
 * an arbitrary time, so this is the real enforcement point.
 */
export function isTimeWithinAvailability({
  startsAt,
  endsAt,
  rules,
  exceptions,
  timezone,
}: {
  startsAt: Date;
  endsAt: Date;
  rules: AvailabilityRule[];
  exceptions: Exception[];
  timezone: string;
}): boolean {
  if (isBefore(startsAt, new Date())) return false;

  const localDate = toZonedTime(startsAt, timezone);
  const dateStr = format(localDate, 'yyyy-MM-dd');
  const dayOfWeek = localDate.getDay();

  const fitsARule = rules
    .filter((r) => r.day_of_week === dayOfWeek)
    .some((rule) => {
      const windowStart = parseTimeOnDate(dateStr, rule.start_time, timezone);
      const windowEnd = parseTimeOnDate(dateStr, rule.end_time, timezone);
      return !isBefore(startsAt, windowStart) && !isAfter(endsAt, windowEnd);
    });
  if (!fitsARule) return false;

  const isBlocked = exceptions.some((e) => {
    if (e.date !== dateStr || !e.is_blocked) return false;
    if (!e.start_time) return true; // full-day block
    return overlaps(
      startsAt, endsAt,
      parseTimeOnDate(dateStr, e.start_time, timezone),
      parseTimeOnDate(dateStr, e.end_time!, timezone)
    );
  });

  return !isBlocked;
}

export function computeCalendarSlots({
  rules,
  exceptions,
  busySlots,
  timezone,
  sessionLengthMinutes,
  daysAhead = 14,
}: {
  rules: AvailabilityRule[];
  exceptions: Exception[];
  busySlots: BusySlot[];
  timezone: string;
  sessionLengthMinutes: number;
  daysAhead?: number;
}): CalendarSlot[] {
  const calendarSlots: CalendarSlot[] = [];
  if (rules.length === 0) return calendarSlots;
  const now = new Date();

  // Days with no rules at all (e.g. a weekend the trainer never works) get
  // back-filled below, once we know the real time-of-day rows in use.
  const offDayDates: string[] = [];
  const canonicalTimes = new Set<string>();

  for (let i = 0; i < daysAhead; i++) {
    const date = addDays(now, i);
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayOfWeek = date.getDay();

    const fullDayBlock = exceptions.find(
      (e) => e.date === dateStr && e.is_blocked && !e.start_time
    );
    const partialBlock = exceptions.filter(
      (e) => e.date === dateStr && e.is_blocked && e.start_time
    );

    // Each rule is its own contiguous working window for this day — slots
    // are chunked within a single rule at a time so a break between two
    // rules (e.g. 09:30–10:00) is never straddled by a generated slot.
    const dayRules = rules
      .filter((r) => r.day_of_week === dayOfWeek)
      .slice()
      .sort((a, b) => a.start_time.localeCompare(b.start_time));

    if (dayRules.length === 0) {
      offDayDates.push(dateStr);
      continue;
    }

    for (let ruleIndex = 0; ruleIndex < dayRules.length; ruleIndex++) {
      const rule = dayRules[ruleIndex];
      const windowStart = parseTimeOnDate(dateStr, rule.start_time, timezone);
      const windowEnd = parseTimeOnDate(dateStr, rule.end_time, timezone);

      let cursor = windowStart;
      while (isBefore(addMinutes(cursor, sessionLengthMinutes), windowEnd) ||
             +addMinutes(cursor, sessionLengthMinutes) === +windowEnd) {
        const slotEnd = addMinutes(cursor, sessionLengthMinutes);

        const isPast = isBefore(cursor, now);
        const isBlocked = !!fullDayBlock || partialBlock.some((block) =>
          overlaps(
            cursor, slotEnd,
            parseTimeOnDate(dateStr, block.start_time!, timezone),
            parseTimeOnDate(dateStr, block.end_time!, timezone)
          )
        );
        const busyMatch = busySlots.find((b) =>
          overlaps(cursor, slotEnd, new Date(b.starts_at), new Date(b.ends_at))
        );

        calendarSlots.push({
          start: cursor,
          end: slotEnd,
          available: !isPast && !isBlocked && !busyMatch,
          blocked: isBlocked,
          booking: busyMatch?.id
            ? {
                id: busyMatch.id,
                clientName: busyMatch.client_name ?? 'Booked',
                seriesId: busyMatch.series_id ?? null,
              }
            : undefined,
        });
        canonicalTimes.add(format(cursor, 'HH:mm'));

        cursor = slotEnd;
      }

      // The gap to the next rule (if any) on this same day is a break.
      const nextRule = dayRules[ruleIndex + 1];
      if (nextRule) {
        const breakStart = windowEnd;
        const breakEnd = parseTimeOnDate(dateStr, nextRule.start_time, timezone);
        if (isBefore(breakStart, breakEnd)) {
          calendarSlots.push({
            start: breakStart,
            end: breakEnd,
            available: false,
            blocked: false,
            isBreak: true,
          });
          canonicalTimes.add(format(breakStart, 'HH:mm'));
        }
      }
    }
  }

  // Back-fill off days with unavailable placeholders at the same
  // canonical times so every day still renders as an aligned column/row —
  // callers slice `daysAhead` worth of dates into weeks assuming one entry
  // per calendar day.
  const sortedCanonicalTimes = Array.from(canonicalTimes).sort();
  for (const dateStr of offDayDates) {
    const fullDayBlock = exceptions.find(
      (e) => e.date === dateStr && e.is_blocked && !e.start_time
    );
    for (const time of sortedCanonicalTimes) {
      const start = parseTimeOnDate(dateStr, `${time}:00`, timezone);
      calendarSlots.push({
        start,
        end: addMinutes(start, sessionLengthMinutes),
        available: false,
        blocked: !!fullDayBlock,
      });
    }
  }

  return calendarSlots;
}
