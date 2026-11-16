'use client';

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Bell, Calendar, Check, Download, Mail, X } from 'lucide-react';
import { getDeviceProfile, saveDeviceProfile } from '@/lib/client/deviceProfile';
import { setupDialogLightDismiss } from '@/lib/polyfills/ui';

interface SubscribeControlProps {
  eventId: string;
  eventTitle: string;
  subscriberCount: number;
  openSignal?: number;
  onSubscribed?: () => void;
  variant?: 'pill' | 'inline' | 'link';
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) {
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
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const emailInputId = useId();
  const lastOpenSignalRef = useRef(openSignal);

  const [pushSupported, setPushSupported] = useState(false);
  const [vapidPublicKey, setVapidPublicKey] = useState<string | null | undefined>(
    undefined,
  );
  const [pushBusy, setPushBusy] = useState(false);
  const [pushDone, setPushDone] = useState(false);
  const [pushMessage, setPushMessage] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailDone, setEmailDone] = useState(false);
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

  const openDialog = useCallback(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const profile = getDeviceProfile();
    if (profile?.email && !email) {
      setEmail(profile.email);
    }
    if (!dialog.open) {
      dialog.showModal();
    }
    void checkCapabilities();
  }, [checkCapabilities, email]);

  const closeDialog = useCallback(() => {
    dialogRef.current?.close();
  }, []);

  useEffect(() => {
    return setupDialogLightDismiss(dialogRef.current);
  }, []);

  useEffect(() => {
    if (openSignal > lastOpenSignalRef.current) {
      lastOpenSignalRef.current = openSignal;
      openDialog();
    }
  }, [openSignal, openDialog]);

  async function handleEnablePush() {
    if (!pushSupported || !vapidPublicKey) return;
    setPushBusy(true);
    setPushMessage(null);

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setPushMessage(
          'Notifications blocked in browser settings. Use Email or Calendar below.',
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
        setPushMessage(err.error || 'Could not enable push alerts.');
        return;
      }

      setPushDone(true);
      setPushMessage("You're subscribed to browser alerts for this event.");
      onSubscribed?.();
    } catch {
      setPushMessage('Could not subscribe to push notifications on this device.');
    } finally {
      setPushBusy(false);
    }
  }

  async function handleEmailSubscribe(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    setEmailBusy(true);
    setEmailMessage(null);

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
        setEmailMessage(data.error || 'Please enter a valid email address.');
        return;
      }
      saveDeviceProfile({ email: trimmed });
      setEmailDone(true);
      setEmailMessage('Saved! We will keep this only for updates to this event.');
      onSubscribed?.();
    } catch {
      setEmailMessage('Network error saving your email.');
    } finally {
      setEmailBusy(false);
    }
  }

  const pushAvailable = pushSupported && Boolean(vapidPublicKey);

  return (
    <>
      {variant === 'pill' ? (
        <button
          type="button"
          onClick={openDialog}
          aria-label="Event notifications and reminders"
          className="h-8 inline-flex items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition hover:opacity-90 cursor-pointer shrink-0"
          style={{
            backgroundColor: 'var(--theme-glass-bg)',
            borderColor: 'var(--theme-hairline)',
            color: 'var(--theme-text-primary)',
          }}
        >
          <Bell className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="hidden sm:inline">Reminders</span>
          {subscriberCount > 0 ? (
            <span
              className="hidden sm:inline text-[11px] tabular-nums opacity-75"
              style={{ color: 'var(--theme-text-muted)' }}
            >
              {subscriberCount}
            </span>
          ) : null}
        </button>
      ) : variant === 'link' ? (
        <button
          type="button"
          onClick={openDialog}
          className="inline-flex items-center gap-1.5 hover:underline cursor-pointer"
        >
          <Bell className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>Get updates{subscriberCount > 0 ? ` (${subscriberCount})` : ''}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={openDialog}
          className="inline-flex items-center justify-center gap-2 rounded-xl border px-3.5 py-2 text-xs sm:text-sm font-medium transition hover:opacity-90 cursor-pointer"
          style={{
            backgroundColor: 'var(--theme-surface-bg)',
            borderColor: 'var(--theme-border)',
            color: 'var(--theme-text-primary)',
          }}
        >
          <Bell className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Get reminders</span>
        </button>
      )}

      <dialog
        ref={dialogRef}
        closedby="any"
        aria-labelledby={titleId}
        className="w-[calc(100%-2rem)] max-w-md mx-auto my-auto rounded-3xl border p-5 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
        style={{
          backgroundColor: 'var(--theme-card-solid, var(--theme-surface-bg))',
          borderColor: 'var(--theme-border, rgba(255,255,255,0.15))',
          color: 'var(--theme-text-primary, #f8fafc)',
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2
              id={titleId}
              className="text-lg font-semibold leading-snug"
              style={{
                fontFamily: 'var(--font-invite-display), var(--font-invite-body), sans-serif',
              }}
            >
              Event reminders
            </h2>
            <p
              className="mt-0.5 text-xs truncate"
              style={{ color: 'var(--theme-text-muted)' }}
            >
              {eventTitle} · No sign-in needed
            </p>
          </div>

          <button
            type="button"
            onClick={closeDialog}
            aria-label="Close reminders dialog"
            className="h-8 w-8 rounded-full border flex items-center justify-center shrink-0 opacity-75 hover:opacity-100 cursor-pointer"
            style={{ borderColor: 'var(--theme-hairline)' }}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {pushAvailable ? (
            <div
              className="rounded-xl border p-3.5 space-y-2"
              style={{
                backgroundColor: 'var(--theme-card-bg)',
                borderColor: 'var(--theme-hairline)',
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Bell
                    className="h-4 w-4 shrink-0"
                    style={{ color: 'var(--theme-accent)' }}
                    aria-hidden="true"
                  />
                  <span className="text-sm font-medium truncate">Device notifications</span>
                </div>
                <button
                  type="button"
                  disabled={pushBusy || pushDone}
                  onClick={() => void handleEnablePush()}
                  className="invite-cta-btn shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition disabled:opacity-60 cursor-pointer"
                >
                  {pushDone ? 'Enabled' : pushBusy ? 'Enabling...' : 'Enable'}
                </button>
              </div>
              {pushMessage ? (
                <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                  {pushMessage}
                </p>
              ) : null}
            </div>
          ) : null}

          <form onSubmit={handleEmailSubscribe} className="space-y-2">
            <label
              htmlFor={emailInputId}
              className="flex items-center gap-1.5 text-xs font-medium"
              style={{ color: 'var(--theme-text-muted)' }}
            >
              <Mail className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Email updates</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                id={emailInputId}
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailDone) setEmailDone(false);
                }}
                placeholder="you@example.com"
                className="flex-1 min-w-0 rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2"
                style={{
                  backgroundColor: 'var(--theme-card-bg)',
                  borderColor: 'var(--theme-border)',
                  color: 'var(--theme-text-primary)',
                }}
              />
              <button
                type="submit"
                disabled={emailBusy || !email.trim()}
                className="invite-cta-btn shrink-0 rounded-full px-4 py-2 text-xs sm:text-sm font-semibold transition disabled:opacity-50 cursor-pointer inline-flex items-center gap-1.5"
              >
                {emailDone ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : null}
                <span>{emailDone ? 'Saved' : emailBusy ? '...' : 'Save'}</span>
              </button>
            </div>
            {emailMessage ? (
              <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                {emailMessage}
              </p>
            ) : null}
          </form>

          <div className="pt-2 border-t" style={{ borderColor: 'var(--theme-hairline)' }}>
            <a
              href={`/api/events/${eventId}/ics`}
              className="flex items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-xs sm:text-sm font-medium transition hover:opacity-90"
              style={{
                backgroundColor: 'var(--theme-card-bg)',
                borderColor: 'var(--theme-hairline)',
                color: 'var(--theme-text-primary)',
              }}
            >
              <span className="inline-flex items-center gap-2">
                <Calendar className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Add to calendar (.ics)</span>
              </span>
              <Download className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />
            </a>
          </div>
        </div>
      </dialog>
    </>
  );
}
