import { sendNotification, setVapidDetails } from 'web-push';
import {
  listEventSubscribers,
  removeSubscriber,
} from '@/lib/storage/events';

export interface PushNotificationPayload {
  title: string;
  body: string;
  url: string;
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
 * Sends a Web Push notification to all `webpush` subscribers of an event.
 * Gracefully no-ops when VAPID keys are unconfigured and prunes 404/410 expired endpoints.
 */
export async function notifyEventSubscribers(
  eventId: string,
  payload: PushNotificationPayload,
): Promise<{ sent: number; removed: number; skipped: boolean }> {
  const publicKey = getVapidPublicKey();
  const privateKey = getVapidPrivateKey();
  if (!publicKey || !privateKey) {
    return { sent: 0, removed: 0, skipped: true };
  }

  const subject =
    process.env.VAPID_SUBJECT?.trim() || 'mailto:hello@invited.app';

  try {
    setVapidDetails(subject, publicKey, privateKey);
  } catch {
    return { sent: 0, removed: 0, skipped: true };
  }

  const subscribers = await listEventSubscribers(eventId);
  const pushTargets = subscribers.filter(
    (s) => s.kind === 'webpush' && s.subscription,
  );

  if (pushTargets.length === 0) {
    return { sent: 0, removed: 0, skipped: false };
  }

  const encodedPayload = JSON.stringify(payload);
  let sent = 0;
  let removed = 0;

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

  return { sent, removed, skipped: false };
}
