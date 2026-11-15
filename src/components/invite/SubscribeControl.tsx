'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, BellRing, Calendar, Check, Mail, X } from 'lucide-react';
import { setupDialogLightDismiss } from '@/lib/polyfills/ui';

interface SubscribeControlProps {
  eventId: string;
  eventTitle: string;
  subscriberCount: number;
  openSignal?: number;
  onSubscribed?: () => void;
  variant?: 'pill' | 'inline';
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function SubscribeControl({
  eventId,
  eventTitle,
  subscriberCount,
  openSignal = 0,
  onSubscribed,
  variant = 'pill',
}: SubscribeControlProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const lastOpenSignalRef = useRef<number>(openSignal);

  const [vapidPublicKey, setVapidPublicKey] = useState<string | null | undefined>(undefined);
  const [pushSupported, setPushSupported] = useState<boolean>(false);
  const [pushBusy, setPushBusy] = useState<boolean>(false);
  const [pushDone, setPushDone] = useState<boolean>(false);
  const [pushMessage, setPushMessage] = useState<string | null>(null);

  const [email, setEmail] = useState<string>('');
  const [emailBusy, setEmailBusy] = useState<boolean>(false);
  const [emailDone, setEmailDone] = useState<boolean>(false);
  const [emailMessage, setEmailMessage] = useState<string | null>(null);

  const checkCapabilities = useCallback(async () => {
    const supported =
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window;
    setPushSupported(supported);

    if (vapidPublicKey !== undefined) return;
    try {
      const res = await fetch('/api/push/vapid-public-key', { cache: 'no-store' });
      if (!res.ok) {
        setVapidPublicKey(null);
        return;
      }
      const data = (await res.json()) as { publicKey?: string | null };
      setVapidPublicKey(data.publicKey ?? null);
    } catch {
      setVapidPublicKey(null);
    }
  }, [vapidPublicKey]);

  const openModal = useCallback(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
    void checkCapabilities();
  }, [checkCapabilities]);

  useEffect(() => {
    return setupDialogLightDismiss(dialogRef.current);
  }, []);

  useEffect(() => {
    if (openSignal > lastOpenSignalRef.current) {
      lastOpenSignalRef.current = openSignal;
      const dialog = dialogRef.current;
      if (dialog && !dialog.open) {
        dialog.showModal();
      }
      void fetch('/api/push/vapid-public-key', { cache: 'no-store' })
        .then((res) => (res.ok ? res.json() : { publicKey: null }))
        .then((data: { publicKey?: string | null }) => {
          const supported =
            typeof window !== 'undefined' &&
            'serviceWorker' in navigator &&
            'PushManager' in window &&
            'Notification' in window;
          setPushSupported(supported);
          setVapidPublicKey(data.publicKey ?? null);
        })
        .catch(() => {
          setVapidPublicKey(null);
        });
    }
  }, [openSignal]);

