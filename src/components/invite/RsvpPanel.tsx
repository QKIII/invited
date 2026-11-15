'use client';

import React, { useId, useState, useSyncExternalStore } from 'react';
import {
  Bell,
  CalendarPlus,
  Check,
  ChevronRight,
  Minus,
  Plus,
  Share2,
  X,
} from 'lucide-react';
import {
  clearGuestToken,
  formatRelativeCountdown,
  getDeviceProfile,
  getDeviceProfileServerSnapshot,
  saveCachedGuestRsvp,
  saveDeviceProfile,
  saveGuestToken,
  subscribeDeviceProfile,
} from '@/lib/client/deviceProfile';
import { getThemePreset } from '@/lib/themes/presets';
import type {
  CommentRecord,
  EventDetailResponse,
  EventMeta,
  RsvpRecord,
  RsvpStatus,
} from '@/types/invite';
import { GuestAvatar } from './GuestAvatar';

export { getGuestTokenStorageKey } from '@/lib/client/deviceProfile';

interface RsvpPanelProps {
  event: EventMeta;
  awaitingNames: string[];
  viewerRsvp?: RsvpRecord;
  editKey?: string | null;
  guestToken: string | null;
  guestName: string;
  onGuestNameChange: (name: string) => void;
  isEditing: boolean;
  onEditingChange: (editing: boolean) => void;
  onRsvpSuccess: (payload: {
    rsvp: RsvpRecord;
    guestToken: string;
    wallComment?: CommentRecord;
    detail?: EventDetailResponse;
  }) => void;
  onWithdrawRsvp?: (freshDetail?: EventDetailResponse) => void;
  onOpenSubscribe?: () => void;
  onShareInvite?: () => void;
  shareCopied?: boolean;
  nameInputRef?: React.RefObject<HTMLInputElement | null>;
}

interface RsvpApiResponse {
  rsvp: RsvpRecord;
  guestToken: string;
  wallComment?: CommentRecord;
  detail?: EventDetailResponse;
  error?: string;
}

