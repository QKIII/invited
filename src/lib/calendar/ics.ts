import { Temporal as PolyfillTemporal } from 'temporal-polyfill';
import type { EventMeta } from '@/types/invite';

function getTemporal(): typeof PolyfillTemporal {
  const globalT = (globalThis as { Temporal?: typeof PolyfillTemporal })
    .Temporal;
  return globalT ?? PolyfillTemporal;
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

function toInstant(iso: string, timeZone: string): PolyfillTemporal.Instant {
  const T = getTemporal();
  const trimmed = iso.trim();
  const safeZone = normalizeTimeZone(timeZone);

  if (trimmed.includes('[')) {
    return T.ZonedDateTime.from(trimmed).toInstant();
  }

  if (/(?:[Zz]|[+-]\d{2}:?\d{2})$/.test(trimmed)) {
    return T.Instant.from(trimmed);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return T.PlainDate.from(trimmed).toZonedDateTime(safeZone).toInstant();
  }

  return T.PlainDateTime.from(trimmed).toZonedDateTime(safeZone).toInstant();
}

function formatIcsUtc(instant: PolyfillTemporal.Instant): string {
  const zdt = instant.toZonedDateTimeISO('UTC');
  const pad2 = (n: number) => String(n).padStart(2, '0');
  const pad4 = (n: number) => String(n).padStart(4, '0');
  return (
    `${pad4(zdt.year)}${pad2(zdt.month)}${pad2(zdt.day)}T` +
    `${pad2(zdt.hour)}${pad2(zdt.minute)}${pad2(zdt.second)}Z`
  );
}

function formatIsoUtc(instant: PolyfillTemporal.Instant): string {
  const zdt = instant.toZonedDateTimeISO('UTC');
  const pad2 = (n: number) => String(n).padStart(2, '0');
  const pad4 = (n: number) => String(n).padStart(4, '0');
  return (
    `${pad4(zdt.year)}-${pad2(zdt.month)}-${pad2(zdt.day)}T` +
    `${pad2(zdt.hour)}:${pad2(zdt.minute)}:${pad2(zdt.second)}Z`
  );
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r\n?/g, '\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function htmlToPlainText(html: string): string {
  if (!html) return '';
  return html
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|h2|h3|li|blockquote|div)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function foldIcsLine(line: string): string {
  const maxBytes = 75;
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= maxBytes) {
    return line;
  }

  const chunks: string[] = [];
  let current = '';
  let currentBytes = 0;

  for (const ch of line) {
    const chBytes = encoder.encode(ch).length;
    const limit = chunks.length === 0 ? maxBytes : maxBytes - 1; // leading space on continuation lines
    if (currentBytes + chBytes > limit && current.length > 0) {
      chunks.push(current);
      current = ch;
      currentBytes = chBytes;
    } else {
      current += ch;
      currentBytes += chBytes;
    }
  }

  if (current) {
    chunks.push(current);
  }

  return chunks.join('\r\n ');
}

function computeEventInstants(event: EventMeta): {
  start: PolyfillTemporal.Instant;
  end: PolyfillTemporal.Instant;
} {
  const start = toInstant(event.startIso, event.timeZone);
  let end: PolyfillTemporal.Instant;
  if (event.endIso) {
    try {
      const candidate = toInstant(event.endIso, event.timeZone);
      end =
        candidate.epochMilliseconds > start.epochMilliseconds
          ? candidate
          : start.add({ hours: 2 });
    } catch {
      end = start.add({ hours: 2 });
    }
  } else {
    end = start.add({ hours: 2 });
  }
  return { start, end };
}

function buildLocationString(event: EventMeta): string {
  const physical = [event.locationName, event.locationAddress]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(', ');
  if (physical) {
    return physical;
  }
  return event.virtualUrl?.trim() ?? '';
}

/**
 * Generates an RFC 5545 compliant `.ics` calendar string with 24h and 1h VALARM reminders.
 */
export function buildIcsContent(event: EventMeta, eventUrl: string): string {
  const T = getTemporal();
  const nowInstant = T.Instant.fromEpochMilliseconds(Date.now());
  const { start, end } = computeEventInstants(event);
  const location = buildLocationString(event);

  const plainDesc = htmlToPlainText(event.descriptionHtml);
  const descriptionParts = [
    plainDesc,
    event.virtualUrl ? `Join online: ${event.virtualUrl}` : '',
    `RSVP & Details: ${eventUrl}`,
  ].filter(Boolean);
  const description = descriptionParts.join('\n\n');

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//invited//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${escapeIcsText(event.id)}@invited`,
    `DTSTAMP:${formatIcsUtc(nowInstant)}`,
    `DTSTART:${formatIcsUtc(start)}`,
    `DTEND:${formatIcsUtc(end)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
  ];

  if (location) {
    lines.push(`LOCATION:${escapeIcsText(location)}`);
  }

  if (eventUrl) {
    lines.push(`URL:${eventUrl}`);
  }

  lines.push(
    'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'TRIGGER:-P1D',
    `DESCRIPTION:${escapeIcsText(`Reminder: ${event.title} is tomorrow`)}`,
    'END:VALARM',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'TRIGGER:-PT1H',
    `DESCRIPTION:${escapeIcsText(`Reminder: ${event.title} starts in 1 hour`)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  );

  return `${lines.map(foldIcsLine).join('\r\n')}\r\n`;
}

/**
 * Builds direct calendar links (.ics download endpoint, Google Calendar, and Outlook.com).
 */
export function buildCalendarLinks(
  event: EventMeta,
  eventUrl: string,
): { icsPath: string; googleUrl: string; outlookUrl: string } {
  const { start, end } = computeEventInstants(event);
  const location = buildLocationString(event);
  const plainDesc = htmlToPlainText(event.descriptionHtml);
  const details = [plainDesc, `RSVP & Details: ${eventUrl}`]
    .filter(Boolean)
    .join('\n\n');

  const googleParams = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${formatIcsUtc(start)}/${formatIcsUtc(end)}`,
    details,
    ...(location ? { location } : {}),
  });

  const outlookParams = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: event.title,
    startdt: formatIsoUtc(start),
    enddt: formatIsoUtc(end),
    body: details,
    ...(location ? { location } : {}),
  });

  return {
    icsPath: `/api/events/${event.id}/ics`,
    googleUrl: `https://calendar.google.com/calendar/render?${googleParams.toString()}`,
    outlookUrl: `https://outlook.live.com/calendar/0/deeplink/compose?${outlookParams.toString()}`,
  };
}
