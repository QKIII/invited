'use client';

import { type FormEvent, useRef, useState, useSyncExternalStore } from 'react';
import { Bell, Check, Copy, Download, KeyRound, MessageSquare, Trash2, UserCheck, UserPlus, UserX } from 'lucide-react';
import { GuestAvatar } from '@/components/invite/GuestAvatar';
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

  const guestNameInputRef = useRef<HTMLInputElement>(null);
  const [guestName, setGuestName] = useState<string>('');
  const [guestNameTouched, setGuestNameTouched] = useState<boolean>(false);
  const [guestNameError, setGuestNameError] = useState<string | null>(null);
  const [guestStatus, setGuestStatus] = useState<'yes' | 'no'>('yes');
  const [plusOnesRaw, setPlusOnesRaw] = useState<string>('0');
  const [guestNote, setGuestNote] = useState<string>('');
  const [addingGuest, setAddingGuest] = useState<boolean>(false);
  const [addSuccessNotice, setAddSuccessNotice] = useState<string | null>(null);

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
        throw new Error(data.error || 'Could not remove guest.');
      }
      await onRefresh();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Could not remove guest.',
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
        throw new Error(data.error || 'Could not delete note.');
      }
      await onRefresh();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Could not delete note.',
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleAddGuest = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (addingGuest) return;
    setActionError(null);
    setAddSuccessNotice(null);

    const trimmedName = guestName.trim();
    if (!trimmedName) {
      setGuestNameError('Please enter a guest name.');
      guestNameInputRef.current?.focus();
      return;
    }
    setGuestNameError(null);

    const parsedPlusOnes =
      guestStatus === 'yes'
        ? Math.max(0, Math.min(20, Number.parseInt(plusOnesRaw.trim() || '0', 10) || 0))
        : 0;

    setAddingGuest(true);
    try {
      const res = await fetch(
        `/api/events/${encodeURIComponent(event.id)}/rsvps`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guestName: trimmedName,
            status: guestStatus,
            plusOnes: parsedPlusOnes,
            bringingNote: guestNote.trim() || undefined,
            postToWall: false,
          }),
        },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || 'Could not add guest.');
      }

      setGuestName('');
      setGuestNameTouched(false);
      setGuestNameError(null);
      setGuestStatus('yes');
      setPlusOnesRaw('0');
      setGuestNote('');
      setAddSuccessNotice('Guest added.');
      await onRefresh();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Could not add guest.',
      );
    } finally {
      setAddingGuest(false);
    }
  };

  return (
    <div className="space-y-6 pb-4" style={{ color: 'var(--theme-text-primary)' }}>
      {actionError ? (
        <div
          role="alert"
          className="rounded-2xl border border-rose-400/40 bg-rose-500/15 px-4 py-3 text-sm text-rose-500"
        >
          {actionError}
        </div>
      ) : null}

      {/* Invite Links */}
      <section aria-labelledby="host-links-heading" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2
              id="host-links-heading"
              className="text-lg font-bold"
              style={{
                fontFamily: 'var(--font-invite-display), var(--font-invite-body), sans-serif',
              }}
            >
              Invite links
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--theme-text-muted)' }}>
              Share the first link with friends and save the private edit link for yourself.
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
            className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-medium transition hover:opacity-85 cursor-pointer"
            style={{
              backgroundColor: 'var(--theme-surface-bg)',
              borderColor: 'var(--theme-border)',
              color: 'var(--theme-text-primary)',
            }}
          >
            <Download className="h-3.5 w-3.5" style={{ color: 'var(--theme-accent)' }} aria-hidden="true" />
            <span>Save links</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div
            className="rounded-2xl border p-4 space-y-2.5"
            style={{
              backgroundColor: 'var(--theme-surface-bg)',
              borderColor: 'var(--theme-hairline)',
            }}
          >
            <p className="text-xs font-semibold">Link for guests</p>
            <p
              className="rounded-xl border px-3 py-2 text-xs break-all select-all"
              style={{
                backgroundColor: 'var(--theme-card-bg)',
                borderColor: 'var(--theme-hairline)',
                color: 'var(--theme-text-primary)',
              }}
            >
              {fullGuestUrl}
            </p>
            <button
              type="button"
              onClick={() => void copyLink('guest', fullGuestUrl)}
              className="invite-cta-btn inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition hover:opacity-95 cursor-pointer"
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
          </div>

          <div
            className="rounded-2xl border p-4 space-y-2.5"
            style={{
              backgroundColor: 'var(--theme-surface-bg)',
              borderColor: 'var(--theme-hairline)',
            }}
          >
            <p className="text-xs font-semibold flex items-center gap-1.5">
              <KeyRound className="h-3.5 w-3.5" style={{ color: 'var(--theme-accent)' }} aria-hidden="true" />
              <span>Private edit link</span>
            </p>
            <p
              className="rounded-xl border px-3 py-2 text-xs break-all select-all"
              style={{
                backgroundColor: 'var(--theme-card-bg)',
                borderColor: 'var(--theme-hairline)',
                color: 'var(--theme-text-muted)',
              }}
            >
              {fullEditUrl}
            </p>
            <button
              type="button"
              onClick={() => void copyLink('edit', fullEditUrl)}
              className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-semibold transition hover:opacity-85 cursor-pointer"
              style={{
                backgroundColor: 'var(--theme-card-bg)',
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
          </div>
        </div>
      </section>

      {/* Headcount Summary Stats */}
      <div className="grid grid-cols-3 gap-2.5">
        {[
          { icon: UserCheck, label: 'Going', value: rsvps.totalHeadcount },
          { icon: UserX, label: "Can't make it", value: rsvps.no.length },
          { icon: Bell, label: 'Reminders', value: subscriberCount },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="rounded-2xl border p-3.5"
              style={{
                backgroundColor: 'var(--theme-surface-bg)',
                borderColor: 'var(--theme-hairline)',
              }}
            >
              <p
                className="text-xs font-medium flex items-center gap-1.5"
                style={{ color: 'var(--theme-text-muted)' }}
              >
                <Icon className="h-3.5 w-3.5" style={{ color: 'var(--theme-accent)' }} aria-hidden="true" />
                <span>{stat.label}</span>
              </p>
              <p className="mt-1 text-2xl font-bold">{stat.value}</p>
            </div>
          );
        })}
      </div>

      {/* Coming (Yes) RSVPs */}
      <section aria-labelledby="yes-rsvps-heading" className="space-y-3 pt-2 border-t" style={{ borderColor: 'var(--theme-hairline)' }}>
        <h2
          id="yes-rsvps-heading"
          className="text-base font-bold"
          style={{
            fontFamily: 'var(--font-invite-display), var(--font-invite-body), sans-serif',
          }}
        >
          Going ({rsvps.totalHeadcount})
        </h2>

        {rsvps.yes.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--theme-text-muted)' }}>
            No one has confirmed yet.
          </p>
        ) : (
          <ul className="divide-y" style={{ borderColor: 'var(--theme-hairline)' }}>
            {rsvps.yes.map((rsvp) => (
              <li
                key={rsvp.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 py-3 first:pt-0 last:pb-0"
                style={{ borderColor: 'var(--theme-hairline)' }}
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <GuestAvatar name={rsvp.guestName} size="xs" />
                    <span className="font-semibold text-sm">{rsvp.guestName}</span>
                    {rsvp.plusOnes > 0 ? (
                      <span
                        className="rounded-full border px-2 py-0.5 text-[11px] font-medium"
                        style={{
                          backgroundColor: 'var(--theme-surface-bg)',
                          borderColor: 'var(--theme-hairline)',
                          color: 'var(--theme-accent)',
                        }}
                      >
                        +{rsvp.plusOnes}
                      </span>
                    ) : null}
                    <span className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                      {formatTimestamp(rsvp.updatedAt)}
                    </span>
                  </div>
                  {rsvp.bringingNote ? (
                    <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                      {rsvp.bringingNote}
                    </p>
                  ) : null}
                </div>

                <button
                  type="button"
                  disabled={busyId === `rsvp-${rsvp.id}`}
                  onClick={() => void handleDeleteRsvp(rsvp.id)}
                  className="inline-flex items-center gap-1.5 self-start sm:self-center rounded-full border px-3 py-1.5 text-xs font-medium text-rose-500 hover:bg-rose-500/10 transition disabled:opacity-60 cursor-pointer"
                  style={{ borderColor: 'var(--theme-hairline)' }}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{busyId === `rsvp-${rsvp.id}` ? 'Removing...' : 'Remove'}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Declined (No) */}
      <section aria-labelledby="no-rsvps-heading" className="space-y-3 pt-2 border-t" style={{ borderColor: 'var(--theme-hairline)' }}>
        <h2 id="no-rsvps-heading" className="text-base font-bold">
          Can&apos;t make it ({rsvps.no.length})
        </h2>
        {rsvps.no.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--theme-text-muted)' }}>
            No one has declined.
          </p>
        ) : (
          <ul className="divide-y" style={{ borderColor: 'var(--theme-hairline)' }}>
            {rsvps.no.map((rsvp) => (
              <li
                key={rsvp.id}
                className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                style={{ borderColor: 'var(--theme-hairline)' }}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <GuestAvatar name={rsvp.guestName} size="xs" />
                    <p className="text-sm font-medium">{rsvp.guestName}</p>
                  </div>
                  {rsvp.bringingNote ? (
                    <p className="text-xs mt-0.5" style={{ color: 'var(--theme-text-muted)' }}>
                      {rsvp.bringingNote}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  disabled={busyId === `rsvp-${rsvp.id}`}
                  onClick={() => void handleDeleteRsvp(rsvp.id)}
                  aria-label={`Remove ${rsvp.guestName} RSVP`}
                  className="inline-flex items-center justify-center rounded-full border p-1.5 text-rose-500 hover:bg-rose-500/10 disabled:opacity-60 cursor-pointer"
                  style={{ borderColor: 'var(--theme-hairline)' }}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Manually Add Guest RSVP */}
      <section aria-labelledby="add-guest-heading" className="space-y-3 pt-2 border-t" style={{ borderColor: 'var(--theme-hairline)' }}>
        <div>
          <h2 id="add-guest-heading" className="text-base font-bold flex items-center gap-2">
            <UserPlus className="h-4 w-4" style={{ color: 'var(--theme-accent)' }} aria-hidden="true" />
            <span>Add a guest</span>
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--theme-text-muted)' }}>
            Add a reply for someone who texted or told you in person.
          </p>
        </div>

        <form
          aria-labelledby="add-guest-heading"
          method="POST"
          action={`/api/events/${encodeURIComponent(event.id)}/rsvps`}
          onSubmit={handleAddGuest}
          noValidate
          data-testid="host-add-guest-form"
          className="rounded-2xl border p-4 space-y-4"
          style={{
            backgroundColor: 'var(--theme-surface-bg)',
            borderColor: 'var(--theme-hairline)',
          }}
        >
          <div className="space-y-1.5">
            <label
              htmlFor="add-guest-name"
              className="block text-xs font-medium"
              style={{ color: 'var(--theme-text-muted)' }}
            >
              Guest name <span aria-hidden="true">*</span>
            </label>
            <input
              ref={guestNameInputRef}
              id="add-guest-name"
              name="guestName"
              type="text"
              required
              maxLength={100}
              autoComplete="off"
              enterKeyHint="next"
              value={guestName}
              aria-invalid={Boolean(guestNameError) || undefined}
              aria-describedby={guestNameError ? 'add-guest-name-error' : undefined}
              onChange={(e) => {
                setGuestName(e.target.value);
                setGuestNameTouched(true);
                setAddSuccessNotice(null);
                if (e.target.value.trim()) {
                  setGuestNameError(null);
                }
              }}
              onBlur={() => {
                if (guestNameTouched && !guestName.trim()) {
                  setGuestNameError('Please enter a guest name.');
                }
              }}
              placeholder="Sam & Taylor"
              className="w-full min-h-[48px] rounded-xl border px-3 py-2 text-base outline-none focus-visible:ring-2"
              style={{
                fontSize: 'max(1rem, 1em)',
                backgroundColor: 'var(--theme-card-bg)',
                borderColor: guestNameError ? '#f43f5e' : 'var(--theme-border)',
                color: 'var(--theme-text-primary)',
              }}
            />
            {guestNameError ? (
              <p
                id="add-guest-name-error"
                role="alert"
                className="text-xs font-medium text-rose-500"
              >
                {guestNameError}
              </p>
            ) : null}
          </div>

          <fieldset className="space-y-1.5">
            <legend
              className="text-xs font-medium mb-1"
              style={{ color: 'var(--theme-text-muted)' }}
            >
              Reply
            </legend>
            <div className="flex flex-wrap items-center gap-3">
              <div
                className="inline-flex items-center gap-2 min-h-[48px] rounded-full border px-4 py-2"
                style={{
                  backgroundColor: 'var(--theme-card-bg)',
                  borderColor:
                    guestStatus === 'yes' ? 'var(--theme-accent)' : 'var(--theme-border)',
                }}
              >
                <input
                  id="add-guest-status-yes"
                  type="radio"
                  name="status"
                  value="yes"
                  checked={guestStatus === 'yes'}
                  onChange={() => setGuestStatus('yes')}
                  className="h-4 w-4 cursor-pointer"
                  style={{ accentColor: 'var(--theme-accent)' }}
                />
                <label htmlFor="add-guest-status-yes" className="text-sm font-medium cursor-pointer">
                  Going
                </label>
              </div>

              <div
                className="inline-flex items-center gap-2 min-h-[48px] rounded-full border px-4 py-2"
                style={{
                  backgroundColor: 'var(--theme-card-bg)',
                  borderColor:
                    guestStatus === 'no' ? 'var(--theme-accent)' : 'var(--theme-border)',
                }}
              >
                <input
                  id="add-guest-status-no"
                  type="radio"
                  name="status"
                  value="no"
                  checked={guestStatus === 'no'}
                  onChange={() => setGuestStatus('no')}
                  className="h-4 w-4 cursor-pointer"
                  style={{ accentColor: 'var(--theme-accent)' }}
                />
                <label htmlFor="add-guest-status-no" className="text-sm font-medium cursor-pointer">
                  Can&apos;t make it
                </label>
              </div>
            </div>
          </fieldset>

          {guestStatus === 'yes' ? (
            <div className="space-y-1.5">
              <label
                htmlFor="add-guest-plus-ones"
                className="block text-xs font-medium"
                style={{ color: 'var(--theme-text-muted)' }}
              >
                Extra guests (+1s)
              </label>
              <input
                id="add-guest-plus-ones"
                name="plusOnes"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={2}
                value={plusOnesRaw}
                onChange={(e) => setPlusOnesRaw(e.target.value.replace(/[^0-9]/g, ''))}
                className="w-28 min-h-[48px] rounded-xl border px-3 py-2 text-base outline-none focus-visible:ring-2"
                style={{
                  fontSize: 'max(1rem, 1em)',
                  backgroundColor: 'var(--theme-card-bg)',
                  borderColor: 'var(--theme-border)',
                  color: 'var(--theme-text-primary)',
                }}
              />
            </div>
          ) : null}

          <div className="space-y-1.5">
            <label
              htmlFor="add-guest-note"
              className="block text-xs font-medium"
              style={{ color: 'var(--theme-text-muted)' }}
            >
              Dish or note (optional)
            </label>
            <input
              id="add-guest-note"
              name="bringingNote"
              type="text"
              maxLength={240}
              enterKeyHint="done"
              value={guestNote}
              onChange={(e) => setGuestNote(e.target.value)}
              placeholder="Bringing fruit salad"
              className="w-full min-h-[48px] rounded-xl border px-3 py-2 text-base outline-none focus-visible:ring-2"
              style={{
                fontSize: 'max(1rem, 1em)',
                backgroundColor: 'var(--theme-card-bg)',
                borderColor: 'var(--theme-border)',
                color: 'var(--theme-text-primary)',
              }}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={addingGuest}
              className="invite-cta-btn min-h-[48px] rounded-full px-5 py-2.5 text-sm font-semibold transition cursor-pointer disabled:opacity-60"
            >
              {addingGuest ? 'Adding...' : 'Add guest'}
            </button>
            {addSuccessNotice ? (
              <p
                role="status"
                aria-live="polite"
                className="text-xs font-medium flex items-center gap-1.5"
                style={{ color: 'var(--theme-accent)' }}
              >
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{addSuccessNotice}</span>
              </p>
            ) : null}
          </div>
        </form>
      </section>

      {/* Guest Notes */}
      <section aria-labelledby="wall-mod-heading" className="space-y-3 pt-2 border-t" style={{ borderColor: 'var(--theme-hairline)' }}>
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4" style={{ color: 'var(--theme-accent)' }} aria-hidden="true" />
          <h2 id="wall-mod-heading" className="text-base font-bold">
            Comments ({comments.length})
          </h2>
        </div>

        {comments.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--theme-text-muted)' }}>
            No comments yet.
          </p>
        ) : (
          <ul className="divide-y" style={{ borderColor: 'var(--theme-hairline)' }}>
            {comments.map((comment) => (
              <li
                key={comment.id}
                className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5 py-3 first:pt-0 last:pb-0"
                style={{ borderColor: 'var(--theme-hairline)' }}
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <GuestAvatar name={comment.authorName} size="xs" />
                    <span className="text-sm font-semibold">{comment.authorName}</span>
                    {comment.isHost ? (
                      <span
                        className="rounded-full border px-2 py-0.5 text-[11px] font-semibold"
                        style={{
                          backgroundColor: 'var(--theme-surface-bg)',
                          borderColor: 'var(--theme-hairline)',
                          color: 'var(--theme-accent)',
                        }}
                      >
                        Host
                      </span>
                    ) : comment.rsvpStatus === 'yes' ? (
                      <span
                        className="rounded-full border px-2 py-0.5 text-[11px] font-medium"
                        style={{
                          backgroundColor: 'var(--theme-surface-bg)',
                          borderColor: 'var(--theme-hairline)',
                        }}
                      >
                        Going
                      </span>
                    ) : comment.rsvpStatus === 'no' ? (
                      <span
                        className="rounded-full border px-2 py-0.5 text-[11px] font-medium"
                        style={{
                          backgroundColor: 'var(--theme-surface-bg)',
                          borderColor: 'var(--theme-hairline)',
                          color: 'var(--theme-text-muted)',
                        }}
                      >
                        Can&apos;t go
                      </span>
                    ) : null}
                    <span className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                      {formatTimestamp(comment.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap break-words">{comment.body}</p>
                </div>

                <button
                  type="button"
                  disabled={busyId === `comment-${comment.id}`}
                  onClick={() => void handleDeleteComment(comment.id)}
                  className="inline-flex items-center gap-1.5 self-start rounded-full border px-3 py-1.5 text-xs font-medium text-rose-500 hover:bg-rose-500/10 transition shrink-0 disabled:opacity-60 cursor-pointer"
                  style={{ borderColor: 'var(--theme-hairline)' }}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{busyId === `comment-${comment.id}` ? 'Deleting...' : 'Delete'}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
