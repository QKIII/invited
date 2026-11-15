'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Check,
  Copy,
  ExternalLink,
  KeyRound,
  Lock,
  Sparkles,
} from 'lucide-react';
import { AmbientBackdrop } from '@/components/effects/AmbientBackdrop';
import { HostManagementPanel } from '@/components/studio/HostManagementPanel';
import { InviteStudio } from '@/components/studio/InviteStudio';
import {
  extractEditKeyFromInput,
  getSavedHostKey,
  rememberHostEvent,
  saveHostKey,
} from '@/lib/client/recentEvents';
import { getThemePreset, resolveThemeCssVars } from '@/lib/themes/presets';
import type { EventDetailResponse, EventMeta, InviteStyleConfig } from '@/types/invite';

interface EditInviteClientProps {
  eventId: string;
  initialKey?: string;
}

type LoadStatus =
  | 'loading'
  | 'needs-key'
  | 'not-found'
  | 'authorized'
  | 'error';

const DEFAULT_EDIT_STYLE: InviteStyleConfig = {
  themeId: 'winter-snowfall',
  fontId: 'modern-sans',
  effectId: 'snowfall',
  coverPresetId: 'you-are-invited',
  coverLayout: 'square',
  colorMode: getThemePreset('winter-snowfall').colorMode,
};

