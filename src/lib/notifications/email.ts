import type { SubscriberRecord } from '@/lib/storage/events';
import type { EventMeta } from '@/types/invite';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const RESEND_BATCH_ENDPOINT = 'https://api.resend.com/emails/batch';
const DEFAULT_FROM_EMAIL = 'invited <onboarding@resend.dev>';

/**
 * Returns `true` when transactional email sending via Resend is configured.
 */
export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

/**
 * Returns the configured sender header (`INVITED_FROM_EMAIL` or default onboarding address).
 */
export function getFromEmail(): string {
  return process.env.INVITED_FROM_EMAIL?.trim() || DEFAULT_FROM_EMAIL;
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
    'https://invited-lyart.vercel.app',
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

  return 'https://invited-lyart.vercel.app';
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatReadableEventWhen(startIso: string, timeZone: string): string {
  try {
    const clean = startIso.replace(/\[[^\]]+\]$/, '');
    const date = new Date(clean);
    if (Number.isNaN(date.getTime())) return startIso;
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: timeZone || 'UTC',
    }).format(date);
  } catch {
    return startIso;
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
}): string {
  const safeEyebrow = escapeHtml(params.eyebrow);
  const safeTitle = escapeHtml(params.title);
  const safeMessage = escapeHtml(params.message);
  const safeWhen = params.whenLine ? escapeHtml(params.whenLine) : null;
  const safeWhere = params.whereLine ? escapeHtml(params.whereLine) : null;

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
          safeWhen || safeWhere
            ? `<div style="margin:0 0 20px;padding:14px 16px;background:#f8fafc;border-radius:14px;border:1px solid #e2e8f0;font-size:13px;line-height:1.5;color:#334155;">
                ${safeWhen ? `<div><strong>When:</strong> ${safeWhen}</div>` : ''}
                ${safeWhere ? `<div style="margin-top:4px;"><strong>Where:</strong> ${safeWhere}</div>` : ''}
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
}): Promise<{ sent: boolean; skipped: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return { sent: false, skipped: true };
  }

  const origin = resolveAppBaseUrl(params.baseUrl);
  const eventUrl = `${origin}/e/${encodeURIComponent(params.event.id)}`;
  const icsUrl = `${origin}/api/events/${encodeURIComponent(params.event.id)}/ics`;
  const unsubscribeUrl = `${origin}/api/events/${encodeURIComponent(params.event.id)}/unsubscribe?subId=${encodeURIComponent(params.subId)}`;

  const whenLine = formatReadableEventWhen(params.event.startIso, params.event.timeZone);
  const whereLine =
    [params.event.locationName, params.event.locationAddress].filter(Boolean).join(', ') ||
    undefined;

  const subject = `Reminders enabled: ${params.event.title}`;
  const message =
    "You're signed up for email updates when the host changes event details or posts an announcement.";

  const payload: ResendEmailPayload = {
    from: getFromEmail(),
    to: [params.to],
    subject,
    html: buildEmailHtml({
      eyebrow: 'Event reminders',
      title: params.event.title,
      message,
      eventUrl,
      icsUrl,
      unsubscribeUrl,
      whenLine,
      whereLine,
    }),
    text: [
      params.event.title,
      message,
      `When: ${whenLine}`,
      whereLine ? `Where: ${whereLine}` : '',
      `View invite: ${eventUrl}`,
      `Calendar (.ics): ${icsUrl}`,
      `Unsubscribe: ${unsubscribeUrl}`,
    ]
      .filter(Boolean)
      .join('\n\n'),
    headers: createHeaders(unsubscribeUrl),
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
 * Sends batched update emails to all `email` subscribers for an event via Resend's batch API.
 */
export async function sendEventUpdateEmails(params: {
  subscribers: SubscriberRecord[];
  eventId: string;
  eventTitle?: string;
  subject: string;
  bodyText: string;
  baseUrl?: string | null;
}): Promise<{ sent: number; skipped: boolean }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return { sent: 0, skipped: true };
  }

  const emailTargets = params.subscribers.filter(
    (sub): sub is SubscriberRecord & { email: string } =>
      sub.kind === 'email' && typeof sub.email === 'string' && sub.email.trim().length > 0,
  );

  if (emailTargets.length === 0) {
    return { sent: 0, skipped: false };
  }

  const origin = resolveAppBaseUrl(params.baseUrl);
  const eventUrl = `${origin}/e/${encodeURIComponent(params.eventId)}`;
  const icsUrl = `${origin}/api/events/${encodeURIComponent(params.eventId)}/ics`;
  const heading = params.eventTitle?.trim() || params.subject;

  let sent = 0;
  const from = getFromEmail();

  for (let i = 0; i < emailTargets.length; i += 100) {
    const chunk = emailTargets.slice(i, i + 100);
    const messages: ResendEmailPayload[] = chunk.map((sub) => {
      const unsubscribeUrl = `${origin}/api/events/${encodeURIComponent(params.eventId)}/unsubscribe?subId=${encodeURIComponent(sub.id)}`;
      return {
        from,
        to: [sub.email],
        subject: params.subject,
        html: buildEmailHtml({
          eyebrow: 'Event update',
          title: heading,
          message: params.bodyText,
          eventUrl,
          icsUrl,
          unsubscribeUrl,
        }),
        text: [
          heading,
          params.bodyText,
          `View invite: ${eventUrl}`,
          `Unsubscribe: ${unsubscribeUrl}`,
        ].join('\n\n'),
        headers: createHeaders(unsubscribeUrl),
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
