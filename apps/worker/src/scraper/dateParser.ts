/**
 * Date parsing for promotion validity dates from thepromenadeshopsatbriargate.com
 *
 * The source uses several date formats (all resolved in America/Denver local time):
 *   - "Ends Today"
 *   - "Ends Tomorrow"
 *   - "Ends Saturday" (next occurrence of that weekday)
 *   - "Ends 10/19"    (month/day in current or next year)
 *   - "Ends 10/31"
 *
 * All dates are stored as UTC in MySQL. The Denver-local interpretation
 * is explicit: "Ends Today" means end-of-day in Denver.
 */

const DENVER_TZ = 'America/Denver';

const WEEKDAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/**
 * Returns the current date/time in Denver local time.
 */
function nowInDenver(): Date {
  // We work with a reference Date and use Intl to interpret it in Denver
  return new Date();
}

/**
 * Given a date, returns a new Date representing end-of-day (23:59:59.999) in Denver.
 * The returned Date is in UTC (internally), representing that Denver moment.
 */
function endOfDayDenver(refDate: Date): Date {
  // Get the Denver date parts for refDate
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: DENVER_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = fmt.formatToParts(refDate);
  const year = Number(parts.find((p) => p.type === 'year')?.value);
  const month = Number(parts.find((p) => p.type === 'month')?.value);
  const day = Number(parts.find((p) => p.type === 'day')?.value);

  // Create end-of-day in Denver — use the ISO string trick
  // "YYYY-MM-DDT23:59:59" in Denver
  const pad = (n: number): string => String(n).padStart(2, '0');
  const denverStr = `${year}-${pad(month)}-${pad(day)}T23:59:59`;

  // Parse as Denver local time by converting: create UTC offset for Mountain Time
  // Mountain Standard Time: UTC-7, Mountain Daylight Time: UTC-6
  // We use Intl to determine the offset at that moment
  const approxDate = new Date(`${denverStr}Z`);
  const offset = getDenverOffsetMinutes(approxDate);

  return new Date(approxDate.getTime() + offset * 60_000);
}

/**
 * Returns the UTC offset (in minutes) for America/Denver at the given UTC Date.
 * Positive means Denver is behind UTC (e.g., +360 means UTC-6 = MDT).
 */
function getDenverOffsetMinutes(utcDate: Date): number {
  const denverTime = new Date(utcDate.toLocaleString('en-US', { timeZone: DENVER_TZ }));
  const diff = utcDate.getTime() - denverTime.getTime();
  return Math.round(diff / 60_000);
}

/**
 * Parses an "Ends ..." string from the source into a UTC Date representing
 * the end of that day in Denver. Returns null if parsing fails.
 *
 * @param text - e.g. "Ends Today", "Ends Tomorrow", "Ends Saturday", "Ends 10/19"
 * @param referenceDate - the scrape time (defaults to now)
 */
export function parseEndDate(text: string | null | undefined, referenceDate?: Date): Date | null {
  if (!text) return null;

  const ref = referenceDate ?? nowInDenver();
  const normalized = text.trim().toLowerCase();

  // Strip "ends " prefix
  const body = normalized.startsWith('ends ') ? normalized.slice(5).trim() : normalized;

  if (body === 'today') {
    return endOfDayDenver(ref);
  }

  if (body === 'tomorrow') {
    const tomorrow = new Date(ref.getTime() + 24 * 60 * 60 * 1000);
    return endOfDayDenver(tomorrow);
  }

  // "ends saturday" style — next occurrence of that weekday
  const weekdayIdx = WEEKDAY_NAMES.indexOf(body);
  if (weekdayIdx !== -1) {
    // Get current weekday in Denver
    const denverWeekday = getDenverWeekday(ref);
    let daysAhead = weekdayIdx - denverWeekday;
    if (daysAhead <= 0) daysAhead += 7; // always look forward
    const target = new Date(ref.getTime() + daysAhead * 24 * 60 * 60 * 1000);
    return endOfDayDenver(target);
  }

  // "10/19" or "10/31" — M/D format, assume current year; if month already past, use next year
  const mdMatch = /^(\d{1,2})\/(\d{1,2})$/.exec(body);
  if (mdMatch?.[1] !== undefined && mdMatch?.[2] !== undefined) {
    const m = parseInt(mdMatch[1], 10);
    const d = parseInt(mdMatch[2], 10);

    const denverNow = getDenverDateParts(ref);
    let year = denverNow.year;

    // If this month/day is already in the past this year, use next year
    const candidate = new Date(Date.UTC(year, m - 1, d, 6, 0, 0)); // rough UTC for comparison
    if (candidate.getTime() < ref.getTime() - 24 * 60 * 60 * 1000) {
      year += 1;
    }

    // Build the end-of-day for M/D/YEAR in Denver
    // Use UTC date at noon Denver time, then apply end-of-day
    const tentative = new Date(Date.UTC(year, m - 1, d, 12, 0, 0));
    return endOfDayDenver(tentative);
  }

  // "Monday, October 19" long-form
  const longMatch = /(\w+),?\s+(\w+)\s+(\d{1,2})/i.exec(text);
  if (longMatch?.[2] && longMatch?.[3]) {
    const monthNames = [
      'january', 'february', 'march', 'april', 'may', 'june',
      'july', 'august', 'september', 'october', 'november', 'december',
    ];
    const monthIdx = monthNames.indexOf(longMatch[2].toLowerCase());
    if (monthIdx !== -1) {
      const d = parseInt(longMatch[3], 10);
      const denverNow = getDenverDateParts(ref);
      let year = denverNow.year;
      const tentative = new Date(Date.UTC(year, monthIdx, d, 12, 0, 0));
      if (tentative.getTime() < ref.getTime() - 24 * 60 * 60 * 1000) year++;
      const final = new Date(Date.UTC(year, monthIdx, d, 12, 0, 0));
      return endOfDayDenver(final);
    }
  }

  return null;
}

function getDenverWeekday(utcDate: Date): number {
  const str = utcDate.toLocaleDateString('en-US', { timeZone: DENVER_TZ, weekday: 'long' });
  return WEEKDAY_NAMES.indexOf(str.toLowerCase());
}

function getDenverDateParts(utcDate: Date): { year: number; month: number; day: number } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: DENVER_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = fmt.formatToParts(utcDate);
  return {
    year: Number(parts.find((p) => p.type === 'year')?.value),
    month: Number(parts.find((p) => p.type === 'month')?.value),
    day: Number(parts.find((p) => p.type === 'day')?.value),
  };
}

/**
 * Extracts a stable sourceId from a deal URL.
 * e.g. "/deals/3418533/" → "3418533"
 * e.g. "https://thepromenadeshopsatbriargate.com/deals/3418533/" → "3418533"
 */
export function extractDealId(url: string): string | null {
  const match = /\/deals\/(\d+)\/?/.exec(url);
  return match?.[1] ?? null;
}

/**
 * Extracts a stable brand key from a store URL.
 * e.g. "/stores/1035991-aerie/" → "1035991-aerie"
 */
export function extractBrandKey(url: string): string | null {
  const match = /\/stores\/([^/]+)\/?/.exec(url);
  return match?.[1] ?? null;
}
