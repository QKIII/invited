'use client';

import React, { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import {
  CalendarPlus,
  Check,
  Minus,
  Plus,
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
import { closeTopLayer, setupDialogLightDismiss } from '@/lib/polyfills/ui';
import type {
  CommentRecord,
  EventDetailResponse,
  EventMeta,
  RsvpRecord,
  RsvpStatus,
} from '@/types/invite';
import {
  EmailUpdatesControl,
  validateEmailAddress,
  type ActiveEmailNotifyLevel,
  type ViewerSubscriptionData,
} from './EmailUpdatesControl';
import { GuestAvatar } from './GuestAvatar';

export { getGuestTokenStorageKey } from '@/lib/client/deviceProfile';

interface RsvpPanelProps {
  event: EventMeta;
  awaitingNames: string[];
  viewerRsvp?: RsvpRecord;
  viewerSubscription?: ViewerSubscriptionData;
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
  viewerSubscription,
  editKey,
  guestToken,
  guestName,
  onGuestNameChange,
  isEditing,
  onEditingChange,
  onRsvpSuccess,
  onWithdrawRsvp,
  nameInputRef,
}: RsvpPanelProps) {
  const formHeadingId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const localNameInputRef = useRef<HTMLInputElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const effectiveNameInputRef = nameInputRef ?? localNameInputRef;
  const deviceProfile = useSyncExternalStore(
    subscribeDeviceProfile,
    getDeviceProfile,
    getDeviceProfileServerSnapshot,
  );

  const rsvpDraftKey = `invited_rsvp_draft:${event.id}`;
  const [status, setStatus] = useState<RsvpStatus>(viewerRsvp?.status ?? 'yes');
  const [plusOnes, setPlusOnes] = useState<number>(viewerRsvp?.plusOnes ?? 0);
  const [bringingNote, setBringingNote] = useState<string>(viewerRsvp?.bringingNote ?? '');
  const [manualIdentityEdit, setManualIdentityEdit] = useState<boolean>(false);
  const [emailEnabledOverride, setEmailEnabledOverride] = useState<boolean | null>(null);
  const [guestEmailOverride, setGuestEmailOverride] = useState<string | null>(null);
  const [notifyLevelOverride, setNotifyLevelOverride] =
    useState<ActiveEmailNotifyLevel | null>(null);
  const [emailTouched, setEmailTouched] = useState<boolean>(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [withdrawing, setWithdrawing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const draftHydratedRef = useRef<boolean>(false);

  const emailEnabled = emailEnabledOverride ?? Boolean(viewerSubscription);
  const guestEmail =
    guestEmailOverride ?? viewerSubscription?.email ?? deviceProfile?.email ?? '';
  const notifyLevel: ActiveEmailNotifyLevel =
    notifyLevelOverride ?? viewerSubscription?.notifyLevel ?? 'host_posts';

  const recognizedName = deviceProfile?.name?.trim() || '';
  const firstName = recognizedName.split(/\s+/)[0] || recognizedName;
  const usingRecognizedIdentity =
    Boolean(recognizedName) && !viewerRsvp && !manualIdentityEdit && !guestName.trim();

  const savedNote = viewerRsvp?.bringingNote?.trim() ?? '';
  const hasUnsentNoteDraft = Boolean(
    bringingNote.trim() && bringingNote.trim() !== savedNote,
  );

  function resetEmailDraftOverrides() {
    setEmailEnabledOverride(null);
    setGuestEmailOverride(null);
    setNotifyLevelOverride(null);
    setEmailTouched(false);
    setEmailError(null);
  }

  // Hydrate saved RSVP note draft once per event
  useEffect(() => {
    draftHydratedRef.current = false;
    queueMicrotask(() => {
      try {
        const draft = window.localStorage.getItem(rsvpDraftKey);
        if (draft && draft.trim() && draft.trim() !== savedNote) {
          setBringingNote(draft);
        }
      } catch {
        // Ignore storage read errors
      } finally {
        draftHydratedRef.current = true;
      }
    });
  }, [rsvpDraftKey, savedNote]);

  // Persist unsent RSVP note draft
  useEffect(() => {
    if (!draftHydratedRef.current) return;
    try {
      const trimmed = bringingNote.trim();
      if (!trimmed || trimmed === savedNote) {
        window.localStorage.removeItem(rsvpDraftKey);
      } else {
        window.localStorage.setItem(rsvpDraftKey, bringingNote);
      }
    } catch {
      // Ignore storage quota errors
    }
  }, [bringingNote, rsvpDraftKey, savedNote]);

  // Keep <dialog> synchronized with `isEditing`
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isEditing) {
      if (!dialog.open) {
        if (typeof dialog.showModal === 'function') {
          dialog.showModal();
        } else {
          dialog.setAttribute('open', '');
        }
      }
    } else if (dialog.open) {
      void closeTopLayer(dialog);
    }
  }, [isEditing]);

  // Attach fallback backdrop light-dismiss + native close synchronization
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const cleanupDismiss = setupDialogLightDismiss(dialog);
    const handleNativeClose = () => {
      resetEmailDraftOverrides();
      onEditingChange(false);
    };
    dialog.addEventListener('close', handleNativeClose);

    return () => {
      cleanupDismiss();
      dialog.removeEventListener('close', handleNativeClose);
    };
  }, [onEditingChange]);

  function openSheetForStatus(targetStatus: RsvpStatus) {
    setErrorMsg(null);
    resetEmailDraftOverrides();
    if (viewerRsvp) {
      setStatus(viewerRsvp.status);
      setPlusOnes(viewerRsvp.plusOnes);
      if (!hasUnsentNoteDraft) {
        setBringingNote(viewerRsvp.bringingNote ?? '');
      }
      onGuestNameChange(viewerRsvp.guestName);
      setManualIdentityEdit(false);
    } else {
      setStatus(targetStatus);
      setManualIdentityEdit(false);
    }
    onEditingChange(true);
  }

  function closeSheet() {
    setErrorMsg(null);
    resetEmailDraftOverrides();
    onEditingChange(false);
  }

  function handleEmailToggle(nextEnabled: boolean) {
    setEmailEnabledOverride(nextEnabled);
    if (!nextEnabled) {
      setEmailError(null);
      setEmailTouched(false);
    }
  }

  function handleEmailChange(nextValue: string) {
    setGuestEmailOverride(nextValue);
    setEmailTouched(true);
    if (emailError && validateEmailAddress(nextValue) === null) {
      setEmailError(null);
    }
  }

  function handleEmailBlur() {
    if (!emailEnabled || !emailTouched) return;
    setEmailError(validateEmailAddress(guestEmail));
  }

  async function submitRsvp(params: {
    targetStatus: RsvpStatus;
    targetName: string;
    targetPlusOnes: number;
    targetNote: string;
  }) {
    const trimmedName = params.targetName.trim();
    if (!trimmedName) {
      setErrorMsg('Please enter your name.');
      effectiveNameInputRef.current?.focus();
      return;
    }

    const trimmedEmail = guestEmail.trim();
    if (emailEnabled) {
      const validationErr = validateEmailAddress(trimmedEmail);
      if (validationErr) {
        setEmailTouched(true);
        setEmailError(validationErr);
        emailInputRef.current?.focus();
        return;
      }
    }

    setSubmitting(true);
    setErrorMsg(null);
    setEmailError(null);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (editKey) {
        headers['x-edit-key'] = editKey;
      }
      if (guestToken) {
        headers['x-guest-token'] = guestToken;
      }

      const trimmedNote = params.targetNote.trim();
      const shouldIncludeEmailUpdates = emailEnabled || Boolean(viewerSubscription);
      const res = await fetch(`/api/events/${event.id}/rsvps`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          guestName: trimmedName,
          status: params.targetStatus,
          plusOnes: params.targetStatus === 'yes' ? params.targetPlusOnes : 0,
          bringingNote: trimmedNote || undefined,
          postToWall: Boolean(trimmedNote),
          guestToken: guestToken ?? undefined,
          ...(shouldIncludeEmailUpdates
            ? {
                emailUpdates: emailEnabled
                  ? {
                      enabled: true,
                      email: trimmedEmail,
                      notifyLevel,
                    }
                  : {
                      enabled: false,
                      email: viewerSubscription?.email || trimmedEmail || undefined,
                    },
              }
            : {}),
        }),
      });

      const data = (await res.json()) as RsvpApiResponse;
      if (!res.ok) {
        setErrorMsg(data.error ?? 'Could not save your RSVP. Please try again.');
        return;
      }

      try {
        window.localStorage.removeItem(rsvpDraftKey);
      } catch {
        // Ignore storage errors
      }
      const nextToken = data.guestToken || guestToken || '';
      if (nextToken) {
        saveGuestToken(event.id, nextToken);
      }
      saveCachedGuestRsvp(event.id, data.rsvp);
      saveDeviceProfile({
        name: trimmedName,
        ...(emailEnabled && trimmedEmail ? { email: trimmedEmail } : {}),
      });
      onGuestNameChange(trimmedName);
      setManualIdentityEdit(false);
      resetEmailDraftOverrides();
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
    }
  }

  async function handleFormSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const resolvedName = usingRecognizedIdentity ? recognizedName : guestName;
    await submitRsvp({
      targetStatus: status,
      targetName: resolvedName,
      targetPlusOnes: plusOnes,
      targetNote: bringingNote,
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
        setErrorMsg(data.error ?? 'Could not remove your RSVP.');
        return;
      }

      clearGuestToken(event.id);
      saveCachedGuestRsvp(event.id, null);
      try {
        window.localStorage.removeItem(rsvpDraftKey);
      } catch {
        // Ignore storage errors
      }
      setBringingNote('');
      setPlusOnes(0);
      setStatus('yes');
      resetEmailDraftOverrides();
      onEditingChange(false);
      onWithdrawRsvp?.(data.detail);
    } catch {
      setErrorMsg('Network error removing your RSVP.');
    } finally {
      setWithdrawing(false);
    }
  }

  const countdown = formatRelativeCountdown(event.startIso, event.endIso);
  const respondedSubtitleParts = viewerRsvp
    ? [
        viewerRsvp.status === 'yes' && viewerRsvp.plusOnes > 0
          ? `+${viewerRsvp.plusOnes}`
          : '',
        viewerRsvp.bringingNote?.trim() || '',
        countdown || '',
      ].filter(Boolean)
    : [];
  const respondedSubtitle =
    respondedSubtitleParts.slice(0, 2).join(' · ') || viewerRsvp?.guestName || '';

  return (
    <>
      {/* Sticky Bottom RSVP Bar (< 76px height, safe-area inset aware) */}
      <div
        id="rsvp-section"
        data-testid="sticky-rsvp-footer"
        className="sticky-rsvp-bar fixed inset-x-0 bottom-0 z-30 border-t backdrop-blur-xl pt-2.5 shadow-[0_-10px_30px_rgba(0,0,0,0.22)]"
        style={{
          backgroundColor: 'var(--theme-sticky-bg, var(--theme-card-solid))',
          borderColor: 'var(--theme-hairline, var(--theme-border))',
        }}
      >
        <div className="max-w-[580px] mx-auto">
          {viewerRsvp ? (
            <div className="flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <GuestAvatar name={viewerRsvp.guestName} size="sm" />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p
                      className="text-sm font-bold leading-tight truncate"
                      style={{ color: 'var(--theme-text-primary)' }}
                    >
                      {viewerRsvp.status === 'yes' ? "You're going!" : "Can't make it"}
                    </p>
                    {hasUnsentNoteDraft ? (
                      <span
                        data-testid="rsvp-draft-badge"
                        className="rounded-full border px-1.5 py-0.5 text-[10px] font-semibold"
                        style={{
                          backgroundColor: 'var(--theme-surface-bg)',
                          borderColor: 'var(--theme-accent)',
                          color: 'var(--theme-accent)',
                        }}
                      >
                        Draft
                      </span>
                    ) : null}
                  </div>
                  <p
                    className="text-xs leading-tight truncate mt-0.5"
                    style={{ color: 'var(--theme-text-muted)' }}
                  >
                    {respondedSubtitle}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {viewerRsvp.status === 'yes' ? (
                  <button
                    type="button"
                    popoverTarget="calendar-menu"
                    className="min-h-[40px] rounded-full border px-3 text-xs font-medium inline-flex items-center gap-1.5 transition hover:opacity-90 cursor-pointer"
                    style={{
                      backgroundColor: 'var(--theme-surface-bg)',
                      borderColor: 'var(--theme-border)',
                      color: 'var(--theme-text-primary)',
                    }}
                  >
                    <CalendarPlus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span className="hidden xs:inline sm:inline">Calendar</span>
                  </button>
                ) : null}

                <button
                  type="button"
                  data-testid="edit-rsvp-button"
                  onClick={() => openSheetForStatus(viewerRsvp.status)}
                  className="invite-cta-btn min-h-[40px] rounded-full px-4 text-xs sm:text-sm font-semibold shadow-md transition active:scale-[0.98] cursor-pointer"
                >
                  Edit RSVP
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {hasUnsentNoteDraft ? (
                <span
                  data-testid="rsvp-draft-badge"
                  className="shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold"
                  style={{
                    backgroundColor: 'var(--theme-surface-bg)',
                    borderColor: 'var(--theme-accent)',
                    color: 'var(--theme-accent)',
                  }}
                >
                  Draft
                </span>
              ) : null}
              <button
                type="button"
                data-testid="sticky-rsvp-yes"
                onClick={() => openSheetForStatus('yes')}
                className="invite-cta-btn flex-1 min-h-[46px] rounded-full px-4 text-sm font-semibold shadow-lg transition active:scale-[0.99] cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>I&apos;m going</span>
              </button>

              <button
                type="button"
                data-testid="sticky-rsvp-no"
                onClick={() => openSheetForStatus('no')}
                className="min-h-[46px] shrink-0 rounded-full border px-4 text-sm font-medium transition hover:opacity-90 active:scale-[0.99] cursor-pointer"
                style={{
                  backgroundColor: 'var(--theme-surface-bg)',
                  borderColor: 'var(--theme-border)',
                  color: 'var(--theme-text-primary)',
                }}
              >
                Can&apos;t make it
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Native Modal Dialog Sheet for RSVP */}
      <dialog
        ref={dialogRef}
        closedby="any"
        aria-labelledby={formHeadingId}
        className="sheet-from-bottom w-full sm:w-[calc(100%-2rem)] max-w-[480px] max-h-[90dvh] mx-auto mt-auto mb-0 sm:my-auto rounded-t-3xl sm:rounded-3xl border shadow-2xl p-0 overflow-hidden backdrop-blur-2xl"
        style={{
          backgroundColor: 'var(--theme-card-solid, var(--theme-card-bg))',
          borderColor: 'var(--theme-border)',
          color: 'var(--theme-text-primary)',
        }}
      >
        <div className="flex flex-col max-h-[90dvh]">
        <div
          className="shrink-0 px-5 py-4 border-b flex items-center justify-between gap-3"
          style={{ borderColor: 'var(--theme-hairline)' }}
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2
                id={formHeadingId}
                className="text-lg font-bold tracking-tight truncate"
                style={{
                  color: 'var(--theme-text-primary)',
                  fontFamily: 'var(--font-invite-display), var(--font-invite-body), sans-serif',
                }}
              >
                {viewerRsvp ? 'Update RSVP' : 'Your RSVP'}
              </h2>
              {hasUnsentNoteDraft ? (
                <span
                  className="rounded-full border px-2 py-0.5 text-[10px] font-semibold"
                  style={{
                    backgroundColor: 'var(--theme-surface-bg)',
                    borderColor: 'var(--theme-accent)',
                    color: 'var(--theme-accent)',
                  }}
                >
                  Draft
                </span>
              ) : null}
            </div>
            <p className="text-xs truncate mt-0.5" style={{ color: 'var(--theme-text-muted)' }}>
              {event.title}
            </p>
          </div>

          <button
            type="button"
            onClick={closeSheet}
            aria-label="Close RSVP sheet"
            className="h-9 w-9 rounded-full border flex items-center justify-center shrink-0 opacity-75 hover:opacity-100 cursor-pointer"
            style={{
              borderColor: 'var(--theme-hairline)',
              color: 'var(--theme-text-primary)',
            }}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <form
          onSubmit={handleFormSubmit}
          noValidate
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-5 space-y-4"
        >
          {/* Binary-only RSVP selection — strictly Yes or No */}
          <div
            role="radiogroup"
            aria-label="Attendance response"
            className="grid grid-cols-2 gap-2.5"
          >
            <label
              className={`relative flex items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-sm font-semibold cursor-pointer transition ${
                status === 'yes' ? 'invite-cta-btn shadow-md' : ''
              }`}
              style={
                status === 'yes'
                  ? { borderColor: 'transparent' }
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
              <span>Count me in</span>
            </label>

            <label
              className="relative flex items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-sm font-semibold cursor-pointer transition"
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
              <span>Can&apos;t make it</span>
            </label>
          </div>

          {/* Identity: Recognized Device Card OR Name Input */}
          {recognizedName && !manualIdentityEdit && !viewerRsvp && (!guestName.trim() || guestName.trim() === recognizedName) ? (
            <div
              className="rounded-2xl border p-3.5 flex items-center justify-between gap-2.5"
              style={{
                backgroundColor: 'var(--theme-surface-bg)',
                borderColor: 'var(--theme-hairline)',
              }}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <GuestAvatar name={recognizedName} size="sm" />
                <div className="min-w-0">
                  <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                    Welcome back, <span className="font-semibold">{firstName}!</span>
                  </p>
                  <p
                    className="text-sm font-semibold truncate"
                    style={{ color: 'var(--theme-text-primary)' }}
                  >
                    {recognizedName}
                  </p>
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
          ) : (
            <div>
              <label
                htmlFor="rsvp-guest-name"
                className="block text-xs font-medium mb-1.5"
                style={{ color: 'var(--theme-text-muted)' }}
              >
                Your name
              </label>
              <input
                ref={effectiveNameInputRef}
                id="rsvp-guest-name"
                type="text"
                required
                maxLength={80}
                autoComplete="name"
                value={guestName}
                onChange={(e) => onGuestNameChange(e.target.value)}
                placeholder="First & last name"
                className="w-full rounded-xl border px-3.5 py-2.5 text-base sm:text-sm outline-none focus:ring-2"
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
          )}

          {/* +1 Counter (only when Going) */}
          {status === 'yes' ? (
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs sm:text-sm font-medium" style={{ color: 'var(--theme-text-muted)' }}>
                Bringing extra guests?
              </span>
              <div className="inline-flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Decrease plus-ones"
                  onClick={() => setPlusOnes((n) => Math.max(0, n - 1))}
                  disabled={plusOnes === 0}
                  className="h-8 w-8 rounded-full border flex items-center justify-center disabled:opacity-35 cursor-pointer"
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
                  className="h-8 w-8 rounded-full border flex items-center justify-center disabled:opacity-35 cursor-pointer"
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
              {event.rsvpNotePrompt?.trim() || 'Bringing food, a dish, or a quick note? (optional)'}
            </label>
            <textarea
              id="rsvp-bringing-note"
              rows={2}
              maxLength={240}
              value={bringingNote}
              onChange={(e) => setBringingNote(e.target.value)}
              placeholder={
                status === 'yes'
                  ? 'e.g., Bringing warm sourdough & cider!'
                  : 'e.g., Sorry to miss it — have fun!'
              }
              className="w-full rounded-xl border px-3.5 py-2 text-base sm:text-sm outline-none focus:ring-2 resize-y"
              style={{
                backgroundColor: 'var(--theme-surface-bg)',
                borderColor: 'var(--theme-border)',
                color: 'var(--theme-text-primary)',
              }}
            />
          </div>

          <EmailUpdatesControl
            enabled={emailEnabled}
            onEnabledChange={handleEmailToggle}
            email={guestEmail}
            onEmailChange={handleEmailChange}
            onEmailBlur={handleEmailBlur}
            emailError={emailError}
            notifyLevel={notifyLevel}
            onNotifyLevelChange={setNotifyLevelOverride}
            emailInputId="rsvp-email-input"
            emailInputRef={emailInputRef}
          />

          {errorMsg ? (
            <p role="alert" className="text-xs font-medium text-rose-500">
              {errorMsg}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="invite-cta-btn w-full min-h-[48px] rounded-full py-3 px-5 text-sm sm:text-base font-semibold shadow-lg transition active:scale-[0.99] disabled:opacity-60 cursor-pointer"
          >
            {submitting
              ? 'Saving...'
              : viewerRsvp
                ? 'Save RSVP'
                : status === 'yes'
                  ? recognizedName && !manualIdentityEdit
                    ? `RSVP as ${firstName}`
                    : "Confirm I'm going"
                  : "Send can't make it"}
          </button>

          {viewerRsvp ? (
            <div className="text-center">
              <button
                type="button"
                disabled={withdrawing}
                onClick={() => void handleWithdraw()}
                className="text-xs underline underline-offset-2 opacity-75 hover:opacity-100 disabled:opacity-50 cursor-pointer"
                style={{ color: 'var(--theme-text-muted)' }}
              >
                {withdrawing ? 'Removing RSVP...' : 'Remove RSVP'}
              </button>
            </div>
          ) : null}
        </form>
        </div>
      </dialog>
    </>
  );
}
