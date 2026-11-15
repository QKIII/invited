'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  KeyRound,
  Share2,
  X,
} from 'lucide-react';
import { rememberHostEvent } from '@/lib/client/recentEvents';
import { setupDialogLightDismiss } from '@/lib/polyfills/ui';

export interface PublishedEventResult {
  id: string;
  editKey: string;
  title: string;
  startIso?: string;
  timeZone?: string;
  locationName?: string;
  themeId?: string;
}

interface PublishSuccessDialogProps {
  published: PublishedEventResult | null;
  onClose: () => void;
}

export function downloadLinksBackupTxt(params: {
  title: string;
  guestUrl: string;
  editUrl: string;
  startIso?: string;
  timeZone?: string;
}): void {
  const safeSlug =
    params.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'invited-event';

  const lines = [
    `INVITED — EVENT LINKS BACKUP`,
    `========================================`,
    `Event: ${params.title}`,
    params.startIso
      ? `Starts: ${params.startIso}${params.timeZone ? ` (${params.timeZone})` : ''}`
      : '',
    ``,
    `1. SHARE WITH GUESTS (Public Invite Link)`,
    `Send this link via text, iMessage, WhatsApp, or email:`,
    params.guestUrl,
    ``,
    `2. SAVE FOR YOURSELF (Secret Host Edit Link)`,
    `Keep this private! There are no accounts or password resets:`,
    params.editUrl,
    ``,
    `Saved on: ${new Date().toISOString()}`,
  ]
    .filter((line) => line !== undefined)
    .join('\n');

  const blob = new Blob([lines], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${safeSlug}-links.txt`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

const noopSubscribe = () => () => {};

export function PublishSuccessDialog({
  published,
  onClose,
}: PublishSuccessDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const origin = useSyncExternalStore(
    noopSubscribe,
    () => window.location.origin,
    () => '',
  );
  const [copiedWhich, setCopiedWhich] = useState<'guest' | 'edit' | null>(null);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

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
    if (published) {
      rememberHostEvent({
        id: published.id,
        title: published.title,
        startIso: published.startIso,
        timeZone: published.timeZone,
        locationName: published.locationName,
        themeId: published.themeId,
        editKey: published.editKey,
      });
      if (!dialog.open) {
        dialog.showModal();
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }, [published]);

  const guestPath = published ? `/e/${published.id}` : '';
  const editPath = published
    ? `/e/${published.id}/edit?key=${encodeURIComponent(published.editKey)}`
    : '';
  const fullGuestUrl = origin && guestPath ? `${origin}${guestPath}` : guestPath;
  const fullEditUrl = origin && editPath ? `${origin}${editPath}` : editPath;

  const copyText = async (which: 'guest' | 'edit', value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedWhich(which);
      window.setTimeout(() => {
        setCopiedWhich((prev) => (prev === which ? null : prev));
      }, 2200);
    } catch {
      // Clipboard API unavailable
    }
  };

  const handleWebShare = async () => {
    if (!published) return;
    setShareFeedback(null);
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: published.title,
          text: `You're invited to ${published.title}! RSVP here:`,
          url: fullGuestUrl,
        });
        return;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
      }
    }
    await copyText('guest', fullGuestUrl);
    setShareFeedback('Invite link copied — paste it into iMessage, WhatsApp, or email!');
  };

  return (
    <dialog
      ref={dialogRef}
      closedby="any"
      aria-labelledby="publish-dialog-title"
      className="m-auto w-[min(94vw,660px)] max-h-[90dvh] overflow-y-auto rounded-3xl border border-white/15 bg-slate-950 text-slate-100 shadow-2xl p-0 backdrop:bg-black/65"
    >
      {published ? (
        <>
          <div className="relative overflow-hidden border-b border-white/10 bg-gradient-to-br from-emerald-500/15 via-slate-950 to-amber-500/10 px-6 py-5">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/35 bg-emerald-400/15 px-3 py-1 text-xs font-semibold text-emerald-200">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Invite Published</span>
                </div>
                <h2
                  id="publish-dialog-title"
                  className="text-2xl sm:text-3xl font-semibold tracking-tight text-white [text-wrap:balance]"
                  style={{ fontFamily: 'var(--font-editorial-serif), Georgia, serif' }}
                >
                  Your invite for {published.title} is live
                </h2>
                <p className="text-sm text-slate-300">
                  Save both links below — no accounts or passwords required.
                </p>
              </div>

              <button
                type="button"
                onClick={() => dialogRef.current?.close()}
                aria-label="Close publish confirmation"
                className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 text-slate-300 hover:bg-white/15 hover:text-white transition min-h-[44px] min-w-[44px] shrink-0"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-5">
            {/* Link 1: Public Guest Link */}
            <div className="invite-card rounded-2xl border border-emerald-400/30 bg-emerald-500/[0.06] p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
                    1 · Share with Guests
                  </p>
                  <h3 className="text-base font-semibold text-white mt-0.5">
                    Public Invite Link
                  </h3>
                </div>
              </div>

              <div className="rounded-xl border border-white/15 bg-slate-950/80 px-3.5 py-2.5 font-mono text-xs sm:text-sm text-emerald-100 break-all select-all">
                {fullGuestUrl}
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => void copyText('guest', fullGuestUrl)}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-300 transition min-h-[48px] [@media(pointer:coarse)]:min-h-[52px]"
                >
                  {copiedWhich === 'guest' ? (
                    <>
                      <Check className="h-4 w-4" aria-hidden="true" />
                      <span>Copied Guest Link</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" aria-hidden="true" />
                      <span>Copy Guest Link</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => void handleWebShare()}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-white hover:bg-white/[0.14] transition min-h-[48px] [@media(pointer:coarse)]:min-h-[52px]"
                >
                  <Share2 className="h-4 w-4 text-emerald-300" aria-hidden="true" />
                  <span>Share</span>
                </button>

                <Link
                  href={guestPath}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-white hover:bg-white/[0.14] transition min-h-[48px] [@media(pointer:coarse)]:min-h-[52px]"
                >
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  <span>Open Invite</span>
                </Link>
              </div>

              {shareFeedback ? (
                <p className="text-xs text-emerald-200" role="status">
                  {shareFeedback}
                </p>
              ) : null}
            </div>

            {/* Link 2: Secret Host Edit Link */}
            <div className="invite-card rounded-2xl border border-amber-400/40 bg-amber-500/[0.08] p-4 sm:p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">
                    2 · Save for Yourself
                  </p>
                  <h3 className="text-base font-semibold text-white mt-0.5 flex items-center gap-1.5">
                    <KeyRound className="h-4 w-4 text-amber-300" aria-hidden="true" />
                    Secret Host Edit Link
                  </h3>
                </div>
              </div>

              <div
                role="note"
                className="flex items-start gap-2.5 rounded-xl border border-amber-400/40 bg-amber-400/15 px-3.5 py-2.5 text-xs sm:text-sm text-amber-100"
              >
                <AlertTriangle
                  className="h-4 w-4 text-amber-300 shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <span>
                  <strong>Save this link in your notes</strong> — there are no
                  accounts or password resets! We also saved a copy in{' '}
                  <em>My Events</em> on this browser.
                </span>
              </div>

              <div className="rounded-xl border border-amber-300/25 bg-slate-950/80 px-3.5 py-2.5 font-mono text-xs sm:text-sm text-amber-100 break-all select-all">
                {fullEditUrl}
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => void copyText('edit', fullEditUrl)}
                  className="inline-flex items-center gap-2 rounded-xl bg-amber-300 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-amber-200 transition min-h-[48px] [@media(pointer:coarse)]:min-h-[52px]"
                >
                  {copiedWhich === 'edit' ? (
                    <>
                      <Check className="h-4 w-4" aria-hidden="true" />
                      <span>Copied Secret Edit Link</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" aria-hidden="true" />
                      <span>Copy Secret Edit Link</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    downloadLinksBackupTxt({
                      title: published.title,
                      guestUrl: fullGuestUrl,
                      editUrl: fullEditUrl,
                      startIso: published.startIso,
                      timeZone: published.timeZone,
                    })
                  }
                  className="inline-flex items-center gap-2 rounded-xl border border-amber-300/35 bg-amber-400/10 px-4 py-2.5 text-sm font-medium text-amber-100 hover:bg-amber-400/20 transition min-h-[48px] [@media(pointer:coarse)]:min-h-[52px]"
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  <span>Download .txt Backup</span>
                </button>

                <Link
                  href={editPath}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-white hover:bg-white/[0.14] transition min-h-[48px] [@media(pointer:coarse)]:min-h-[52px]"
                >
                  <span>Manage Event</span>
                </Link>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </dialog>
  );
}