  const handleEnablePush = async () => {
    setPushMessage(null);
    if (!pushSupported) {
      setPushMessage('This browser does not support Web Push notifications.');
      return;
    }
    if (!vapidPublicKey) {
      setPushMessage(
        'Push notifications are not enabled on this server yet — try Email updates or Calendar reminders below.',
      );
      return;
    }

    setPushBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setPushMessage(
          'Notification permission was not granted. You can still get updates via Email or Calendar below.',
        );
        return;
      }

      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ||
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        }));

      const res = await fetch(`/api/events/${encodeURIComponent(eventId)}/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'webpush',
          subscription: subscription.toJSON(),
        }),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        setPushMessage(err.error || 'Could not save browser notification subscription.');
        return;
      }

      setPushDone(true);
      setPushMessage("You're subscribed to browser alerts for this event!");
      onSubscribed?.();
    } catch {
      setPushMessage(
        'Could not activate browser notifications. Try Email updates or Calendar reminders below.',
      );
    } finally {
      setPushBusy(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setEmailMessage(null);
    const trimmed = email.trim();
    if (!trimmed) {
      setEmailMessage('Please enter a valid email address.');
      return;
    }

    setEmailBusy(true);
    try {
      const res = await fetch(`/api/events/${encodeURIComponent(eventId)}/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'email',
          email: trimmed,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setEmailMessage(data.error || 'Could not save your email.');
        return;
      }
      setEmailDone(true);
      setEmail('');
      setEmailMessage('Saved privately! We will only keep this for event updates.');
      onSubscribed?.();
    } catch {
      setEmailMessage('Network error while saving your email.');
    } finally {
      setEmailBusy(false);
    }
  };

  return (
    <>
      {variant === 'pill' ? (
        <button
          type="button"
          onClick={openModal}
          className="invite-pill inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs sm:text-sm font-medium min-h-[44px] transition-opacity hover:opacity-85 cursor-pointer"
          style={{
            backgroundColor: 'var(--theme-card-bg)',
            borderColor: 'var(--theme-border)',
            color: 'var(--theme-text-primary)',
          }}
          aria-label="Get event updates (optional)"
        >
          {pushDone || emailDone ? (
            <BellRing className="h-4 w-4" style={{ color: 'var(--theme-accent)' }} aria-hidden="true" />
          ) : (
            <Bell className="h-4 w-4" aria-hidden="true" />
          )}
          <span className="hidden sm:inline">Updates</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={openModal}
          className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium min-h-[48px] transition-opacity hover:opacity-85 cursor-pointer"
          style={{
            backgroundColor: 'var(--theme-card-bg)',
            borderColor: 'var(--theme-border)',
            color: 'var(--theme-text-primary)',
          }}
        >
          <Bell className="h-4 w-4" style={{ color: 'var(--theme-accent)' }} aria-hidden="true" />
          <span>Get Event Updates (Optional)</span>
        </button>
      )}

      <dialog
        ref={dialogRef}
        closedby="any"
        aria-labelledby="subscribe-dialog-title"
        className="m-auto w-[min(92vw,32rem)] rounded-2xl border p-0 shadow-2xl"
        style={{
          backgroundColor: 'var(--theme-card-bg)',
          borderColor: 'var(--theme-border)',
          color: 'var(--theme-text-primary)',
        }}
      >
        <div className="p-5 sm:p-6 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2
                id="subscribe-dialog-title"
                className="text-xl font-semibold tracking-tight"
                style={{ fontFamily: 'var(--theme-font-heading)' }}
              >
                Get Event Updates (Optional)
              </h2>
              <p className="text-sm mt-1" style={{ color: 'var(--theme-text-muted)' }}>
                Stay in the loop for <span className="font-medium">{eventTitle}</span> — zero
                accounts required.
                {subscriberCount > 0 ? ` (${subscriberCount} subscribed)` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              aria-label="Close updates dialog"
              className="inline-flex h-11 w-11 min-w-[44px] min-h-[44px] shrink-0 items-center justify-center rounded-full border transition-opacity hover:opacity-80 cursor-pointer"
              style={{ borderColor: 'var(--theme-border)' }}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {/* Option A: Browser Push Notifications */}
          <div
            className="rounded-xl border p-4 space-y-3"
            style={{
              backgroundColor: 'var(--theme-surface-bg)',
              borderColor: 'var(--theme-border)',
            }}
          >
            <div className="flex items-center gap-2 font-semibold text-sm">
              <BellRing className="h-4 w-4" style={{ color: 'var(--theme-accent)' }} aria-hidden="true" />
              <span>Browser Push Alerts (Free, Instant)</span>
            </div>

            {vapidPublicKey === undefined ? (
              <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                Checking push availability...
              </p>
            ) : !pushSupported ? (
              <p className="text-xs leading-relaxed" style={{ color: 'var(--theme-text-muted)' }}>
                Web Push isn&apos;t available in this browser context. Use Email updates or the
                Calendar reminder below instead.
              </p>
            ) : !vapidPublicKey ? (
              <p className="text-xs leading-relaxed" style={{ color: 'var(--theme-text-muted)' }}>
                Server push notifications aren&apos;t configured right now. Use Email updates or
                Calendar reminders below!
              </p>
            ) : (
              <div className="space-y-2.5">
                <p className="text-xs leading-relaxed" style={{ color: 'var(--theme-text-muted)' }}>
                  Get notified right in your browser if the time, location, or host notes change.
                </p>
                <button
                  type="button"
                  disabled={pushBusy || pushDone}
                  onClick={() => void handleEnablePush()}
                  className="invite-on-accent inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold min-h-[48px] transition-opacity hover:opacity-90 disabled:opacity-65 cursor-pointer"
                  style={{ backgroundColor: 'var(--theme-accent)' }}
                >
                  {pushDone ? (
                    <>
                      <Check className="h-4 w-4" aria-hidden="true" />
                      <span>Push Alerts Enabled</span>
                    </>
                  ) : (
                    <>
                      <Bell className="h-4 w-4" aria-hidden="true" />
                      <span>{pushBusy ? 'Enabling...' : 'Enable Push Notifications'}</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {pushMessage && (
              <p className="text-xs font-medium" role="status">
                {pushMessage}
              </p>
            )}
          </div>

          {/* Option B: Optional Private Email */}
          <form
            onSubmit={handleEmailSubmit}
            className="rounded-xl border p-4 space-y-3"
            style={{
              backgroundColor: 'var(--theme-surface-bg)',
              borderColor: 'var(--theme-border)',
            }}
          >
            <label htmlFor="subscribe-email-input" className="flex items-center gap-2 font-semibold text-sm">
              <Mail className="h-4 w-4" style={{ color: 'var(--theme-accent)' }} aria-hidden="true" />
              <span>Email for event updates (optional, kept private)</span>
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                id="subscribe-email-input"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailMessage) setEmailMessage(null);
                }}
                placeholder="you@example.com"
                className="flex-1 rounded-xl border px-3.5 py-2.5 min-h-[48px] focus:outline-none focus-visible:ring-2"
                style={{
                  fontSize: 'max(1rem, 1em)',
                  backgroundColor: 'var(--theme-card-bg)',
                  borderColor: 'var(--theme-border)',
                  color: 'var(--theme-text-primary)',
                }}
              />
              <button
                type="submit"
                disabled={emailBusy}
                className="inline-flex items-center justify-center rounded-xl border px-4 py-2.5 text-sm font-semibold min-h-[48px] transition-opacity hover:opacity-85 disabled:opacity-50 cursor-pointer"
                style={{
                  backgroundColor: 'var(--theme-card-bg)',
                  borderColor: 'var(--theme-border)',
                }}
              >
                {emailBusy ? 'Saving...' : emailDone ? 'Saved ✓' : 'Notify Me'}
              </button>
            </div>
            {emailMessage && (
              <p className="text-xs font-medium" role="status">
                {emailMessage}
              </p>
            )}
          </form>

          {/* Option C: Calendar Reminder (.ics) */}
          <div
            className="rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            style={{
              backgroundColor: 'var(--theme-surface-bg)',
              borderColor: 'var(--theme-border)',
            }}
          >
            <div className="space-y-0.5">
              <p className="font-semibold text-sm flex items-center gap-2">
                <Calendar className="h-4 w-4" style={{ color: 'var(--theme-accent)' }} aria-hidden="true" />
                <span>Calendar Reminder</span>
              </p>
              <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                Includes automatic 24-hour &amp; 1-hour native alerts.
              </p>
            </div>
            <a
              href={`/api/events/${encodeURIComponent(eventId)}/ics`}
              download
              className="inline-flex items-center justify-center rounded-xl border px-4 py-2.5 text-sm font-semibold min-h-[48px] shrink-0 transition-opacity hover:opacity-85"
              style={{
                backgroundColor: 'var(--theme-card-bg)',
                borderColor: 'var(--theme-border)',
              }}
            >
              Download .ics
            </a>
          </div>
        </div>
      </dialog>
    </>
  );
}
