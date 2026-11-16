import { Temporal as PolyfillTemporal } from 'temporal-polyfill';
import type { SubscriberRecord } from '@/lib/storage/events';
import type {
  ActiveEmailNotifyLevel,
  EventMeta,
  RsvpStatus,
} from '@/types/invite';

export type NotificationCategory = 'event_change' | 'host_post' | 'guest_post';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const RESEND_BATCH_ENDPOINT = 'https://api.resend.com/emails/batch';
const DEFAULT_FROM_EMAIL = 'invited <updates@invites.ivanw.me>';
const DEFAULT_APP_URL = 'https://invited.ivanw.me';

/**
 * Returns `true` when transactional email sending via Resend is configured.
 */
export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

/**
 * Returns the configured sender header (`INVITED_FROM_EMAIL` or default domain address).
 */
export function getFromEmail(): string {
  return process.env.INVITED_FROM_EMAIL?.trim() || DEFAULT_FROM_EMAIL;
}

function getReplyToEmail(): string | undefined {
  const replyTo = process.env.INVITED_REPLY_TO?.trim();
  return replyTo || undefined;
}

/**
 * Resolves the canonical public origin for email links and one-click unsubscribe URLs.
 */
export function resolveAppBaseUrl(explicitOrigin?: string | null): string {
  const candidates = [
    explicitOrigin,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : undefined,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
    DEFAULT_APP_URL,
  ];

  for (const raw of candidates) {
    const trimmed = raw?.trim();
    if (!trimmed) continue;
    try {
      const parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        return parsed.origin;
      }
    } catch {
      // Try next candidate
    }
  }

  return DEFAULT_APP_URL;
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function getTemporal(): typeof PolyfillTemporal {
  const globalT = (globalThis as { Temporal?: typeof PolyfillTemporal })
    .Temporal;
  return globalT ?? PolyfillTemporal;
}

function normalizeTimeZone(timeZone: string | undefined): string {
  const trimmed = timeZone?.trim();
  if (!trimmed) return 'UTC';
  try {
    Intl.DateTimeFormat('en-US', { timeZone: trimmed });
    return trimmed;
  } catch {
    return 'UTC';
  }
}

function parseEventDate(iso: string, timeZone: string): Date | null {
  try {
    const T = getTemporal();
    const trimmed = iso.trim();
    const safeZone = normalizeTimeZone(timeZone);
    let instant: PolyfillTemporal.Instant;
    if (trimmed.includes('[')) {
      instant = T.ZonedDateTime.from(trimmed).toInstant();
    } else if (/(?:[Zz]|[+-]\d{2}:?\d{2})$/.test(trimmed)) {
      instant = T.Instant.from(trimmed);
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      instant = T.PlainDate.from(trimmed).toZonedDateTime(safeZone).toInstant();
    } else {
      instant = T.PlainDateTime.from(trimmed).toZonedDateTime(safeZone).toInstant();
    }
    return new Date(instant.epochMilliseconds);
  } catch {
    const fallback = new Date(iso.replace(/\[[^\]]+\]$/, ''));
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }
}

/**
 * Formats an event's date/time window in its configured IANA timezone.
 */
export function formatEventWhenLine(
  event: Pick<EventMeta, 'startIso' | 'endIso' | 'timeZone'>,
): string {
  const safeZone = normalizeTimeZone(event.timeZone);
  const startDate = parseEventDate(event.startIso, safeZone);
  if (!startDate) {
    return event.startIso;
  }

  try {
    const dateFmt = new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: safeZone,
    });
    const timeFmt = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: safeZone,
    });
    const tzFmt = new Intl.DateTimeFormat('en-US', {
      timeZone: safeZone,
      timeZoneName: 'short',
    });
    const tzPart =
      tzFmt.formatToParts(startDate).find((p) => p.type === 'timeZoneName')
        ?.value ?? '';
    const tzSuffix = tzPart ? ` ${tzPart}` : '';

    const startDayStr = dateFmt.format(startDate);
    const startTimeStr = timeFmt.format(startDate);

    if (event.endIso) {
      const endDate = parseEventDate(event.endIso, safeZone);
      if (endDate && endDate.getTime() > startDate.getTime()) {
        const endDayStr = dateFmt.format(endDate);
        const endTimeStr = timeFmt.format(endDate);
        if (endDayStr === startDayStr) {
          return `${startDayStr} · ${startTimeStr} – ${endTimeStr}${tzSuffix}`;
        }
        return `${startDayStr}, ${startTimeStr} – ${endDayStr}, ${endTimeStr}${tzSuffix}`;
      }
    }

    return `${startDayStr} at ${startTimeStr}${tzSuffix}`;
  } catch {
    return event.startIso;
  }
}

