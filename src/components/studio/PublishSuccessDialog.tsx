'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  KeyRound,
  Share2,
  X,
} from 'lucide-react';
import { closeTopLayer, setupDialogLightDismiss } from '@/lib/polyfills/ui';

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
      .replace(/^-|-$/g, '')
      .slice(0, 48) || 'event';

  const lines = [
    `EVENT: ${params.title}`,
    params.startIso ? `WHEN: ${params.startIso} (${params.timeZone ?? 'local'})` : '',
    '',
    'INVITE LINK (share with guests):',
    params.guestUrl,
    '',
    'PRIVATE EDIT LINK (keep for yourself):',
    params.editUrl,
  ]
    .filter((line, idx, arr) => !(line === '' && arr[idx - 1] === ''))
    .join('\n');

  const blob = new Blob([lines], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${safeSlug}-links.txt`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const subscribeNoop = () => () => {};

export function PublishSuccessDialog({
  published,
  onClose,
}: PublishSuccessDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const origin = useSyncExternalStore(
    subscribeNoop,
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
    if (published && !dialog.open) {
      if (typeof dialog.showModal === 'function') {
        dialog.showModal();
      } else {
        dialog.setAttribute('open', '');
      }
    } else if (!published && dialog.open) {
      void closeTopLayer(dialog);
    }
  }, [published]);

  const guestPath = published ? `/e/${published.id}` : '';
  const editPath = published
    ? `/e/${published.id}/edit?key=${encodeURIComponent(published.editKey)}`
    : '';
  const fullGuestUrl = origin && guestPath ? `${origin}${guestPath}` : guestPath;
  const fullEditUrl = origin && editPath ? `${origin}${editPath}` : editPath;

  const copyText = async (which: 'guest' | 'edit', value: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedWhich(which);
      window.setTimeout(() => {
        setCopiedWhich((prev) => (prev === which ? null : prev));
      }, 2200);
    } catch {
      // Clipboard fallback not needed; URLs remain selectable
    }
  };

  const handleWebShare = async () => {
    if (!published || !fullGuestUrl) return;
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: published.title,
          text: `You're invited to ${published.title}`,
          url: fullGuestUrl,
        });
        return;
      } catch {
        // Ignore user cancel
      }
    }
    await copyText('guest', fullGuestUrl);
    setShareFeedback('Link copied.');
    window.setTimeout(() => setShareFeedback(null), 2200);
  };

  return (
    <dialog
      ref={dialogRef}
      closedby="any"
      aria-labelledby="publish-success-heading"
      className="sheet-from-bottom w-full sm:w-[calc(100%-2rem)] max-w-md mx-auto mt-auto mb-0 sm:my-auto rounded-t-3xl sm:rounded-3xl border p-5 shadow-2xl backdrop-blur-2xl"
      style={{
        backgroundColor: 'var(--theme-card-solid, #121a2e)',
        borderColor: 'var(--theme-border, rgba(255,255,255,0.16))',
        color: 'var(--theme-text-primary, #f8fafc)',
      }}
    >
      {published ? (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p
                className="text-xs font-semibold"
                style={{ color: 'var(--theme-accent, #34d399)' }}
              >
                Your invite is ready
              </p>
              <h2
                id="publish-success-heading"
                className="text-xl font-bold leading-snug mt-0.5 truncate"
                style={{
                  fontFamily: 'var(--font-invite-display), var(--font-invite-body), sans-serif',
                }}
              >
                {published.title}
              </h2>
            </div>

            <button
              type="button"
              onClick={() => void closeTopLayer(dialogRef.current)}
              aria-label="Close publish dialog"
              className="h-9 w-9 rounded-full border inline-flex items-center justify-center opacity-80 hover:opacity-100 shrink-0 cursor-pointer"
              style={{
                borderColor: 'var(--theme-hairline, rgba(255,255,255,0.16))',
                color: 'var(--theme-text-primary, #f8fafc)',
              }}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {/* Link for Guests */}
          <div
            className="rounded-2xl border p-4 space-y-2.5"
            style={{
              backgroundColor: 'var(--theme-surface-bg, rgba(255,255,255,0.05))',
              borderColor: 'var(--theme-hairline, rgba(255,255,255,0.14))',
            }}
          >
            <div>
              <p className="text-xs font-semibold">Link for guests</p>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--theme-text-muted)' }}>
                Send this link to anyone you want to invite.
              </p>
            </div>
            <div
              className="rounded-xl border px-3 py-2 text-xs break-all select-all"
              style={{
                backgroundColor: 'var(--theme-card-bg)',
                borderColor: 'var(--theme-hairline)',
                color: 'var(--theme-text-primary)',
              }}
            >
              {fullGuestUrl}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleWebShare()}
                className="invite-cta-btn flex-1 inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-xs sm:text-sm font-semibold shadow-sm transition hover:opacity-95 cursor-pointer"
              >
                <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Share invite</span>
              </button>

              <button
                type="button"
                onClick={() => void copyText('guest', fullGuestUrl)}
                className="inline-flex items-center justify-center gap-1.5 rounded-full border px-3.5 py-2 text-xs sm:text-sm font-medium transition hover:opacity-85 cursor-pointer"
                style={{
                  borderColor: 'var(--theme-border)',
                  color: 'var(--theme-text-primary)',
                }}
              >
                {copiedWhich === 'guest' ? (
                  <>
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Copy link</span>
                  </>
                )}
              </button>

              <Link
                href={guestPath}
                className="inline-flex items-center justify-center gap-1.5 rounded-full border px-3.5 py-2 text-xs sm:text-sm font-medium transition hover:opacity-85"
                style={{
                  borderColor: 'var(--theme-border)',
                  color: 'var(--theme-text-primary)',
                }}
              >
                <span>Open</span>
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
            {shareFeedback ? (
              <p className="text-xs font-medium" style={{ color: 'var(--theme-accent)' }}>
                {shareFeedback}
              </p>
            ) : null}
          </div>

          {/* Private Edit Link */}
          <div
            className="rounded-2xl border p-4 space-y-2.5"
            style={{
              backgroundColor: 'var(--theme-surface-bg, rgba(255,255,255,0.04))',
              borderColor: 'var(--theme-hairline, rgba(255,255,255,0.14))',
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
                <KeyRound className="h-3.5 w-3.5" style={{ color: 'var(--theme-accent)' }} aria-hidden="true" />
                <span>Your private edit link</span>
              </span>
              <span className="text-[11px]" style={{ color: 'var(--theme-text-muted)' }}>
                Keep private
              </span>
            </div>

            <div
              className="rounded-xl border px-3 py-2 text-xs break-all select-all"
              style={{
                backgroundColor: 'var(--theme-card-bg)',
                borderColor: 'var(--theme-hairline)',
                color: 'var(--theme-text-muted)',
              }}
            >
              {fullEditUrl}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void copyText('edit', fullEditUrl)}
                className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition hover:opacity-90 cursor-pointer"
                style={{
                  borderColor: 'var(--theme-border)',
                  color: 'var(--theme-text-primary)',
                }}
              >
                {copiedWhich === 'edit' ? (
                  <>
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Copy edit link</span>
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
                className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition hover:opacity-85 cursor-pointer"
                style={{
                  borderColor: 'var(--theme-hairline)',
                  color: 'var(--theme-text-muted)',
                }}
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Save copy</span>
              </button>

              <Link
                href={editPath}
                className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition hover:opacity-85"
                style={{
                  borderColor: 'var(--theme-hairline)',
                  color: 'var(--theme-text-muted)',
                }}
              >
                <span>Edit invite</span>
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
