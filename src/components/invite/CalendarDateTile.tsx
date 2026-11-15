import { Calendar } from 'lucide-react';

const MONTH_ABBR = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
] as const;

export interface CalendarTileParts {
  month: string;
  day: string;
}

/**
 * Extracts uppercase 3-letter month and unpadded day number from an event's startIso.
 * Preserves wall-clock date components when no UTC offset is present.
 */
export function getCalendarTileParts(
  startIso?: string,
  timeZone?: string,
): CalendarTileParts | null {
  if (!startIso || typeof startIso !== 'string') return null;
  const trimmed = startIso.trim();
  if (!trimmed) return null;

  const hasExplicitOffset = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(trimmed);
  if (!hasExplicitOffset) {
    const match = /^(\d{4})-(\d{2})-(\d{2})(?:T|$)/.exec(trimmed);
    if (match) {
      const monthIdx = Number(match[2]) - 1;
      const dayNum = Number(match[3]);
      if (monthIdx >= 0 && monthIdx < 12 && Number.isInteger(dayNum) && dayNum >= 1 && dayNum <= 31) {
        return {
          month: MONTH_ABBR[monthIdx],
          day: String(dayNum),
        };
      }
    }
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;

  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: timeZone || 'UTC',
    }).formatToParts(parsed);
    const monthPart = parts.find((p) => p.type === 'month')?.value;
    const dayPart = parts.find((p) => p.type === 'day')?.value;
    if (monthPart && dayPart) {
      return {
        month: monthPart.toUpperCase().slice(0, 3),
        day: dayPart,
      };
    }
  } catch {
    // Fallback below if timeZone is invalid
  }

  return {
    month: MONTH_ABBR[parsed.getUTCMonth()],
    day: String(parsed.getUTCDate()),
  };
}

/**
 * Collapses duplicate locationAddress when it repeats locationName verbatim (case-insensitive).
 */
export function formatDistinctLocation(
  locationName?: string,
  locationAddress?: string,
): {
  primaryLocation?: string;
  secondaryAddress?: string;
} {
  const cleanName = locationName?.trim() || undefined;
  const cleanAddress = locationAddress?.trim() || undefined;

  if (!cleanName && !cleanAddress) {
    return {};
  }
  if (!cleanName && cleanAddress) {
    return { primaryLocation: cleanAddress };
  }
  if (cleanName && cleanAddress && cleanName.toLowerCase() === cleanAddress.toLowerCase()) {
    return { primaryLocation: cleanName };
  }
  return {
    primaryLocation: cleanName,
    secondaryAddress: cleanAddress,
  };
}

interface CalendarDateTileProps {
  startIso?: string;
  timeZone?: string;
  size?: 'sm' | 'md';
}

/**
 * Luma-style Month + Day calendar tile badge, falling back to a Calendar icon when undated.
 */
export function CalendarDateTile({
  startIso,
  timeZone,
  size = 'md',
}: CalendarDateTileProps) {
  const parts = getCalendarTileParts(startIso, timeZone);

  if (!parts) {
    return (
      <div
        className={
          size === 'sm'
            ? 'invite-on-accent inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg'
            : 'invite-on-accent inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl'
        }
        style={{ backgroundColor: 'var(--theme-accent)' }}
        aria-hidden="true"
      >
        <Calendar className={size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'} />
      </div>
    );
  }

  return (
    <div
      className={
        size === 'sm'
          ? 'inline-flex h-10 w-10 shrink-0 flex-col overflow-hidden rounded-xl border text-center select-none backdrop-blur-sm'
          : 'inline-flex h-12 w-12 shrink-0 flex-col overflow-hidden rounded-xl border text-center select-none shadow-xs backdrop-blur-sm'
      }
      style={{
        backgroundColor: 'var(--theme-glass-bg, var(--theme-card-bg))',
        borderColor: 'var(--theme-border)',
      }}
      data-testid="calendar-date-tile"
      aria-hidden="true"
    >
      <span
        className={
          size === 'sm'
            ? 'flex items-center justify-center border-b py-0.5 text-[9px] font-bold uppercase tracking-wider leading-none'
            : 'flex items-center justify-center border-b py-1 text-[10px] font-bold uppercase tracking-wider leading-none'
        }
        style={{
          borderColor: 'var(--theme-hairline, var(--theme-border))',
          color: 'var(--theme-text-muted)',
        }}
      >
        {parts.month}
      </span>
      <span
        className={
          size === 'sm'
            ? 'flex flex-1 items-center justify-center text-sm font-bold leading-none tabular-nums'
            : 'flex flex-1 items-center justify-center text-base font-bold leading-none tabular-nums'
        }
        style={{ color: 'var(--theme-text-primary)' }}
      >
        {parts.day}
      </span>
    </div>
  );
}
