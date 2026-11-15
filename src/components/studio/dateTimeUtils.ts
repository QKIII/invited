import { ensureTemporal } from '@/lib/polyfills/temporal';

export interface DstConflictInfo {
  kind: 'nonexistent' | 'ambiguous';
  message: string;
  earlierLabel: string;
  laterLabel: string;
  earlierTime: string;
  laterTime: string;
  earlierDate: string;
  laterDate: string;
  earlierIso: string;
  laterIso: string;
}

export interface ZonedIsoBuildResult {
  iso?: string;
  dstConflict?: DstConflictInfo;
  error?: string;
}

const PRIORITY_TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Phoenix',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'America/Toronto',
  'America/Vancouver',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Australia/Sydney',
  'UTC',
];

export function getBrowserTimeZone(): string {
  try {
    const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (resolved && resolved.trim()) {
      return resolved.trim();
    }
  } catch {
    // Fallback below
  }
  return 'America/New_York';
}

export function getSupportedTimeZones(extraZone?: string): string[] {
  const set = new Set<string>(PRIORITY_TIMEZONES);
  if (extraZone && extraZone.trim()) {
    set.add(extraZone.trim());
  }
  try {
    const supported = Intl.supportedValuesOf('timeZone');
    for (const tz of supported) {
      set.add(tz);
    }
  } catch {
    // Environments without Intl.supportedValuesOf keep PRIORITY_TIMEZONES
  }
  return Array.from(set);
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

export function normalizeDateInput(dateStr: string): string {
  return dateStr.trim();
}

export function normalizeTimeInput(timeStr: string): string {
  const trimmed = timeStr.trim();
  if (/^\d{2}:\d{2}$/.test(trimmed)) return trimmed;
  if (/^\d{2}:\d{2}:\d{2}$/.test(trimmed)) return trimmed.slice(0, 5);
  return trimmed;
}

function parseToZonedDateTime(
  T: typeof Temporal,
  iso: string,
  timeZone: string,
): Temporal.ZonedDateTime {
  const trimmed = iso.trim();
  if (trimmed.includes('[')) {
    return T.ZonedDateTime.from(trimmed).withTimeZone(timeZone);
  }
  if (/(?:[Zz]|[+-]\d{2}:?\d{2})$/.test(trimmed)) {
    return T.Instant.from(trimmed).toZonedDateTimeISO(timeZone);
  }
  return T.PlainDateTime.from(trimmed).toZonedDateTime(timeZone);
}

export async function isoToLocalFields(
  iso: string | undefined,
  timeZone: string,
): Promise<{ date: string; time: string }> {
  if (!iso || !iso.trim()) {
    return { date: '', time: '' };
  }
  try {
    const T = await ensureTemporal();
    const zdt = parseToZonedDateTime(T, iso, timeZone || 'UTC');
    return {
      date: `${zdt.year}-${pad2(zdt.month)}-${pad2(zdt.day)}`,
      time: `${pad2(zdt.hour)}:${pad2(zdt.minute)}`,
    };
  } catch {
    const match = iso.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/);
    if (match) {
      return { date: match[1], time: match[2] };
    }
    return { date: '', time: '' };
  }
}

function formatZdtBrief(zdt: Temporal.ZonedDateTime): string {
  const timeText = zdt.toLocaleString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
  return `${zdt.year}-${pad2(zdt.month)}-${pad2(zdt.day)} · ${timeText}`;
}

export async function validateAndBuildZonedIso(
  dateStr: string,
  timeStr: string,
  timeZone: string,
  disambiguationPref?: 'earlier' | 'later',
): Promise<ZonedIsoBuildResult> {
  const cleanDate = normalizeDateInput(dateStr);
  const cleanTime = normalizeTimeInput(timeStr);
  if (!cleanDate || !cleanTime) {
    return { error: 'Please select both a date and time.' };
  }

  try {
    const T = await ensureTemporal();
    const pdt = T.PlainDateTime.from(`${cleanDate}T${cleanTime}:00`);

    if (disambiguationPref) {
      const resolved = pdt.toZonedDateTime(timeZone, {
        disambiguation: disambiguationPref,
      });
      return { iso: resolved.toString({ timeZoneName: 'never' }) };
    }

    try {
      const zdt = pdt.toZonedDateTime(timeZone, { disambiguation: 'reject' });
      return { iso: zdt.toString({ timeZoneName: 'never' }) };
    } catch (err) {
      if (err instanceof RangeError) {
        const earlier = pdt.toZonedDateTime(timeZone, { disambiguation: 'earlier' });
        const later = pdt.toZonedDateTime(timeZone, { disambiguation: 'later' });
        const isAmbiguous =
          earlier.hour === pdt.hour &&
          earlier.minute === pdt.minute &&
          later.hour === pdt.hour &&
          later.minute === pdt.minute;

        const kind: 'nonexistent' | 'ambiguous' = isAmbiguous
          ? 'ambiguous'
          : 'nonexistent';

        const message = isAmbiguous
          ? `Daylight Saving Time ends on ${cleanDate} in ${timeZone}, so ${cleanTime} occurs twice.`
          : `Daylight Saving Time springs forward on ${cleanDate} in ${timeZone}, so ${cleanTime} does not exist.`;

        return {
          dstConflict: {
            kind,
            message,
            earlierLabel: formatZdtBrief(earlier),
            laterLabel: formatZdtBrief(later),
            earlierTime: `${pad2(earlier.hour)}:${pad2(earlier.minute)}`,
            laterTime: `${pad2(later.hour)}:${pad2(later.minute)}`,
            earlierDate: `${earlier.year}-${pad2(earlier.month)}-${pad2(earlier.day)}`,
            laterDate: `${later.year}-${pad2(later.month)}-${pad2(later.day)}`,
            earlierIso: earlier.toString({ timeZoneName: 'never' }),
            laterIso: later.toString({ timeZoneName: 'never' }),
          },
        };
      }
      throw err;
    }
  } catch {
    return {
      error: `Invalid date, time, or timezone (${timeZone}).`,
    };
  }
}

export function parseInvitedNames(raw: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const part of raw.split(/[\n,]+/)) {
    const cleaned = part.trim().replace(/\s+/g, ' ');
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(cleaned);
    }
  }
  return result;
}
