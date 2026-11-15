'use client';

import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Check,
  Copy,
  ExternalLink,
  KeyRound,
  Lock,
  Sliders,
  Users,
} from 'lucide-react';
import { HostManagementPanel } from '@/components/studio/HostManagementPanel';
import { InviteStudio } from '@/components/studio/InviteStudio';
import {
  extractEditKeyFromInput,
  getSavedHostKey,
  rememberHostEvent,
} from '@/lib/client/recentEvents';
import type { EventDetailResponse, EventMeta } from '@/types/invite';

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
  const [activeTab, setActiveTab] = useState<'edit' | 'manage'>('edit');
  const [copiedGuest, setCopiedGuest] = useState(false);

  const verifyAndLoad = useCallback(
    async (
      candidateKey: string,
      options?: { fromUserSubmit?: boolean; silent?: boolean },
    ) => {
      const cleanedKey = extractEditKeyFromInput(candidateKey);
      if (!cleanedKey) {
        setStatus('needs-key');
        if (options?.fromUserSubmit) {
          setAuthError(
            'Paste your Secret Host Edit Link or raw edit key to continue.',
          );
        }
        return;
      }

      if (!options?.silent) {
        setVerifying(true);
      }
      setAuthError(null);

      try {
        const res = await fetch(
          `/api/events/${encodeURIComponent(eventId)}?key=${encodeURIComponent(cleanedKey)}`,
          {
            method: 'GET',
            headers: { 'x-edit-key': cleanedKey },
            cache: 'no-store',
          },
        );

        if (res.status === 404) {
          setStatus('not-found');
          return;
        }

        if (res.status === 403 || res.status === 401) {
          setStatus('needs-key');
          setAuthError(
            'That edit key does not match this event. Double-check your Secret Host Edit Link and try again.',
          );
          return;
        }

        if (!res.ok) {
          throw new Error('Could not load event details.');
        }

        const data = (await res.json()) as EventDetailResponse;
        if (!data.isHost) {
          setStatus('needs-key');
          setAuthError(
            'That edit key does not match this event. Double-check your Secret Host Edit Link and try again.',
          );
          return;
        }

        setActiveKey(cleanedKey);
        setDetail(data);
        setStatus('authorized');
        rememberHostEvent({
          id: data.event.id,
          title: data.event.title,
          startIso: data.event.startIso,
          timeZone: data.event.timeZone,
          locationName: data.event.locationName,
          themeId: data.event.style.themeId,
          editKey: cleanedKey,
        });
      } catch (err) {
        if (options?.silent) {
          return;
        }
        setStatus('error');
        setAuthError(
          err instanceof Error ? err.message : 'Unable to reach the server.',
        );
      } finally {
        setVerifying(false);
      }
    },
    [eventId],
  );

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      const candidate = initialKey?.trim() || getSavedHostKey(eventId) || '';
      if (!candidate) {
        setStatus('needs-key');
        return;
      }
      void verifyAndLoad(candidate);
    });
    return () => {
      cancelled = true;
    };
  }, [eventId, initialKey, verifyAndLoad]);

  const handleKeySubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (verifying) return;
    void verifyAndLoad(keyInput, { fromUserSubmit: true });
  };

  const handleCopyGuestLink = async () => {
    if (typeof window === 'undefined') return;
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/e/${eventId}`,
      );
      setCopiedGuest(true);
      window.setTimeout(() => setCopiedGuest(false), 2000);
    } catch {
      // Clipboard unavailable
    }
  };

  const handleSaved = (updated: EventMeta) => {
    setDetail((prev) => (prev ? { ...prev, event: updated } : prev));
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#060913] text-slate-200 flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
          <p className="text-sm text-slate-300">Verifying host access...</p>
        </div>
      </div>
    );
  }

  if (status === 'not-found') {
    return (
      <div className="min-h-screen bg-[#060913] text-slate-100 flex items-center justify-center p-6">
        <div className="invite-card w-full max-w-md rounded-3xl border border-white/15 bg-slate-950/80 p-7 text-center space-y-4">
          <h1 className="text-2xl font-semibold text-white">Event not found</h1>
          <p className="text-sm text-slate-400">
            This invitation may have been deleted by its host, or the link is
            incomplete.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              href="/"
              className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/10 min-h-[48px] inline-flex items-center"
            >
              Back Home
            </Link>
            <Link
              href="/create"
              className="rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-300 min-h-[48px] inline-flex items-center"
            >
              Create New Invite
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'needs-key' || status === 'error' || !detail) {
    return (
      <div className="min-h-screen bg-[#060913] text-slate-100 flex flex-col">
        <header className="border-b border-white/10 bg-slate-950/70 px-5 py-4 sm:px-8">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
            <Link
              href="/"
              className="text-2xl tracking-tight text-white"
              style={{ fontFamily: 'var(--font-editorial-serif), Georgia, serif' }}
            >
              invited
            </Link>
            <Link
              href={`/e/${eventId}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-4 py-2 text-xs sm:text-sm font-medium text-slate-200 hover:bg-white/10 min-h-[44px]"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              <span>View Public Invite</span>
            </Link>
          </div>
        </header>

        <main className="flex flex-1 items-center justify-center p-5 sm:p-8">
          <div className="invite-card w-full max-w-lg rounded-3xl border border-white/15 bg-slate-950/80 p-6 sm:p-8 shadow-2xl space-y-5">
            <div className="flex items-start gap-3.5">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-400/15 border border-amber-400/30 text-amber-300">
                <Lock className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="space-y-1">
                <h1 className="text-xl sm:text-2xl font-semibold text-white">
                  Enter Host Edit Key
                </h1>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Editing is protected by the secret link generated when this
                  event was created. Paste either your full Secret Edit Link or
                  the raw key.
                </p>
              </div>
            </div>

            <form onSubmit={handleKeySubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="host-edit-key-input"
                  className="block text-sm font-medium text-slate-200 mb-1.5"
                >
                  Secret Host Edit Link or Key
                </label>
                <input
                  id="host-edit-key-input"
                  name="editKey"
                  type="text"
                  required
                  value={keyInput}
                  onChange={(e) => {
                    setKeyInput(e.target.value);
                    if (authError) setAuthError(null);
                  }}
                  placeholder="https://.../e/.../edit?key=... or paste key"
                  className="w-full rounded-2xl border border-white/15 bg-slate-900 px-4 py-3 text-base text-white placeholder:text-slate-500 font-mono min-h-[48px] [@media(pointer:coarse)]:min-h-[52px]"
                />
              </div>

              {authError ? (
                <p
                  role="alert"
                  className="rounded-xl border border-rose-400/40 bg-rose-500/15 px-3.5 py-2.5 text-sm text-rose-200"
                >
                  {authError}
                </p>
              ) : null}

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={verifying}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-300 px-5 py-3 text-sm sm:text-base font-semibold text-slate-950 hover:bg-amber-200 transition min-h-[48px] [@media(pointer:coarse)]:min-h-[52px] disabled:opacity-70"
                >
                  <KeyRound className="h-4 w-4" aria-hidden="true" />
                  <span>{verifying ? 'Unlocking...' : 'Unlock Host Editor'}</span>
                </button>

                <Link
                  href={`/e/${eventId}`}
                  className="inline-flex items-center justify-center rounded-2xl border border-white/15 px-4 py-3 text-sm font-medium text-slate-300 hover:bg-white/10 min-h-[48px]"
                >
                  Open Guest Page
                </Link>
              </div>
            </form>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060913] text-slate-100">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(245,158,11,0.09),transparent_48%),radial-gradient(ellipse_at_top_right,rgba(16,185,129,0.1),transparent_50%)]"
      />

      <header className="relative z-10 border-b border-white/10 bg-slate-950/75 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl px-4 py-3.5 sm:px-8 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.05] px-3 py-2 text-xs sm:text-sm font-medium text-slate-200 hover:bg-white/[0.12] transition min-h-[44px]"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Home</span>
              </Link>

              <div className="min-w-0">
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[11px] font-semibold text-amber-200 mb-0.5">
                  <KeyRound className="h-3 w-3" aria-hidden="true" />
                  Host Editor
                </span>
                <h1 className="text-base sm:text-lg font-semibold text-white truncate">
                  {detail.event.title}
                </h1>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void handleCopyGuestLink()}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-100 hover:bg-white/[0.14] transition min-h-[44px]"
              >
                {copiedGuest ? (
                  <>
                    <Check
                      className="h-4 w-4 text-emerald-300"
                      aria-hidden="true"
                    />
                    <span>Copied Invite Link</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" aria-hidden="true" />
                    <span>Copy Guest Link</span>
                  </>
                )}
              </button>

              <Link
                href={`/e/${eventId}`}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-2 text-xs sm:text-sm font-medium text-white hover:bg-white/20 transition min-h-[44px]"
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                <span>Public Invite</span>
              </Link>
            </div>
          </div>

          <div
            role="tablist"
            aria-label="Host editor sections"
            className="inline-flex rounded-2xl border border-white/12 bg-slate-900/80 p-1 gap-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'edit'}
              onClick={() => setActiveTab('edit')}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-medium transition min-h-[44px] ${
                activeTab === 'edit'
                  ? 'bg-white text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Sliders className="h-4 w-4" aria-hidden="true" />
              <span>Edit Details &amp; Design</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'manage'}
              onClick={() => setActiveTab('manage')}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-medium transition min-h-[44px] ${
                activeTab === 'manage'
                  ? 'bg-white text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Users className="h-4 w-4" aria-hidden="true" />
              <span>
                RSVPs &amp; Management ({detail.rsvps.totalHeadcount} Going)
              </span>
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8">
        {activeTab === 'edit' ? (
          <InviteStudio
            key={`${detail.event.id}-${detail.event.updatedAt}`}
            mode="edit"
            initialEvent={detail.event}
            eventId={eventId}
            editKey={activeKey}
            onSaved={handleSaved}
          />
        ) : (
          <HostManagementPanel
            detail={detail}
            editKey={activeKey}
            onRefresh={() => verifyAndLoad(activeKey, { silent: true })}
          />
        )}
      </main>
    </div>
  );
}
