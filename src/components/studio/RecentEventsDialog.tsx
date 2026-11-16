'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Check,
  Copy,
  ExternalLink,
  KeyRound,
  MapPin,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { InstallAppButton } from '@/components/pwa/InstallAppButton';
import {
  getRecentEvents,
  getRecentEventsServerSnapshot,
  removeRecentEvent,
  subscribeRecentEvents,
} from '@/lib/client/recentEvents';
import { setupDialogLightDismiss } from '@/lib/polyfills/ui';

interface RecentEventsDialogProps {
  open: boolean;
  onClose: () => void;
}

function formatShortDate(iso?: string, timeZone?: string): string {
  if (!iso) return 'Date to be decided';
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return 'Date to be decided';
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      ...(timeZone ? { timeZone } : {}),
    }).format(date);
  } catch {
    return 'Date to be decided';
  }
}

export function RecentEventsDialog({
  open,
  onClose,
}: RecentEventsDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const events = useSyncExternalStore(
    subscribeRecentEvents,
    getRecentEvents,
    getRecentEventsServerSnapshot,
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const cleanupDismiss = setupDialogLightDismiss(dialog);
    const handleClose = () => {
      onClose();
    };
    dialog.addEventListener('close', handleClose);

    return () => {
      cleanupDismiss();
      dialog.removeEventListener('close', handleClose);
    };
  }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      if (typeof dialog.showModal === 'function') {
        dialog.showModal();
      } else {
        dialog.setAttribute('open', '');
      }
    } else if (!open && dialog.open) {
      if (typeof dialog.close === 'function') {
        dialog.close();
      } else {
        dialog.removeAttribute('open');
      }
    }
  }, [open]);

  const handleCopy = async (tag: string, relativeOrFullUrl: string) => {
    try {
      const fullUrl =
        relativeOrFullUrl.startsWith('http') || typeof window === 'undefined'
          ? relativeOrFullUrl
          : `${window.location.origin}${relativeOrFullUrl}`;
      await navigator.clipboard.writeText(fullUrl);
      setCopiedId(tag);
      window.setTimeout(() => {
        setCopiedId((current) => (current === tag ? null : current));
      }, 2000);
    } catch {
      // Clipboard write unavailable
    }
  };

  const handleForget = (eventId: string) => {
    removeRecentEvent(eventId);
  };

  return (
    <dialog
      ref={dialogRef}
      closedby="any"
      aria-labelledby="my-invites-dialog-title"
      data-testid="my-invites-dialog"
      className="w-full sm:w-[min(94vw,540px)] max-h-[86dvh] mx-auto mt-auto mb-0 sm:my-auto overflow-hidden rounded-t-3xl sm:rounded-3xl border shadow-2xl p-0 backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      style={{
        backgroundColor: 'var(--theme-card-solid, #121a2e)',
        borderColor: 'var(--theme-border, rgba(255,255,255,0.16))',
        color: 'var(--theme-text-primary, #f8fafc)',
      }}
    >
      <div className="flex flex-col max-h-[86dvh]">
      <div
        className="shrink-0 flex items-center justify-between gap-4 border-b px-5 py-4"
        style={{ borderColor: 'var(--theme-hairline, rgba(255,255,255,0.12))' }}
      >
        <div className="min-w-0">
          <h2
            id="my-invites-dialog-title"
            className="text-lg sm:text-xl font-bold tracking-tight"
            style={{
              fontFamily: 'var(--font-invite-display), var(--font-invite-body), sans-serif',
            }}
          >
            My Invites
          </h2>
          <p
            className="text-xs mt-0.5"
            style={{ color: 'var(--theme-text-muted, #a3b3cf)' }}
          >
            Saved on this device — no sign-in needed.
          </p>
        </div>

        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          aria-label="Close My Invites"
          className="h-9 w-9 rounded-full border inline-flex items-center justify-center opacity-80 hover:opacity-100 transition cursor-pointer shrink-0"
          style={{
            borderColor: 'var(--theme-hairline, rgba(255,255,255,0.16))',
            color: 'var(--theme-text-primary, #f8fafc)',
          }}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-3">
        {events.length === 0 ? (
          <div
            className="rounded-2xl border border-dashed p-7 text-center space-y-3"
            style={{
              backgroundColor: 'var(--theme-surface-bg, rgba(255,255,255,0.04))',
              borderColor: 'var(--theme-border, rgba(255,255,255,0.14))',
            }}
          >
            <p className="text-base font-semibold">No invites saved yet</p>
            <p
              className="text-sm max-w-sm mx-auto"
              style={{ color: 'var(--theme-text-muted, #a3b3cf)' }}
            >
              When you create or open an invite, you can jump back to it here anytime.
            </p>
            <div className="pt-1">
              <Link
                href="/"
                onClick={() => dialogRef.current?.close()}
                className="invite-cta-btn inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold shadow-md transition hover:opacity-95"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span>Create an invite</span>
              </Link>
            </div>
          </div>
        ) : (
          <ul className="space-y-3">
            {events.map((entry) => {
              const guestTag = `guest-${entry.id}`;
              const editTag = `edit-${entry.id}`;
              return (
                <li
                  key={entry.id}
                  className="rounded-2xl border p-4 space-y-3"
                  style={{
                    backgroundColor: 'var(--theme-surface-bg, rgba(255,255,255,0.05))',
                    borderColor: 'var(--theme-hairline, rgba(255,255,255,0.14))',
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold"
                          style={
                            entry.role === 'host'
                              ? {
                                  backgroundColor: 'var(--theme-card-bg)',
                                  borderColor: 'var(--theme-accent)',
                                  color: 'var(--theme-accent)',
                                }
                              : {
                                  backgroundColor: 'var(--theme-card-bg)',
                                  borderColor: 'var(--theme-hairline)',
                                  color: 'var(--theme-text-muted)',
                                }
                          }
                        >
                          {entry.role === 'host' ? 'Hosting' : 'Opened'}
                        </span>
                        <h3 className="text-base font-semibold truncate">
                          {entry.title}
                        </h3>
                      </div>

                      <div
                        className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs"
                        style={{ color: 'var(--theme-text-muted, #a3b3cf)' }}
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          <span>{formatShortDate(entry.startIso, entry.timeZone)}</span>
                        </span>
                        {entry.locationName ? (
                          <span className="inline-flex items-center gap-1.5 min-w-0">
                            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            <span className="truncate">{entry.locationName}</span>
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleForget(entry.id)}
                      aria-label={`Remove ${entry.title} from saved invites`}
                      title="Remove from list"
                      className="inline-flex items-center justify-center rounded-full opacity-60 hover:opacity-100 hover:text-rose-500 transition h-8 w-8 shrink-0 cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-0.5">
                    <Link
                      href={entry.guestUrl}
                      onClick={() => dialogRef.current?.close()}
                      className="invite-cta-btn inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold shadow-sm transition hover:opacity-95"
                    >
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Open</span>
                    </Link>

                    <button
                      type="button"
                      onClick={() => void handleCopy(guestTag, entry.guestUrl)}
                      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition hover:opacity-85 cursor-pointer"
                      style={{
                        borderColor: 'var(--theme-border, rgba(255,255,255,0.16))',
                        color: 'var(--theme-text-primary, #f8fafc)',
                      }}
                    >
                      {copiedId === guestTag ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Copy link</span>
                        </>
                      )}
                    </button>

                    {entry.editUrl ? (
                      <>
                        <Link
                          href={entry.editUrl}
                          onClick={() => dialogRef.current?.close()}
                          className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition hover:opacity-85"
                          style={{
                            borderColor: 'var(--theme-border, rgba(255,255,255,0.16))',
                            color: 'var(--theme-text-primary, #f8fafc)',
                          }}
                        >
                          <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Edit</span>
                        </Link>
                        <button
                          type="button"
                          onClick={() => void handleCopy(editTag, entry.editUrl ?? '')}
                          className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition hover:opacity-85 cursor-pointer"
                          style={{
                            borderColor: 'var(--theme-hairline, rgba(255,255,255,0.12))',
                            color: 'var(--theme-text-muted, #a3b3cf)',
                          }}
                        >
                          {copiedId === editTag ? (
                            <>
                              <Check className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
                              <span>Copied edit link</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>Copy edit link</span>
                            </>
                          )}
                        </button>
                      </>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div
        className="shrink-0 border-t px-5 py-3 flex items-center justify-between gap-3"
        style={{ borderColor: 'var(--theme-hairline, rgba(255,255,255,0.12))' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <InstallAppButton />
          <p
            className="text-xs truncate"
            style={{ color: 'var(--theme-text-muted, #a3b3cf)' }}
          >
            Stored on this device
          </p>
        </div>

        <Link
          href="/"
          onClick={() => dialogRef.current?.close()}
          className="invite-cta-btn inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition hover:opacity-95 shrink-0"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          <span>New invite</span>
        </Link>
      </div>
      </div>
    </dialog>
  );
}