/**
 * Formats an event's physical address or virtual link for notification summaries.
 */
export function formatEventWhereLine(
  event: Pick<EventMeta, 'locationName' | 'locationAddress' | 'virtualUrl'>,
): string | undefined {
  const physical = [event.locationName, event.locationAddress]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(', ');
  const virtual = event.virtualUrl?.trim();
  if (physical && virtual) {
    return `${physical} (${virtual})`;
  }
  return physical || virtual || undefined;
}

function normalizeDescriptionText(html: string | undefined): string {
  if (!html) return '';
  return html
    .replace(/<\s*br\s*\/?>/gi, ' ')
    .replace(/<\/(?:p|h[1-6]|li|blockquote|div)>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Compares two `EventMeta` snapshots across guest-relevant fields (ignoring styling and host-only flags).
 */
export function computeEventChanges(
  before: EventMeta,
  after: EventMeta,
): {
  hasMaterialChanges: boolean;
  changeLines: string[];
  summaryText: string;
} {
  const changeLines: string[] = [];
  const norm = (value?: string) => (value ?? '').trim();

  if (norm(before.title) !== norm(after.title)) {
    changeLines.push(`Title changed to "${norm(after.title)}"`);
  }

  if (
    norm(before.startIso) !== norm(after.startIso) ||
    norm(before.endIso) !== norm(after.endIso) ||
    norm(before.timeZone) !== norm(after.timeZone)
  ) {
    changeLines.push(`Date & time updated to ${formatEventWhenLine(after)}`);
  }

  if (
    norm(before.locationName) !== norm(after.locationName) ||
    norm(before.locationAddress) !== norm(after.locationAddress)
  ) {
    const nextLocation = [after.locationName, after.locationAddress]
      .map((part) => part?.trim())
      .filter((part): part is string => Boolean(part))
      .join(', ');
    changeLines.push(
      nextLocation
        ? `Location updated to ${nextLocation}`
        : 'Location details were removed',
    );
  }

  if (norm(before.virtualUrl) !== norm(after.virtualUrl)) {
    const nextVirtual = norm(after.virtualUrl);
    changeLines.push(
      nextVirtual
        ? `Virtual link updated: ${nextVirtual}`
        : 'Virtual link was removed',
    );
  }

  if (
    normalizeDescriptionText(before.descriptionHtml) !==
    normalizeDescriptionText(after.descriptionHtml)
  ) {
    changeLines.push('Event description was updated');
  }

  const hasMaterialChanges = changeLines.length > 0;
  const summaryText = hasMaterialChanges
    ? changeLines.join(' · ')
    : 'The host updated the event details.';

  return {
    hasMaterialChanges,
    changeLines,
    summaryText,
  };
}

function formatNotifyLevelLabel(level?: ActiveEmailNotifyLevel): string {
  switch (level) {
    case 'changes':
      return 'Event updates only';
    case 'all_posts':
      return 'All updates & wall posts';
    case 'host_posts':
    default:
      return 'Event updates & host posts';
  }
}

function buildEmailHtml(params: {
  eyebrow: string;
  title: string;
  message: string;
  eventUrl: string;
  icsUrl?: string;
  unsubscribeUrl: string;
  whenLine?: string;
  whereLine?: string;
  preferenceLine?: string;
  changeLines?: string[];
}): string {
  const safeEyebrow = escapeHtml(params.eyebrow);
  const safeTitle = escapeHtml(params.title);
  const safeMessage = escapeHtml(params.message).replace(/\n/g, '<br />');
  const safeWhen = params.whenLine ? escapeHtml(params.whenLine) : null;
  const safeWhere = params.whereLine ? escapeHtml(params.whereLine) : null;
  const safePref = params.preferenceLine
    ? escapeHtml(params.preferenceLine)
    : null;
  const safeChanges = (params.changeLines ?? [])
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<li style="margin:3px 0;">${escapeHtml(line)}</li>`);

  const detailsRows = [
    safeWhen ? `<div><strong>When:</strong> ${safeWhen}</div>` : '',
    safeWhere ? `<div><strong>Where:</strong> ${safeWhere}</div>` : '',
    safePref ? `<div><strong>Alerts:</strong> ${safePref}</div>` : '',
  ]
    .filter(Boolean)
    .join('\n                ');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${safeTitle}</title>
</head>
<body style="margin:0;padding:24px;background-color:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111827;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:20px;border:1px solid #e5e7eb;overflow:hidden;">
    <tr>
      <td style="padding:28px 28px 20px;">
        <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#0369a1;">${safeEyebrow}</p>
        <h1 style="margin:0 0 12px;font-size:22px;line-height:1.25;font-weight:700;color:#0f172a;">${safeTitle}</h1>
        <p style="margin:0 0 18px;font-size:15px;line-height:1.55;color:#374151;">${safeMessage}</p>
        ${
          safeChanges.length > 0
            ? `<div style="margin:0 0 18px;padding:14px 16px;background:#f0f9ff;border-radius:14px;border:1px solid #bae6fd;">
                <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#0369a1;">What changed</p>
                <ul style="margin:0;padding-left:18px;font-size:14px;line-height:1.5;color:#0f172a;">
                  ${safeChanges.join('\n                  ')}
                </ul>
              </div>`
            : ''
        }
        ${
          detailsRows
            ? `<div style="margin:0 0 20px;padding:14px 16px;background:#f8fafc;border-radius:14px;border:1px solid #e2e8f0;font-size:13px;line-height:1.65;color:#334155;">
                ${detailsRows}
              </div>`
            : ''
        }
        <table role="presentation" cellspacing="0" cellpadding="0">
          <tr>
            <td style="border-radius:999px;background:#0f172a;">
              <a href="${params.eventUrl}" style="display:inline-block;padding:12px 22px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:999px;">View invite</a>
            </td>
            ${
              params.icsUrl
                ? `<td style="padding-left:10px;">
                    <a href="${params.icsUrl}" style="display:inline-block;padding:12px 18px;font-size:14px;font-weight:500;color:#0f172a;text-decoration:none;border:1px solid #cbd5e1;border-radius:999px;">Add to calendar</a>
                  </td>`
                : ''
            }
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:16px 28px;border-top:1px solid #f1f5f9;font-size:12px;color:#6b7280;line-height:1.5;">
        Sent via <strong>invited</strong> · No account required.<br />
        <a href="${params.unsubscribeUrl}" style="color:#6b7280;text-decoration:underline;">Unsubscribe from updates for this event</a>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

interface ResendEmailPayload {
  from: string;
  to: string[];
  subject: string;
  html: string;
  text: string;
  headers: Record<string, string>;
  reply_to?: string;
}

function createHeaders(unsubscribeUrl: string): Record<string, string> {
  return {
    'List-Unsubscribe': `<${unsubscribeUrl}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}

/**
 * Sends a confirmation email right after a guest opts into email updates for an event.
 */
export async function sendSubscriptionConfirmationEmail(params: {
  to: string;
  event: EventMeta;
  subId: string;
  baseUrl?: string | null;
  rsvpStatus?: RsvpStatus;
  notifyLevel?: ActiveEmailNotifyLevel;
}): Promise<{ sent: boolean; skipped: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return { sent: false, skipped: true };
  }

  const origin = resolveAppBaseUrl(params.baseUrl);
  const eventUrl = `${origin}/e/${encodeURIComponent(params.event.id)}`;
  const icsUrl = `${origin}/api/events/${encodeURIComponent(params.event.id)}/ics`;
  const unsubscribeUrl = `${origin}/api/events/${encodeURIComponent(params.event.id)}/unsubscribe?subId=${encodeURIComponent(params.subId)}`;

  const whenLine = formatEventWhenLine(params.event);
  const whereLine = formatEventWhereLine(params.event);
  const prefLabel = formatNotifyLevelLabel(params.notifyLevel);

  const subject =
    params.rsvpStatus === 'yes'
      ? `You're in: ${params.event.title}`
      : params.rsvpStatus === 'no'
        ? `RSVP & updates saved: ${params.event.title}`
        : `Reminders enabled: ${params.event.title}`;

  const eyebrow =
    params.rsvpStatus === 'yes'
      ? 'RSVP confirmed'
      : params.rsvpStatus === 'no'
        ? 'RSVP saved'
        : 'Event reminders';

  const message =
    params.rsvpStatus === 'yes'
      ? `You're going to ${params.event.title}! Your email alerts are set to: ${prefLabel}.`
      : params.rsvpStatus === 'no'
        ? `Your RSVP for ${params.event.title} is saved. Your email alerts are set to: ${prefLabel}.`
        : `You're signed up for email updates for ${params.event.title}. Your alert preference is set to: ${prefLabel}.`;

  const replyTo = getReplyToEmail();
  const payload: ResendEmailPayload = {
    from: getFromEmail(),
    to: [params.to],
    subject,
    html: buildEmailHtml({
      eyebrow,
      title: params.event.title,
      message,
      eventUrl,
      icsUrl,
      unsubscribeUrl,
      whenLine,
      whereLine,
      preferenceLine: prefLabel,
    }),
    text: [
      params.event.title,
      message,
      `Alerts: ${prefLabel}`,
      `When: ${whenLine}`,
      whereLine ? `Where: ${whereLine}` : '',
      `View invite: ${eventUrl}`,
      `Calendar (.ics): ${icsUrl}`,
      `Unsubscribe: ${unsubscribeUrl}`,
    ]
      .filter(Boolean)
      .join('\n\n'),
    headers: createHeaders(unsubscribeUrl),
    ...(replyTo ? { reply_to: replyTo } : {}),
  };

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return {
        sent: false,
        skipped: false,
        error: `Email provider returned ${res.status}${errText ? `: ${errText.slice(0, 120)}` : ''}`,
      };
    }

    return { sent: true, skipped: false };
  } catch (err) {
    return {
      sent: false,
      skipped: false,
      error: err instanceof Error ? err.message : 'Network error sending email',
    };
  }
}

