import { sendNotification, setVapidDetails } from 'web-push';
import {
  isEmailConfigured,
  sendEventUpdateEmails,
} from '@/lib/notifications/email';
import {
  listEventSubscribers,
  removeSubscriber,
} from '@/lib/storage/events';

export interface PushNotificationPayload {
  title: string;
  body: string;
  url: string;
}

export interface NotifyOptions {
  /** Whether to also notify email subscribers (defaults to true for event updates / host announcements). */
  includeEmail?: boolean;
  /** Optional subject override when dispatching email updates. */
  emailSubject?: string;
  /** Event title displayed as the email card heading. */
  eventTitle?: string;
  /** Optional public origin extracted from the incoming request URL. */
  baseUrl?: string | null;
}

/**
 * Returns the configured VAPID public key, or `null` when Web Push is not configured.
 */
export function getVapidPublicKey(): string | null {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  return key || null;
}

function getVapidPrivateKey(): string | null {
  const key = process.env.VAPID_PRIVATE_KEY?.trim();
  return key || null;
}

function isExpiredSubscriptionError(err: unknown): boolean {
  if (typeof err === 'object' && err !== null && 'statusCode' in err) {
    const code = (err as { statusCode?: number }).statusCode;
    return code === 404 || code === 410;
  }
  return false;
}

/**
 * Sends Web Push notifications (and optional batched Email updates) to all event subscribers.
 * Reads subscribers.json once and gracefully skips unconfigured channels.
 */
export async function notifyEventSubscribers(
  eventId: string,
  payload: PushNotificationPayload,
  options: NotifyOptions = {},
): Promise<{
  sent: number;
  removed: number;
  emailSent: number;
  skipped: boolean;
}> {
  const publicKey = getVapidPublicKey();
  const privateKey = getVapidPrivateKey();
  const canSendEmail = options.includeEmail !== false && isEmailConfigured();

  let vapidReady = false;
  if (publicKey && privateKey) {
    const subject =
      process.env.VAPID_SUBJECT?.trim() || 'mailto:hello@invited.app';
    try {
      setVapidDetails(subject, publicKey, privateKey);
      vapidReady = true;
    } catch {
      vapidReady = false;
    }
  }

  if (!vapidReady && !canSendEmail) {
    return { sent: 0, removed: 0, emailSent: 0, skipped: true };
  }

  const subscribers = await listEventSubscribers(eventId);
  if (subscribers.length === 0) {
    return { sent: 0, removed: 0, emailSent: 0, skipped: false };
  }

  let sent = 0;
  let removed = 0;
  let emailSent = 0;

  if (vapidReady) {
    const pushTargets = subscribers.filter(
      (s) => s.kind === 'webpush' && s.subscription,
    );
    const encodedPayload = JSON.stringify(payload);
    await Promise.allSettled(
      pushTargets.map(async (sub) => {
        try {
          await sendNotification(sub.subscription!, encodedPayload);
          sent += 1;
        } catch (err) {
          if (isExpiredSubscriptionError(err)) {
            await removeSubscriber(eventId, sub.id).catch(() => {});
            removed += 1;
          }
        }
      }),
    );
  }

  if (canSendEmail) {
    const emailResult = await sendEventUpdateEmails({
      subscribers,
      eventId,
      eventTitle: options.eventTitle ?? payload.title,
      subject: options.emailSubject ?? payload.title,
      bodyText: payload.body,
      baseUrl: options.baseUrl,
    });
    emailSent = emailResult.sent;
  }

  return { sent, removed, emailSent, skipped: false };
}
