import { ensureTemporal } from '@/lib/polyfills/temporal';
import { stripHtmlToText } from '@/lib/sanitize';
import type { EventMeta } from '@/types/invite';

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

function parseToZoned(
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

function formatUtcCompact(instant: Temporal.Instant): string {
  const zdt = instant.toZonedDateTimeISO('UTC');
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${zdt.year}${pad(zdt.month)}${pad(zdt.day)}T${pad(zdt.hour)}${pad(zdt.minute)}${pad(zdt.second)}Z`;
}

function formatUtcIsoSeconds(instant: Temporal.Instant): string {
  const zdt = instant.toZonedDateTimeISO('UTC');
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${zdt.year}-${pad(zdt.month)}-${pad(zdt.day)}T${pad(zdt.hour)}:${pad(zdt.minute)}:${pad(zdt.second)}Z`;
}

function buildEventLocationString(event: EventMeta): string {
  const parts = [event.locationName, event.locationAddress].filter(
    (part): part is string => Boolean(part && part.trim()),
  );
  if (parts.length > 0) {
    return parts.join(', ');
  }
  if (event.virtualUrl && isSafeExternalHttpUrl(event.virtualUrl)) {
    return event.virtualUrl;
  }
  return '';
}

function buildEventDetailsText(event: EventMeta, eventUrl: string): string {
  const plain = stripHtmlToText(event.descriptionHtml);
  const segments: string[] = [];
  if (plain) {
    segments.push(plain.slice(0, 600));
  }
  if (event.virtualUrl && isSafeExternalHttpUrl(event.virtualUrl)) {
    segments.push(`Join online: ${event.virtualUrl}`);
  }
  if (eventUrl) {
    segments.push(`Invitation & RSVP: ${eventUrl}`);
  }
  return segments.join('\n\n');
}

export async function buildExternalCalendarUrls(
  event: EventMeta,
  eventUrl: string,
): Promise<{ googleUrl: string; outlookUrl: string }> {
  const T = await ensureTemporal();
  const startZdt = parseToZoned(T, event.startIso, event.timeZone);
  const endZdt = event.endIso
    ? parseToZoned(T, event.endIso, event.timeZone)
    : startZdt.add({ hours: 2 });

  const startInstant = startZdt.toInstant();
  const endInstant =
    endZdt.epochNanoseconds > startZdt.epochNanoseconds
      ? endZdt.toInstant()
      : startZdt.add({ hours: 2 }).toInstant();

  const location = buildEventLocationString(event);
  const details = buildEventDetailsText(event, eventUrl);

  const googleParams = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${formatUtcCompact(startInstant)}/${formatUtcCompact(endInstant)}`,
    details,
    ctz: normalizeTimeZone(event.timeZone),
  });
  if (location) {
    googleParams.set('location', location);
  }

  const outlookParams = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: event.title,
    startdt: formatUtcIsoSeconds(startInstant),
    enddt: formatUtcIsoSeconds(endInstant),
    body: details,
  });
  if (location) {
    outlookParams.set('location', location);
  }

  return {
    googleUrl: `https://calendar.google.com/calendar/render?${googleParams.toString()}`,
    outlookUrl: `https://outlook.live.com/calendar/0/action/compose?${outlookParams.toString()}`,
  };
}

export function buildMapsSearchUrl(
  locationName?: string,
  locationAddress?: string,
): string | null {
  const query = [locationName, locationAddress]
    .map((s) => s?.trim())
    .filter((s): s is string => Boolean(s))
    .join(', ');
  if (!query) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function isSafeExternalHttpUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function formatRelativeTime(iso: string): string {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return '';
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 45) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(ts));
}