/**
 * Sends batched update emails to matching `email` subscribers for an event via Resend's batch API.
 */
export async function sendEventUpdateEmails(params: {
  subscribers: SubscriberRecord[];
  eventId: string;
  eventTitle?: string;
  subject: string;
  bodyText: string;
  baseUrl?: string | null;
  category?: NotificationCategory;
  excludeGuestTokenHash?: string;
  eyebrow?: string;
  whenLine?: string;
  whereLine?: string;
  changeLines?: string[];
}): Promise<{ sent: number; skipped: boolean }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return { sent: 0, skipped: true };
  }

  const category: NotificationCategory = params.category ?? 'event_change';
  const excludeHash = params.excludeGuestTokenHash?.trim().toLowerCase();

  const seenEmails = new Set<string>();
  const emailTargets = params.subscribers.filter(
    (sub): sub is SubscriberRecord & { email: string } => {
      if (
        sub.kind !== 'email' ||
        typeof sub.email !== 'string' ||
        sub.email.trim().length === 0
      ) {
        return false;
      }
      if (excludeHash && sub.guestTokenHash?.toLowerCase() === excludeHash) {
        return false;
      }
      const level = sub.notifyLevel ?? 'host_posts';
      if (category === 'host_post' && level === 'changes') {
        return false;
      }
      if (category === 'guest_post' && level !== 'all_posts') {
        return false;
      }
      const normalizedEmail = sub.email.trim().toLowerCase();
      if (seenEmails.has(normalizedEmail)) {
        return false;
      }
      seenEmails.add(normalizedEmail);
      return true;
    },
  );

  if (emailTargets.length === 0) {
    return { sent: 0, skipped: false };
  }

  const origin = resolveAppBaseUrl(params.baseUrl);
  const eventUrl = `${origin}/e/${encodeURIComponent(params.eventId)}`;
  const icsUrl = `${origin}/api/events/${encodeURIComponent(params.eventId)}/ics`;
  const heading = params.eventTitle?.trim() || params.subject;
  const eyebrow = params.eyebrow?.trim() || 'Event update';
  const cleanChangeLines = (params.changeLines ?? [])
    .map((line) => line.trim())
    .filter(Boolean);

  let sent = 0;
  const from = getFromEmail();
  const replyTo = getReplyToEmail();

  for (let i = 0; i < emailTargets.length; i += 100) {
    const chunk = emailTargets.slice(i, i + 100);
    const messages: ResendEmailPayload[] = chunk.map((sub) => {
      const unsubscribeUrl = `${origin}/api/events/${encodeURIComponent(params.eventId)}/unsubscribe?subId=${encodeURIComponent(sub.id)}`;
      return {
        from,
        to: [sub.email],
        subject: params.subject,
        html: buildEmailHtml({
          eyebrow,
          title: heading,
          message: params.bodyText,
          eventUrl,
          icsUrl,
          unsubscribeUrl,
          whenLine: params.whenLine,
          whereLine: params.whereLine,
          changeLines: cleanChangeLines,
        }),
        text: [
          heading,
          params.bodyText,
          cleanChangeLines.length > 0
            ? `What changed:\n${cleanChangeLines.map((line) => `- ${line}`).join('\n')}`
            : '',
          params.whenLine ? `When: ${params.whenLine}` : '',
          params.whereLine ? `Where: ${params.whereLine}` : '',
          `View invite: ${eventUrl}`,
          `Calendar (.ics): ${icsUrl}`,
          `Unsubscribe: ${unsubscribeUrl}`,
        ]
          .filter(Boolean)
          .join('\n\n'),
        headers: createHeaders(unsubscribeUrl),
        ...(replyTo ? { reply_to: replyTo } : {}),
      };
    });

    try {
      const res = await fetch(RESEND_BATCH_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      });
      if (res.ok) {
        sent += chunk.length;
      }
    } catch {
      // Swallow transient email errors so primary mutation succeeds cleanly
    }
  }

  return { sent, skipped: false };
}
