'use client';

import { useState, useSyncExternalStore } from 'react';
import {
  Bell,
  Check,
  Copy,
  Download,
  KeyRound,
  MessageSquare,
  Trash2,
  UserCheck,
  UserX,
  Users,
} from 'lucide-react';
import { downloadLinksBackupTxt } from '@/components/studio/PublishSuccessDialog';
import type { EventDetailResponse } from '@/types/invite';

interface HostManagementPanelProps {
  detail: EventDetailResponse;
  editKey: string;
  onRefresh: () => Promise<void>;
}

function formatTimestamp(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

const noopSubscribe = () => () => {};

export function HostManagementPanel({
  detail,
  editKey,
  onRefresh,
}: HostManagementPanelProps) {
  const origin = useSyncExternalStore(
    noopSubscribe,
    () => window.location.origin,
    () => '',
  );
  const [copiedWhich, setCopiedWhich] = useState<'guest' | 'edit' | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { event, rsvps, comments, subscriberCount } = detail;
  const guestPath = `/e/${event.id}`;
  const editPath = `/e/${event.id}/edit?key=${encodeURIComponent(editKey)}`;
  const fullGuestUrl = origin ? `${origin}${guestPath}` : guestPath;
  const fullEditUrl = origin ? `${origin}${editPath}` : editPath;

  const copyLink = async (which: 'guest' | 'edit', value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedWhich(which);
      window.setTimeout(() => {
        setCopiedWhich((prev) => (prev === which ? null : prev));
      }, 2000);
    } catch {
      // Clipboard unavailable
    }
  };

  const handleDeleteRsvp = async (rsvpId: string) => {
    if (busyId) return;
    setBusyId(`rsvp-${rsvpId}`);
    setActionError(null);
    try {
      const res = await fetch(
        `/api/events/${encodeURIComponent(event.id)}/rsvps/${encodeURIComponent(rsvpId)}`,
        {
          method: 'DELETE',
          headers: { 'x-edit-key': editKey },
        },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || 'Could not remove RSVP.');
      }
      await onRefresh();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to remove RSVP.',
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (busyId) return;
    setBusyId(`comment-${commentId}`);
    setActionError(null);
    try {
      const res = await fetch(
        `/api/events/${encodeURIComponent(event.id)}/comments/${encodeURIComponent(commentId)}`,
        {
          method: 'DELETE',
          headers: { 'x-edit-key': editKey },
        },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || 'Could not delete comment.');
      }
      await onRefresh();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to delete comment.',
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6 pb-16">
      {actionError ? (
        <div
          role="alert"
          className="rounded-2xl border border-rose-400/40 bg-rose-500/15 px-4 py-3 text-sm text-rose-200"
        >
          {actionError}
        </div>
      ) : null}

      {/* Dual Links Quick Copy Card */}
      <section
        aria-labelledby="host-links-heading"
        className="invite-card rounded-3xl border border-white/12 bg-white/[0.04] p-5 sm:p-6 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2
              id="host-links-heading"
              className="text-lg font-semibold text-white"
            >
              Event Links
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Share the public invite with guests; keep your edit link private.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              downloadLinksBackupTxt({
                title: event.title,
                guestUrl: fullGuestUrl,
                editUrl: fullEditUrl,
                startIso: event.startIso,
                timeZone: event.timeZone,
              })
            }
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.06] px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-200 hover:bg-white/[0.12] transition min-h-[44px]"
          >
            <Download className="h-4 w-4 text-amber-300" aria-hidden="true" />
            <span>Download .txt Backup</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/[0.05] p-4 space-y-2.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
              Public Guest Link
            </p>
            <p className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 font-mono text-xs text-emerald-100 break-all select-all">
              {fullGuestUrl}
            </p>
            <button
              type="button"
              onClick={() => void copyLink('guest', fullGuestUrl)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-400 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-300 transition min-h-[44px]"
            >
              {copiedWhich === 'guest' ? (
                <>
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Copied Guest Link</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Copy Guest Link</span>
                </>
              )}
            </button>
          </div>

          <div className="rounded-2xl border border-amber-400/30 bg-amber-500/[0.06] p-4 space-y-2.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
              <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
              Secret Host Edit Link
            </p>
            <p className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 font-mono text-xs text-amber-100 break-all select-all">
              {fullEditUrl}
            </p>
            <button
              type="button"
              onClick={() => void copyLink('edit', fullEditUrl)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-300 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-200 transition min-h-[44px]"
            >
              {copiedWhich === 'edit' ? (
                <>
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Copied Edit Link</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Copy Edit Link</span>
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* Headcount Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="invite-card rounded-2xl border border-emerald-400/25 bg-emerald-500/[0.06] p-4">
          <p className="text-xs font-medium text-emerald-200 flex items-center gap-1.5">
            <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Total Headcount
          </p>
          <p className="mt-1 text-2xl font-semibold text-white">
            {rsvps.totalHeadcount}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            Across {rsvps.yes.length} Yes RSVP{rsvps.yes.length === 1 ? '' : 's'}
          </p>
        </div>

        <div className="invite-card rounded-2xl border border-white/12 bg-white/[0.04] p-4">
          <p className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
            <UserX className="h-3.5 w-3.5 text-rose-300" aria-hidden="true" />
            Can&apos;t Make It
          </p>
          <p className="mt-1 text-2xl font-semibold text-white">
            {rsvps.no.length}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">Declined responses</p>
        </div>

        <div className="invite-card rounded-2xl border border-white/12 bg-white/[0.04] p-4">
          <p className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-sky-300" aria-hidden="true" />
            Awaiting Reply
          </p>
          <p className="mt-1 text-2xl font-semibold text-white">
            {rsvps.awaitingNames.length}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">From invited list</p>
        </div>

        <div className="invite-card rounded-2xl border border-white/12 bg-white/[0.04] p-4">
          <p className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
            <Bell className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" />
            Update Subscribers
          </p>
          <p className="mt-1 text-2xl font-semibold text-white">
            {subscriberCount}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            {comments.length} wall message{comments.length === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      {/* Coming (Yes) RSVPs */}
      <section
        aria-labelledby="yes-rsvps-heading"
        className="invite-card rounded-3xl border border-white/12 bg-white/[0.04] p-5 sm:p-6 space-y-4"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 id="yes-rsvps-heading" className="text-lg font-semibold text-white">
            Coming ({rsvps.totalHeadcount} total)
          </h2>
        </div>

        {rsvps.yes.length === 0 ? (
          <p className="text-sm text-slate-400">
            No &ldquo;Yes, I&apos;m coming&rdquo; RSVPs yet.
          </p>
        ) : (
          <ul className="divide-y divide-white/10">
            {rsvps.yes.map((rsvp) => (
              <li
                key={rsvp.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-white">
                      {rsvp.guestName}
                    </span>
                    {rsvp.plusOnes > 0 ? (
                      <span className="rounded-full bg-emerald-400/15 border border-emerald-400/30 px-2 py-0.5 text-xs font-semibold text-emerald-200">
                        +{rsvp.plusOnes} guest{rsvp.plusOnes === 1 ? '' : 's'}
                      </span>
                    ) : null}
                    <span className="text-xs text-slate-500">
                      {formatTimestamp(rsvp.updatedAt)}
                    </span>
                  </div>
                  {rsvp.bringingNote ? (
                    <p className="text-sm text-emerald-100/90">
                      🍽️ {rsvp.bringingNote}
                    </p>
                  ) : null}
                </div>

                <button
                  type="button"
                  disabled={busyId === `rsvp-${rsvp.id}`}
                  onClick={() => void handleDeleteRsvp(rsvp.id)}
                  className="inline-flex items-center gap-1.5 self-start sm:self-center rounded-xl border border-white/15 px-3 py-2 text-xs font-medium text-rose-300 hover:bg-rose-500/15 transition min-h-[40px] disabled:opacity-60"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>
                    {busyId === `rsvp-${rsvp.id}` ? 'Removing...' : 'Remove'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Declined (No) RSVPs + Awaiting */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section
          aria-labelledby="no-rsvps-heading"
          className="invite-card rounded-3xl border border-white/12 bg-white/[0.04] p-5 sm:p-6 space-y-3"
        >
          <h2 id="no-rsvps-heading" className="text-base font-semibold text-white">
            Can&apos;t Make It ({rsvps.no.length})
          </h2>
          {rsvps.no.length === 0 ? (
            <p className="text-sm text-slate-400">No declines yet.</p>
          ) : (
            <ul className="divide-y divide-white/10">
              {rsvps.no.map((rsvp) => (
                <li
                  key={rsvp.id}
                  className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-200">
                      {rsvp.guestName}
                    </p>
                    {rsvp.bringingNote ? (
                      <p className="text-xs text-slate-400 mt-0.5">
                        {rsvp.bringingNote}
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    disabled={busyId === `rsvp-${rsvp.id}`}
                    onClick={() => void handleDeleteRsvp(rsvp.id)}
                    aria-label={`Remove ${rsvp.guestName} RSVP`}
                    className="inline-flex items-center justify-center rounded-xl border border-white/10 px-2.5 py-1.5 text-xs text-rose-300 hover:bg-rose-500/15 min-h-[36px] disabled:opacity-60"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section
          aria-labelledby="awaiting-heading"
          className="invite-card rounded-3xl border border-white/12 bg-white/[0.04] p-5 sm:p-6 space-y-3"
        >
          <h2 id="awaiting-heading" className="text-base font-semibold text-white">
            Awaiting Reply ({rsvps.awaitingNames.length})
          </h2>
          {rsvps.awaitingNames.length === 0 ? (
            <p className="text-sm text-slate-400">
              {event.invitedNames.length === 0
                ? 'No invited names pre-listed. Add names in the Edit tab if you want to track who has replied.'
                : 'Everyone on your invited list has responded!'}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {rsvps.awaitingNames.map((name) => (
                <span
                  key={name}
                  className="rounded-full border border-white/15 bg-white/[0.05] px-3 py-1 text-xs font-medium text-slate-200"
                >
                  {name}
                </span>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Event Wall Comments Moderation */}
      <section
        aria-labelledby="wall-mod-heading"
        className="invite-card rounded-3xl border border-white/12 bg-white/[0.04] p-5 sm:p-6 space-y-4"
      >
        <div className="flex items-center gap-2">
          <MessageSquare
            className="h-4 w-4 text-violet-300"
            aria-hidden="true"
          />
          <h2 id="wall-mod-heading" className="text-lg font-semibold text-white">
            Event Wall Messages ({comments.length})
          </h2>
        </div>

        {comments.length === 0 ? (
          <p className="text-sm text-slate-400">No wall messages yet.</p>
        ) : (
          <ul className="divide-y divide-white/10">
            {comments.map((comment) => (
              <li
                key={comment.id}
                className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-white">
                      {comment.authorName}
                    </span>
                    {comment.isHost ? (
                      <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[11px] font-semibold text-amber-200">
                        Host
                      </span>
                    ) : comment.rsvpStatus === 'yes' ? (
                      <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[11px] font-medium text-emerald-200">
                        Going ✓
                      </span>
                    ) : comment.rsvpStatus === 'no' ? (
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium text-slate-300">
                        Can&apos;t Go ✕
                      </span>
                    ) : null}
                    <span className="text-xs text-slate-500">
                      {formatTimestamp(comment.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-slate-200 whitespace-pre-wrap break-words">
                    {comment.body}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={busyId === `comment-${comment.id}`}
                  onClick={() => void handleDeleteComment(comment.id)}
                  className="inline-flex items-center gap-1.5 self-start rounded-xl border border-white/15 px-3 py-2 text-xs font-medium text-rose-300 hover:bg-rose-500/15 transition min-h-[40px] shrink-0 disabled:opacity-60"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>
                    {busyId === `comment-${comment.id}`
                      ? 'Deleting...'
                      : 'Delete'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