export function RsvpPanel({
  event,
  awaitingNames,
  viewerRsvp,
  editKey,
  guestToken,
  guestName,
  onGuestNameChange,
  isEditing,
  onEditingChange,
  onRsvpSuccess,
  onWithdrawRsvp,
  onOpenSubscribe,
  onShareInvite,
  shareCopied = false,
  nameInputRef,
}: RsvpPanelProps) {
  const formHeadingId = useId();
  const deviceProfile = useSyncExternalStore(
    subscribeDeviceProfile,
    getDeviceProfile,
    getDeviceProfileServerSnapshot,
  );

  const [status, setStatus] = useState<RsvpStatus>(viewerRsvp?.status ?? 'yes');
  const [plusOnes, setPlusOnes] = useState<number>(viewerRsvp?.plusOnes ?? 0);
  const [bringingNote, setBringingNote] = useState<string>(viewerRsvp?.bringingNote ?? '');
  const [postToWall, setPostToWall] = useState<boolean>(true);
  const [manualIdentityEdit, setManualIdentityEdit] = useState<boolean>(false);
  const [showOneClickExtras, setShowOneClickExtras] = useState<boolean>(
    Boolean(event.rsvpNotePrompt?.trim()),
  );
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submittingStatus, setSubmittingStatus] = useState<RsvpStatus | null>(null);
  const [withdrawing, setWithdrawing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [localShareCopied, setLocalShareCopied] = useState<boolean>(false);

  const isLightTheme =
    event.style.colorMode === 'light' ||
    (!event.style.colorMode && getThemePreset(event.style.themeId).colorMode === 'light');

  const primaryCtaStyle: React.CSSProperties = isLightTheme
    ? { backgroundColor: '#0f172a', color: '#ffffff' }
    : { backgroundColor: '#ffffff', color: '#0f172a' };

  const recognizedName = deviceProfile?.name?.trim() || '';
  const firstName = recognizedName.split(/\s+/)[0] || recognizedName;

  async function submitRsvp(params: {
    targetStatus: RsvpStatus;
    targetName: string;
    targetPlusOnes: number;
    targetNote: string;
    shareNoteToWall: boolean;
  }) {
    const trimmedName = params.targetName.trim();
    if (!trimmedName) {
      setErrorMsg('Please enter your name.');
      nameInputRef?.current?.focus();
      return;
    }

    setSubmitting(true);
    setSubmittingStatus(params.targetStatus);
    setErrorMsg(null);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (guestToken) {
        headers['x-guest-token'] = guestToken;
      }

      const trimmedNote = params.targetNote.trim();
      const res = await fetch(`/api/events/${event.id}/rsvps`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          guestName: trimmedName,
          status: params.targetStatus,
          plusOnes: params.targetStatus === 'yes' ? params.targetPlusOnes : 0,
          bringingNote: trimmedNote || undefined,
          postToWall: Boolean(trimmedNote && params.shareNoteToWall),
          guestToken: guestToken ?? undefined,
        }),
      });

      const data = (await res.json()) as RsvpApiResponse;
      if (!res.ok) {
        setErrorMsg(data.error ?? 'Could not save your RSVP. Please try again.');
        return;
      }

      const nextToken = data.guestToken || guestToken || '';
      if (nextToken) {
        saveGuestToken(event.id, nextToken);
      }
      saveCachedGuestRsvp(event.id, data.rsvp);
      saveDeviceProfile({ name: trimmedName });
      onGuestNameChange(trimmedName);
      setManualIdentityEdit(false);
      onEditingChange(false);

      onRsvpSuccess({
        rsvp: data.rsvp,
        guestToken: nextToken,
        wallComment: data.wallComment,
        detail: data.detail,
      });
    } catch {
      setErrorMsg('Network error saving your RSVP. Please try again.');
    } finally {
      setSubmitting(false);
      setSubmittingStatus(null);
    }
  }

  async function handleFormSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await submitRsvp({
      targetStatus: status,
      targetName: guestName,
      targetPlusOnes: plusOnes,
      targetNote: bringingNote,
      shareNoteToWall: postToWall,
    });
  }

  async function handleWithdraw() {
    if (!viewerRsvp) return;
    setWithdrawing(true);
    setErrorMsg(null);

    try {
      const headers: Record<string, string> = {};
      if (guestToken) headers['x-guest-token'] = guestToken;
      if (editKey) headers['x-edit-key'] = editKey;

      const res = await fetch(`/api/events/${event.id}/rsvps/${viewerRsvp.id}`, {
        method: 'DELETE',
        headers,
      });

      const data = (await res.json()) as {
        error?: string;
        detail?: EventDetailResponse;
      };
      if (!res.ok) {
        setErrorMsg(data.error ?? 'Could not cancel registration.');
        return;
      }

      clearGuestToken(event.id);
      saveCachedGuestRsvp(event.id, null);
      setBringingNote('');
      setPlusOnes(0);
      setStatus('yes');
      onEditingChange(false);
      onWithdrawRsvp?.(data.detail);
    } catch {
      setErrorMsg('Network error canceling your registration.');
    } finally {
      setWithdrawing(false);
    }
  }

  async function handleInviteFriendClick() {
    if (onShareInvite) {
      onShareInvite();
      return;
    }
    try {
      const url = typeof window !== 'undefined' ? window.location.href : '';
      if (typeof navigator !== 'undefined' && 'share' in navigator && url) {
        await navigator.share({ title: event.title, url });
        return;
      }
      if (typeof navigator !== 'undefined' && navigator.clipboard && url) {
        await navigator.clipboard.writeText(url);
        setLocalShareCopied(true);
        setTimeout(() => setLocalShareCopied(false), 2000);
      }
    } catch {
      // User dismissed native share sheet
    }
  }

  // ---------------------------------------------------------------------------
  // State A: Already Responded ("You're In" / "Can't Make It")
  // ---------------------------------------------------------------------------
  if (viewerRsvp && !isEditing) {
    const isGoing = viewerRsvp.status === 'yes';
    const countdown = formatRelativeCountdown(event.startIso, event.endIso);
    const copied = shareCopied || localShareCopied;

    return (
      <section
        id="rsvp-section"
        aria-labelledby={formHeadingId}
        className="rounded-2xl border backdrop-blur-md overflow-hidden"
        style={{
          backgroundColor: 'var(--theme-glass-bg)',
          borderColor: 'var(--theme-border)',
        }}
      >
        <div className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <GuestAvatar name={viewerRsvp.guestName} size="lg" />
            {countdown ? (
              <span
                className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border whitespace-nowrap"
                style={{
                  backgroundColor: 'var(--theme-surface-bg)',
                  borderColor: 'var(--theme-hairline)',
                  color: 'var(--theme-text-muted)',
                }}
              >
                {countdown}
              </span>
            ) : null}
          </div>

          <h2
            id={formHeadingId}
            className="mt-3 text-2xl font-bold tracking-tight"
            style={{
              color: 'var(--theme-text-primary)',
              fontFamily: 'var(--font-invite-display), var(--font-invite-body), sans-serif',
            }}
          >
            {isGoing ? "You're In" : "Can't Make It"}
          </h2>

          {(isGoing && viewerRsvp.plusOnes > 0) || viewerRsvp.bringingNote ? (
            <p
              className="mt-1 text-sm leading-relaxed break-words"
              style={{ color: 'var(--theme-text-muted)' }}
            >
              {isGoing && viewerRsvp.plusOnes > 0 ? `+${viewerRsvp.plusOnes} guest${viewerRsvp.plusOnes === 1 ? '' : 's'}` : ''}
              {isGoing && viewerRsvp.plusOnes > 0 && viewerRsvp.bringingNote ? ' · ' : ''}
              {viewerRsvp.bringingNote ? viewerRsvp.bringingNote : ''}
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              popoverTarget="calendar-menu"
              className="inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs sm:text-sm font-medium transition hover:opacity-90 cursor-pointer"
              style={{
                backgroundColor: 'var(--theme-surface-bg)',
                borderColor: 'var(--theme-hairline)',
                color: 'var(--theme-text-primary)',
              }}
            >
              <CalendarPlus className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Add to Calendar</span>
            </button>

            <button
              type="button"
              onClick={() => void handleInviteFriendClick()}
              className="inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs sm:text-sm font-medium transition hover:opacity-90 cursor-pointer"
              style={{
                backgroundColor: 'var(--theme-surface-bg)',
                borderColor: 'var(--theme-hairline)',
                color: 'var(--theme-text-primary)',
              }}
            >
              <Share2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{copied ? 'Link Copied' : 'Invite a Friend'}</span>
            </button>
          </div>

          <p
            className="mt-4 text-xs leading-relaxed"
            style={{ color: 'var(--theme-text-muted)' }}
          >
            Need to change plans?{' '}
            <button
              type="button"
              onClick={() => {
                setStatus(viewerRsvp.status);
                setPlusOnes(viewerRsvp.plusOnes);
                setBringingNote(viewerRsvp.bringingNote ?? '');
                onEditingChange(true);
              }}
              className="underline underline-offset-2 font-medium hover:opacity-100 cursor-pointer"
              style={{ color: 'var(--theme-text-primary)' }}
            >
              Update response
            </button>{' '}
            or{' '}
            <button
              type="button"
              disabled={withdrawing}
              onClick={() => void handleWithdraw()}
              className="underline underline-offset-2 font-medium hover:opacity-100 disabled:opacity-50 cursor-pointer"
              style={{ color: 'var(--theme-text-primary)' }}
            >
              {withdrawing ? 'canceling...' : 'cancel registration'}
            </button>
            .
          </p>

          {errorMsg ? (
            <p role="alert" className="mt-3 text-xs font-medium text-rose-300">
              {errorMsg}
            </p>
          ) : null}
        </div>

        {onOpenSubscribe ? (
          <button
            type="button"
            onClick={onOpenSubscribe}
            className="w-full px-4 py-3.5 sm:px-5 border-t flex items-center justify-between gap-3 text-left transition hover:opacity-90 cursor-pointer"
            style={{ borderColor: 'var(--theme-hairline)' }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <Bell
                className="h-4 w-4 shrink-0"
                style={{ color: 'var(--theme-text-muted)' }}
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p
                  className="text-sm font-medium truncate"
                  style={{ color: 'var(--theme-text-primary)' }}
                >
                  Get Event Reminders
                </p>
                <p
                  className="text-xs truncate"
                  style={{ color: 'var(--theme-text-muted)' }}
                >
                  Push, email, or calendar alerts
                </p>
              </div>
            </div>
            <ChevronRight
              className="h-4 w-4 shrink-0"
              style={{ color: 'var(--theme-text-muted)' }}
              aria-hidden="true"
            />
          </button>
        ) : null}
      </section>
    );
  }

  // ---------------------------------------------------------------------------
  // State B: Recognized Device on New Event (One-Click Binary RSVP)
  // ---------------------------------------------------------------------------
  if (!viewerRsvp && !isEditing && recognizedName && !manualIdentityEdit) {
    return (
      <section
        id="rsvp-section"
        aria-labelledby={formHeadingId}
        className="rounded-2xl border backdrop-blur-md overflow-hidden"
        style={{
          backgroundColor: 'var(--theme-glass-bg)',
          borderColor: 'var(--theme-border)',
        }}
      >
        <div
          className="px-4 py-2.5 sm:px-5 border-b flex items-center justify-between gap-2"
          style={{ borderColor: 'var(--theme-hairline)' }}
        >
          <h2
            id={formHeadingId}
            className="text-sm font-medium"
            style={{
              color: 'var(--theme-text-muted)',
              fontFamily: 'var(--font-invite-display), var(--font-invite-body), sans-serif',
            }}
          >
            Registration
          </h2>
        </div>

        <div className="p-4 sm:p-5 space-y-3.5">
          <p className="text-sm leading-relaxed" style={{ color: 'var(--theme-text-primary)' }}>
            Welcome, <span className="font-semibold">{firstName}</span>! To join the event, tap below.
          </p>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <GuestAvatar name={recognizedName} size="sm" />
              <div className="flex items-baseline gap-2 min-w-0">
                <span
                  className="text-sm font-semibold truncate"
                  style={{ color: 'var(--theme-text-primary)' }}
                >
                  {recognizedName}
                </span>
                {deviceProfile?.email ? (
                  <span
                    className="text-xs truncate"
                    style={{ color: 'var(--theme-text-muted)' }}
                  >
                    {deviceProfile.email}
                  </span>
                ) : null}
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setManualIdentityEdit(true);
                onGuestNameChange('');
              }}
              className="shrink-0 text-xs underline underline-offset-2 opacity-80 hover:opacity-100 cursor-pointer"
              style={{ color: 'var(--theme-text-muted)' }}
            >
              Not {firstName}?
            </button>
          </div>

          {!showOneClickExtras ? (
            <button
              type="button"
              onClick={() => setShowOneClickExtras(true)}
              className="text-xs font-medium opacity-80 hover:opacity-100 transition cursor-pointer"
              style={{ color: 'var(--theme-text-muted)' }}
            >
              + Add a +1 or dish note
            </button>
          ) : (
            <div
              className="space-y-2.5 pt-2 border-t"
              style={{ borderColor: 'var(--theme-hairline)' }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium" style={{ color: 'var(--theme-text-muted)' }}>
                  Bringing a guest?
                </span>
                <div className="inline-flex items-center gap-2">
                  <button
                    type="button"
                    aria-label="Decrease plus-ones"
                    onClick={() => setPlusOnes((n) => Math.max(0, n - 1))}
                    disabled={plusOnes === 0}
                    className="h-7 w-7 rounded-full border flex items-center justify-center disabled:opacity-35 cursor-pointer"
                    style={{
                      borderColor: 'var(--theme-border)',
                      color: 'var(--theme-text-primary)',
                    }}
                  >
                    <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <span
                    className="min-w-[2ch] text-center text-sm font-semibold tabular-nums"
                    style={{ color: 'var(--theme-text-primary)' }}
                  >
                    {plusOnes}
                  </span>
                  <button
                    type="button"
                    aria-label="Increase plus-ones"
                    onClick={() => setPlusOnes((n) => Math.min(20, n + 1))}
                    disabled={plusOnes >= 20}
                    className="h-7 w-7 rounded-full border flex items-center justify-center disabled:opacity-35 cursor-pointer"
                    style={{
                      borderColor: 'var(--theme-border)',
                      color: 'var(--theme-text-primary)',
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <input
                id="rsvp-bringing-note"
                type="text"
                maxLength={240}
                value={bringingNote}
                onChange={(e) => setBringingNote(e.target.value)}
                placeholder={
                  event.rsvpNotePrompt?.trim() || 'Bringing a dish, drink, or note (optional)'
                }
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2"
                style={{
                  backgroundColor: 'var(--theme-surface-bg)',
                  borderColor: 'var(--theme-border)',
                  color: 'var(--theme-text-primary)',
                }}
              />
            </div>
          )}

          {errorMsg ? (
            <p role="alert" className="text-xs font-medium text-rose-300">
              {errorMsg}
            </p>
          ) : null}

          <div className="space-y-2 pt-0.5">
            <button
              type="button"
              disabled={submitting}
              onClick={() =>
                void submitRsvp({
                  targetStatus: 'yes',
                  targetName: recognizedName,
                  targetPlusOnes: plusOnes,
                  targetNote: bringingNote,
                  shareNoteToWall: postToWall,
                })
              }
              className="w-full rounded-xl py-3 px-4 text-sm font-semibold transition active:scale-[0.99] disabled:opacity-60 cursor-pointer flex items-center justify-center gap-2"
              style={primaryCtaStyle}
            >
              {submitting && submittingStatus === 'yes' ? 'Confirming...' : 'One-Click RSVP'}
            </button>

            <button
              type="button"
              disabled={submitting}
              onClick={() =>
                void submitRsvp({
                  targetStatus: 'no',
                  targetName: recognizedName,
                  targetPlusOnes: 0,
                  targetNote: bringingNote,
                  shareNoteToWall: postToWall,
                })
              }
              className="w-full rounded-xl border py-2.5 px-4 text-sm font-medium transition hover:opacity-90 disabled:opacity-60 cursor-pointer"
              style={{
                backgroundColor: 'var(--theme-surface-bg)',
                borderColor: 'var(--theme-hairline)',
                color: 'var(--theme-text-muted)',
              }}
            >
              {submitting && submittingStatus === 'no' ? 'Saving...' : "Can't Make It"}
            </button>
          </div>
        </div>
      </section>
    );
  }

  // ---------------------------------------------------------------------------
  // State C: First-Time Guest / Editing Response / Switching Identity
  // ---------------------------------------------------------------------------
  return (
    <section
      id="rsvp-section"
      aria-labelledby={formHeadingId}
      className="rounded-2xl border backdrop-blur-md overflow-hidden"
      style={{
        backgroundColor: 'var(--theme-glass-bg)',
        borderColor: 'var(--theme-border)',
      }}
    >
      <div
        className="px-4 py-2.5 sm:px-5 border-b flex items-center justify-between gap-2"
        style={{ borderColor: 'var(--theme-hairline)' }}
      >
        <h2
          id={formHeadingId}
          className="text-sm font-medium"
          style={{
            color: 'var(--theme-text-muted)',
            fontFamily: 'var(--font-invite-display), var(--font-invite-body), sans-serif',
          }}
        >
          {isEditing ? 'Update Registration' : 'Registration'}
        </h2>

        {(isEditing || (manualIdentityEdit && recognizedName)) && (
          <button
            type="button"
            onClick={() => {
              setErrorMsg(null);
              if (isEditing) {
                onEditingChange(false);
              } else if (recognizedName) {
                setManualIdentityEdit(false);
                onGuestNameChange(recognizedName);
              }
            }}
            className="text-xs font-medium opacity-80 hover:opacity-100 cursor-pointer"
            style={{ color: 'var(--theme-text-muted)' }}
          >
            Cancel
          </button>
        )}
      </div>

      <form onSubmit={handleFormSubmit} className="p-4 sm:p-5 space-y-3.5">
        {/* Binary-only RSVP selection — strictly Yes or No */}
        <div
          role="radiogroup"
          aria-label="Attendance response"
          className="grid grid-cols-2 gap-2.5"
        >
          <label
            className="relative flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold cursor-pointer transition"
            style={
              status === 'yes'
                ? {
                    backgroundColor: 'var(--theme-accent)',
                    borderColor: 'var(--theme-accent)',
                    color: 'var(--theme-on-accent)',
                  }
                : {
                    backgroundColor: 'var(--theme-surface-bg)',
                    borderColor: 'var(--theme-border)',
                    color: 'var(--theme-text-primary)',
                  }
            }
          >
            <input
              type="radio"
              name="rsvpStatus"
              value="yes"
              checked={status === 'yes'}
              onChange={() => setStatus('yes')}
              className="sr-only"
            />
            <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Yes, I&apos;m Going</span>
          </label>

          <label
            className="relative flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold cursor-pointer transition"
            style={
              status === 'no'
                ? {
                    backgroundColor: 'var(--theme-accent)',
                    borderColor: 'var(--theme-accent)',
                    color: 'var(--theme-on-accent)',
                  }
                : {
                    backgroundColor: 'var(--theme-surface-bg)',
                    borderColor: 'var(--theme-border)',
                    color: 'var(--theme-text-primary)',
                  }
            }
          >
            <input
              type="radio"
              name="rsvpStatus"
              value="no"
              checked={status === 'no'}
              onChange={() => {
                setStatus('no');
                setPlusOnes(0);
              }}
              className="sr-only"
            />
            <X className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Can&apos;t Make It</span>
          </label>
        </div>

        {/* Name field */}
        <div>
          <label
            htmlFor="rsvp-guest-name"
            className="block text-xs font-medium mb-1.5"
            style={{ color: 'var(--theme-text-muted)' }}
          >
            Your name
          </label>
          <input
            ref={nameInputRef}
            id="rsvp-guest-name"
            type="text"
            required
            maxLength={80}
            autoComplete="name"
            value={guestName}
            onChange={(e) => onGuestNameChange(e.target.value)}
            placeholder="First & last name"
            className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none focus:ring-2"
            style={{
              backgroundColor: 'var(--theme-surface-bg)',
              borderColor: 'var(--theme-border)',
              color: 'var(--theme-text-primary)',
            }}
          />

          {awaitingNames.length > 0 && !guestName.trim() ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {awaitingNames.slice(0, 8).map((invited) => (
                <button
                  key={invited}
                  type="button"
                  onClick={() => onGuestNameChange(invited)}
                  className="rounded-full border px-2.5 py-1 text-xs transition hover:opacity-90 cursor-pointer"
                  style={{
                    backgroundColor: 'var(--theme-surface-bg)',
                    borderColor: 'var(--theme-hairline)',
                    color: 'var(--theme-text-muted)',
                  }}
                >
                  {invited}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {/* +1 Counter (only when Going) */}
        {status === 'yes' ? (
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium" style={{ color: 'var(--theme-text-muted)' }}>
              Additional guests (+1s)
            </span>
            <div className="inline-flex items-center gap-2">
              <button
                type="button"
                aria-label="Decrease plus-ones"
                onClick={() => setPlusOnes((n) => Math.max(0, n - 1))}
                disabled={plusOnes === 0}
                className="h-7 w-7 rounded-full border flex items-center justify-center disabled:opacity-35 cursor-pointer"
                style={{
                  borderColor: 'var(--theme-border)',
                  color: 'var(--theme-text-primary)',
                }}
              >
                <Minus className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <span
                className="min-w-[2ch] text-center text-sm font-semibold tabular-nums"
                style={{ color: 'var(--theme-text-primary)' }}
              >
                {plusOnes}
              </span>
              <button
                type="button"
                aria-label="Increase plus-ones"
                onClick={() => setPlusOnes((n) => Math.min(20, n + 1))}
                disabled={plusOnes >= 20}
                className="h-7 w-7 rounded-full border flex items-center justify-center disabled:opacity-35 cursor-pointer"
                style={{
                  borderColor: 'var(--theme-border)',
                  color: 'var(--theme-text-primary)',
                }}
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        ) : null}

        {/* Bringing / RSVP Note */}
        <div>
          <label
            htmlFor="rsvp-bringing-note"
            className="block text-xs font-medium mb-1.5"
            style={{ color: 'var(--theme-text-muted)' }}
          >
            {event.rsvpNotePrompt?.trim() || 'Bringing something or adding a note? (optional)'}
          </label>
          <textarea
            id="rsvp-bringing-note"
            rows={2}
            maxLength={240}
            value={bringingNote}
            onChange={(e) => setBringingNote(e.target.value)}
            placeholder={
              status === 'yes'
                ? 'e.g., Bringing spiced apple cider!'
                : 'e.g., Sorry to miss this — have fun!'
            }
            className="w-full rounded-xl border px-3.5 py-2 text-sm outline-none focus:ring-2 resize-y"
            style={{
              backgroundColor: 'var(--theme-surface-bg)',
              borderColor: 'var(--theme-border)',
              color: 'var(--theme-text-primary)',
            }}
          />

          {bringingNote.trim() ? (
            <label
              className="mt-1.5 flex items-center gap-2 text-xs cursor-pointer"
              style={{ color: 'var(--theme-text-muted)' }}
            >
              <input
                type="checkbox"
                checked={postToWall}
                onChange={(e) => setPostToWall(e.target.checked)}
                className="rounded border"
              />
              <span>Share note to event activity</span>
            </label>
          ) : null}
        </div>

        {errorMsg ? (
          <p role="alert" className="text-xs font-medium text-rose-300">
            {errorMsg}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl py-3 px-4 text-sm font-semibold transition active:scale-[0.99] disabled:opacity-60 cursor-pointer"
          style={primaryCtaStyle}
        >
          {submitting
            ? 'Saving...'
            : isEditing
              ? 'Save Response'
              : status === 'yes'
                ? "Confirm RSVP"
                : "Send Can't Make It"}
        </button>

        {isEditing && viewerRsvp ? (
          <div className="text-center pt-1">
            <button
              type="button"
              disabled={withdrawing}
              onClick={() => void handleWithdraw()}
              className="text-xs underline underline-offset-2 opacity-80 hover:opacity-100 disabled:opacity-50 cursor-pointer"
              style={{ color: 'var(--theme-text-muted)' }}
            >
              {withdrawing ? 'Canceling registration...' : 'Cancel registration'}
            </button>
          </div>
        ) : null}
      </form>
    </section>
  );
}