export function EditInviteClient({
  eventId,
  initialKey,
}: EditInviteClientProps) {
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [activeKey, setActiveKey] = useState('');
  const [keyInput, setKeyInput] = useState(initialKey ?? '');
  const [authError, setAuthError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  const [detail, setDetail] = useState<EventDetailResponse | null>(null);
  const [liveStyle, setLiveStyle] = useState<InviteStyleConfig | null>(null);
  const [activeTab, setActiveTab] = useState<'edit' | 'manage'>('edit');
  const [copiedGuest, setCopiedGuest] = useState(false);

  const verifyAndLoad = useCallback(
    async (candidateKey: string, isInitialAttempt = false) => {
      const cleanedKey = extractEditKeyFromInput(candidateKey);
      if (!cleanedKey) {
        setStatus('needs-key');
        if (!isInitialAttempt) {
          setAuthError('Please paste your secret host edit link or key.');
        }
        return;
      }

      if (!isInitialAttempt) {
        setVerifying(true);
      }
      setAuthError(null);

      try {
        const res = await fetch(`/api/events/${encodeURIComponent(eventId)}`, {
          cache: 'no-store',
          headers: {
            'x-edit-key': cleanedKey,
          },
        });

        if (res.status === 404) {
          setStatus('not-found');
          return;
        }

        if (!res.ok) {
          setStatus('error');
          setAuthError('Could not load event details.');
          return;
        }

        const data = (await res.json()) as EventDetailResponse;
        if (!data.isHost) {
          setStatus('needs-key');
          setAuthError(
            isInitialAttempt
              ? null
              : 'That secret host key did not match this event.',
          );
          return;
        }

        saveHostKey(eventId, cleanedKey);
        rememberHostEvent({
          id: data.event.id,
          title: data.event.title,
          startIso: data.event.startIso,
          timeZone: data.event.timeZone,
          locationName: data.event.locationName,
          themeId: data.event.style.themeId,
          editKey: cleanedKey,
        });

        setActiveKey(cleanedKey);
        setDetail(data);
        setLiveStyle(data.event.style);
        setStatus('authorized');
      } catch {
        setStatus(isInitialAttempt ? 'error' : 'needs-key');
        setAuthError('Network error verifying host key.');
      } finally {
        setVerifying(false);
      }
    },
    [eventId],
  );

  useEffect(() => {
    let active = true;
    const candidate = initialKey?.trim() || getSavedHostKey(eventId) || '';
    queueMicrotask(() => {
      if (active) {
        void verifyAndLoad(candidate, true);
      }
    });
    return () => {
      active = false;
    };
  }, [eventId, initialKey, verifyAndLoad]);

  const handleKeySubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void verifyAndLoad(keyInput, false);
  };

  const handleCopyGuestLink = async () => {
    try {
      const url = `${window.location.origin}/e/${eventId}`;
      await navigator.clipboard.writeText(url);
      setCopiedGuest(true);
      window.setTimeout(() => setCopiedGuest(false), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  const handleSaved = (updated: EventMeta) => {
    setDetail((prev) => (prev ? { ...prev, event: updated } : prev));
    setLiveStyle(updated.style);
  };

  const effectiveStyle = useMemo<InviteStyleConfig>(
    () => liveStyle ?? detail?.event.style ?? DEFAULT_EDIT_STYLE,
    [liveStyle, detail?.event.style],
  );

  const themeVars = useMemo(
    () => resolveThemeCssVars(effectiveStyle) as React.CSSProperties,
    [effectiveStyle],
  );

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#082556] text-slate-100 flex items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-white/[0.06] backdrop-blur-md p-6 text-center space-y-2">
          <Sparkles className="h-5 w-5 text-sky-300 mx-auto animate-pulse" aria-hidden="true" />
          <p className="text-sm font-medium text-white">Opening event manager...</p>
        </div>
      </div>
    );
  }

  if (status === 'not-found') {
    return (
      <div className="min-h-screen bg-[#082556] text-slate-100 flex items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-white/[0.06] backdrop-blur-md p-6 text-center space-y-4">
          <h1 className="text-lg font-bold text-white">Invite not found</h1>
          <p className="text-sm text-slate-300">
            This invite may have been deleted or the URL is incomplete.
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-slate-100 transition"
          >
            Create New Invite
          </Link>
        </div>
      </div>
    );
  }

  if (status === 'needs-key' || status === 'error') {
    return (
      <div className="min-h-screen bg-[#082556] text-slate-100 px-4 py-12 flex items-center justify-center">
        <div className="w-full max-w-md rounded-2xl border border-white/15 bg-white/[0.08] backdrop-blur-md p-6 space-y-4 shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-sky-400/20 border border-sky-300/30 flex items-center justify-center shrink-0">
              <Lock className="h-4 w-4 text-sky-200" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Host Edit Link Required</h1>
              <p className="text-xs text-slate-300">
                Paste your secret edit link or key to manage this event.
              </p>
            </div>
          </div>

          <form onSubmit={handleKeySubmit} className="space-y-3">
            <label htmlFor="host-edit-key-input" className="sr-only">
              Secret host key or full edit link
            </label>
            <input
              id="host-edit-key-input"
              type="text"
              value={keyInput}
              onChange={(e) => {
                setKeyInput(e.target.value);
                setAuthError(null);
              }}
              placeholder="Paste ?key=... or full edit URL"
              className="w-full rounded-xl border border-white/15 bg-slate-950/60 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-400 outline-none focus:ring-2"
            />

            {authError ? (
              <p role="alert" className="text-xs text-rose-300">
                {authError}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={verifying}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-slate-100 transition disabled:opacity-60 cursor-pointer"
              >
                <KeyRound className="h-4 w-4" aria-hidden="true" />
                <span>{verifying ? 'Verifying...' : 'Unlock'}</span>
              </button>

              <Link
                href={`/e/${eventId}`}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/15 px-3.5 py-2.5 text-sm font-medium text-white hover:bg-white/10 transition"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                <span>View Invite</span>
              </Link>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        ...themeVars,
        backgroundColor: 'var(--theme-page-bg)',
        color: 'var(--theme-text-primary)',
        fontFamily: 'var(--font-invite-body), var(--font-sans), sans-serif',
      }}
      className="min-h-screen relative overflow-x-hidden transition-colors duration-300"
    >
      <AmbientBackdrop effectId={effectiveStyle.effectId} />

      {/* Minimal 48px single-row header */}
      <header className="relative z-10 h-12 max-w-[480px] lg:max-w-[920px] mx-auto px-4 lg:px-8 flex items-center justify-between gap-2">
        <Link
          href={`/e/${eventId}`}
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium hover:opacity-80 transition shrink-0"
          style={{ color: 'var(--theme-text-primary)' }}
        >
          <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>View Invite</span>
        </Link>

        <div className="flex items-center gap-1.5 min-w-0">
          <div
            role="tablist"
            aria-label="Manage mode"
            className="inline-flex items-center rounded-full border p-0.5"
            style={{
              backgroundColor: 'var(--theme-glass-bg)',
              borderColor: 'var(--theme-hairline)',
            }}
          >
            <button
              role="tab"
              type="button"
              aria-selected={activeTab === 'edit'}
              onClick={() => setActiveTab('edit')}
              className="rounded-full px-3 py-1 text-xs font-medium transition cursor-pointer"
              style={
                activeTab === 'edit'
                  ? {
                      backgroundColor: 'var(--theme-accent)',
                      color: 'var(--theme-on-accent)',
                    }
                  : { color: 'var(--theme-text-muted)' }
              }
            >
              Edit
            </button>
            <button
              role="tab"
              type="button"
              aria-selected={activeTab === 'manage'}
              onClick={() => setActiveTab('manage')}
              className="rounded-full px-3 py-1 text-xs font-medium transition cursor-pointer whitespace-nowrap"
              style={
                activeTab === 'manage'
                  ? {
                      backgroundColor: 'var(--theme-accent)',
                      color: 'var(--theme-on-accent)',
                    }
                  : { color: 'var(--theme-text-muted)' }
              }
            >
              Guests ({detail?.rsvps.totalHeadcount ?? 0})
            </button>
          </div>

          <button
            type="button"
            onClick={() => void handleCopyGuestLink()}
            aria-label="Copy guest invite link"
            className="h-8 inline-flex items-center gap-1 rounded-full border px-2.5 text-xs font-medium transition hover:opacity-90 cursor-pointer shrink-0"
            style={{
              backgroundColor: 'var(--theme-glass-bg)',
              borderColor: 'var(--theme-hairline)',
              color: 'var(--theme-text-primary)',
            }}
          >
            {copiedGuest ? (
              <Check className="h-3.5 w-3.5" style={{ color: 'var(--theme-accent)' }} aria-hidden="true" />
            ) : (
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span className="hidden sm:inline">{copiedGuest ? 'Copied' : 'Copy Link'}</span>
          </button>

          <Link
            href={`/e/${eventId}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open guest page in new tab"
            className="h-8 w-8 rounded-full border inline-flex items-center justify-center transition hover:opacity-90 shrink-0"
            style={{
              backgroundColor: 'var(--theme-glass-bg)',
              borderColor: 'var(--theme-hairline)',
              color: 'var(--theme-text-primary)',
            }}
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      </header>

      <main className="relative z-10 max-w-[480px] lg:max-w-[920px] mx-auto px-4 lg:px-8 pt-2 sm:pt-4 pb-16">
        {detail && activeTab === 'edit' ? (
          <InviteStudio
            key={`edit-${detail.event.id}`}
            mode="edit"
            initialEvent={detail.event}
            eventId={eventId}
            editKey={activeKey}
            onSaved={handleSaved}
            onStyleChange={setLiveStyle}
          />
        ) : null}

        {detail && activeTab === 'manage' ? (
          <div
            className="rounded-2xl border backdrop-blur-md p-4 sm:p-6"
            style={{
              backgroundColor: 'var(--theme-glass-bg)',
              borderColor: 'var(--theme-border)',
            }}
          >
            <HostManagementPanel
              detail={detail}
              editKey={activeKey}
              onRefresh={() => verifyAndLoad(activeKey, false)}
            />
          </div>
        ) : null}
      </main>
    </div>
  );
}
