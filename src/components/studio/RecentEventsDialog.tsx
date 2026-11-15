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
import { setupDialogLightDismiss } from '@/lib/polyfills/ui';
import {
  getRecentEvents,
  getRecentEventsServerSnapshot,
  removeRecentEvent,
  subscribeRecentEvents,
} from '@/lib/client/recentEvents';

interface RecentEventsDialogProps {
  open: boolean;
  onClose: () => void;
}

function formatShortDate(iso?: string, timeZone?: string): string {
  if (!iso) return 'Date TBD';
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return 'Date TBD';
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      ...(timeZone ? { timeZone } : {}),
    }).format(date);
  } catch {
    return 'Date TBD';
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
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
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
      aria-labelledby="my-events-dialog-title"
      className="m-auto w-[min(94vw,640px)] max-h-[86dvh] overflow-hidden rounded-3xl border border-white/15 bg-slate-950/95 text-slate-100 shadow-2xl p-0 backdrop:bg-black/60"
    >
      <div className="flex items-center justify-between gap-4 border-b border-white/10 px-6 py-4">
        <div>
          <h2
            id="my-events-dialog-title"
            className="text-xl font-semibold tracking-tight text-white"
          >
            My Events
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Saved locally on this browser — no accounts required.
          </p>
        </div>
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          aria-label="Close My Events"
          className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 text-slate-300 hover:bg-white/15 hover:text-white transition min-h-[44px] min-w-[44px]"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <div className="overflow-y-auto max-h-[calc(86dvh-140px)] p-6 space-y-4">
        {events.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-8 text-center space-y-3">
            <p className="text-base font-medium text-slate-200">
              No saved invites on this browser yet
            </p>
            <p className="text-sm text-slate-400 max-w-md mx-auto">
              Whenever you publish or open an event on invited, its Guest Link
              and your Host Edit Link appear right here for quick access.
            </p>
            <div className="pt-2">
              <Link
                href="/create"
                onClick={() => dialogRef.current?.close()}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-emerald-300 transition min-h-[48px]"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Create Your First Invite
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
                  className="invite-card rounded-2xl border border-white/12 bg-white/[0.04] p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            entry.role === 'host'
                              ? 'bg-amber-400/15 text-amber-200 border border-amber-400/30'
                              : 'bg-sky-400/15 text-sky-200 border border-sky-400/30'
                          }`}
                        >
                          {entry.role === 'host' ? (
                            <>
                              <KeyRound className="h-3 w-3" aria-hidden="true" />
                              Host
                            </>
                          ) : (
                            'Visited'
                          )}
                        </span>
                        <h3 className="text-base font-semibold text-white truncate">
                          {entry.title}
                        </h3>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                          {formatShortDate(entry.startIso, entry.timeZone)}
                        </span>
                        {entry.locationName ? (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                            {entry.locationName}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleForget(entry.id)}
                      aria-label={`Remove ${entry.title} from saved events`}
                      title="Remove from this browser"
                      className="inline-flex items-center justify-center rounded-xl text-slate-400 hover:bg-rose-500/15 hover:text-rose-300 transition min-h-[40px] min-w-[40px]"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Link
                      href={entry.guestUrl}
                      onClick={() => dialogRef.current?.close()}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3.5 py-2 text-sm font-medium text-white hover:bg-white/20 transition min-h-[44px]"
                    >
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      Guest Invite
                    </Link>

                    <button
                      type="button"
                      onClick={() => void handleCopy(guestTag, entry.guestUrl)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-white/10 transition min-h-[44px]"
                    >
                      {copiedId === guestTag ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                          Copy Guest Link
                        </>
                      )}
                    </button>

                    {entry.editUrl ? (
                      <>
                        <Link
                          href={entry.editUrl}
                          onClick={() => dialogRef.current?.close()}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400/15 border border-amber-400/35 px-3.5 py-2 text-sm font-medium text-amber-100 hover:bg-amber-400/25 transition min-h-[44px]"
                        >
                          <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                          Edit Event
                        </Link>
                        <button
                          type="button"
                          onClick={() =>
                            void handleCopy(editTag, entry.editUrl ?? '')
                          }
                          className="inline-flex items-center gap-1.5 rounded-xl border border-amber-400/25 px-3 py-2 text-xs font-medium text-amber-200 hover:bg-amber-400/15 transition min-h-[44px]"
                        >
                          {copiedId === editTag ? (
                            <>
                              <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                              Copy Edit Link
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

      <div className="border-t border-white/10 bg-slate-900/60 px-6 py-3 flex items-center justify-between gap-3">
        <p className="text-xs text-slate-400">
          Tip: Bookmark or save your Secret Edit Link if you switch devices.
        </p>
        <Link
          href="/create"
          onClick={() => dialogRef.current?.close()}
          className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-300 transition min-h-[40px] shrink-0"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          New Invite
        </Link>
      </div>
    </dialog>
  );
}
