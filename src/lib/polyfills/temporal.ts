export interface FormattedEventDateTime {
  dateLabel: string;
  timeLabel: string;
  fullLabel: string;
  viewerTimeLabel?: string;
  timeZoneName: string;
  isMultiDay: boolean;
}

let temporalLoadPromise: Promise<typeof Temporal> | null = null;

/**
 * Ensures global `Temporal` is available, dynamically loading `temporal-polyfill`
 * only when the host runtime lacks native `Temporal`.
 */
export async function ensureTemporal(): Promise<typeof Temporal> {
  if (typeof Temporal === 'undefined') {
    if (!temporalLoadPromise) {
      temporalLoadPromise = import('temporal-polyfill').then((mod) => {
        if (typeof Temporal === 'undefined') {
          (globalThis as { Temporal?: typeof Temporal }).Temporal =
            mod.Temporal as unknown as typeof Temporal;
        }
        return globalThis.Temporal;
      });
    }
    return temporalLoadPromise;
  }
  return Temporal;
}

function normalizeTimeZone(timeZone: string | undefined): string {
  if (!timeZone || !timeZone.trim()) {
    return 'UTC';
  }
  try {
    Intl.DateTimeFormat('en-US', { timeZone: timeZone.trim() });
    return timeZone.trim();
  } catch {
    return 'UTC';
  }
}

function parseIsoToZonedDateTime(
  T: typeof Temporal,
  iso: string,
  timeZone: string,
): Temporal.ZonedDateTime {
  const trimmed = iso.trim();
  const safeZone = normalizeTimeZone(timeZone);

  if (trimmed.includes('[')) {
    return T.ZonedDateTime.from(trimmed).withTimeZone(safeZone);
  }

  if (/(?:[Zz]|[+-]\d{2}:?\d{2})$/.test(trimmed)) {
    return T.Instant.from(trimmed).toZonedDateTimeISO(safeZone);
  }

  return T.PlainDateTime.from(trimmed).toZonedDateTime(safeZone);
}

function extractTimeZoneShortName(zdt: Temporal.ZonedDateTime): string {
  const formatted = zdt.toLocaleString('en-US', {
    hour: 'numeric',
    timeZoneName: 'short',
  });
  const parts = formatted.split(' ');
  return parts[parts.length - 1] || zdt.timeZoneId;
}

function formatZonedRange(
  startZdt: Temporal.ZonedDateTime,
  endZdt: Temporal.ZonedDateTime | undefined,
): {
  dateLabel: string;
  timeLabel: string;
  timeZoneName: string;
  isMultiDay: boolean;
} {
  const timeZoneName = extractTimeZoneShortName(startZdt);
  const startDateLabel = startZdt.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const startTimeShort = startZdt.toLocaleString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  if (!endZdt) {
    return {
      dateLabel: startDateLabel,
      timeLabel: `${startTimeShort} ${timeZoneName}`,
      timeZoneName,
      isMultiDay: false,
    };
  }

  const sameDay = startZdt.toPlainDate().equals(endZdt.toPlainDate());
  if (sameDay) {
    const endTimeShort = endZdt.toLocaleString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
    return {
      dateLabel: startDateLabel,
      timeLabel: `${startTimeShort} – ${endTimeShort} ${timeZoneName}`,
      timeZoneName,
      isMultiDay: false,
    };
  }

  const sameYear = startZdt.year === endZdt.year;
  const startShortDate = startZdt.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
  const endFullDate = endZdt.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const endShortDate = endZdt.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const endTimeShort = endZdt.toLocaleString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
  const endTzName = extractTimeZoneShortName(endZdt);

  return {
    dateLabel: `${startShortDate} – ${endFullDate}`,
    timeLabel: `${startShortDate}, ${startTimeShort} – ${endShortDate}, ${endTimeShort} ${endTzName}`,
    timeZoneName,
    isMultiDay: true,
  };
}

/**
 * Formats an event's start/end date and time using `Temporal.ZonedDateTime`,
 * optionally computing a viewer-local time label when `viewerTz` differs.
 */
export async function formatEventDateTime(
  startIso: string,
  endIso: string | undefined,
  timeZone: string,
  viewerTz?: string,
): Promise<FormattedEventDateTime> {
  const T = await ensureTemporal();
  const safeEventTz = normalizeTimeZone(timeZone);
  const startZdt = parseIsoToZonedDateTime(T, startIso, safeEventTz);
  const endZdt = endIso ? parseIsoToZonedDateTime(T, endIso, safeEventTz) : undefined;

  const primary = formatZonedRange(startZdt, endZdt);

  let viewerTimeLabel: string | undefined;
  if (viewerTz) {
    const safeViewerTz = normalizeTimeZone(viewerTz);
    if (safeViewerTz !== safeEventTz) {
      const viewerStart = startZdt.withTimeZone(safeViewerTz);
      const viewerEnd = endZdt?.withTimeZone(safeViewerTz);
      const viewerRange = formatZonedRange(viewerStart, viewerEnd);
      if (
        viewerStart.offsetNanoseconds !== startZdt.offsetNanoseconds ||
        viewerRange.timeZoneName !== primary.timeZoneName
      ) {
        viewerTimeLabel = viewerRange.isMultiDay
          ? `${viewerRange.timeLabel} (your time)`
          : `${viewerRange.dateLabel} · ${viewerRange.timeLabel} (your time)`;
      }
    }
  }

  return {
    dateLabel: primary.dateLabel,
    timeLabel: primary.timeLabel,
    fullLabel: `${primary.dateLabel} · ${primary.timeLabel}`,
    viewerTimeLabel,
    timeZoneName: primary.timeZoneName,
    isMultiDay: primary.isMultiDay,
  };
}
