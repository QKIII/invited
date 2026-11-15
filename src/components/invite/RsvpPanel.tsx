'use client';

import { useState } from 'react';
import { Bell, Check, Minus, Plus, Sparkles, X } from 'lucide-react';
import type { EventDetailResponse, EventMeta, RsvpRecord, RsvpStatus } from '@/types/invite';

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
    detail?: EventDetailResponse;
  }) => void;
  onWithdrawRsvp?: (detail?: EventDetailResponse) => void;
  onOpenSubscribe: () => void;
  nameInputRef?: React.RefObject<HTMLInputElement | null>;
}

export function getGuestTokenStorageKey(eventId: string): string {
  return `invited_guest_tokens:${eventId}`;
}

export function RsvpPanel({
  event,
  awaitingNames,
  viewerRsvp,
  editKey = null,
  guestToken,
  guestName,
  onGuestNameChange,
  isEditing,
  onEditingChange,
  onRsvpSuccess,
  onWithdrawRsvp,
  onOpenSubscribe,
  nameInputRef,
}: RsvpPanelProps) {
  const [status, setStatus] = useState<RsvpStatus | null>(viewerRsvp?.status ?? null);
  const [plusOnes, setPlusOnes] = useState<number>(viewerRsvp?.plusOnes ?? 0);
  const [bringingNote, setBringingNote] = useState<string>(viewerRsvp?.bringingNote ?? '');
  const [postToWall, setPostToWall] = useState<boolean>(false);
  const [userToggledWall, setUserToggledWall] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isWithdrawing, setIsWithdrawing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savedFeedback, setSavedFeedback] = useState<string | null>(null);

  const showSummary = Boolean(viewerRsvp) && !isEditing;

  const handleStartEdit = () => {
    if (viewerRsvp) {
      setStatus(viewerRsvp.status);
      onGuestNameChange(viewerRsvp.guestName);
      setPlusOnes(viewerRsvp.status === 'yes' ? Math.min(10, Math.max(0, viewerRsvp.plusOnes)) : 0);
      setBringingNote(viewerRsvp.bringingNote ?? '');
      setPostToWall(false);
      setUserToggledWall(false);
    }
    setErrorMessage(null);
    setSavedFeedback(null);
    onEditingChange(true);
  };

  const handleNoteChange = (value: string) => {
    const wasEmpty = bringingNote.trim().length === 0;
    const nowNonEmpty = value.trim().length > 0;
    setBringingNote(value);
    if (wasEmpty && nowNonEmpty && !userToggledWall) {
      setPostToWall(true);
    } else if (!nowNonEmpty && !userToggledWall) {
      setPostToWall(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);
    setSavedFeedback(null);

    if (status !== 'yes' && status !== 'no') {
      setErrorMessage("Please select Yes, I'm coming or No, can't make it.");
      return;
    }

    const trimmedName = guestName.trim();
    if (!trimmedName) {
      setErrorMessage('Please enter your name so the host knows who is responding.');
      nameInputRef?.current?.focus();
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/events/${encodeURIComponent(event.id)}/rsvps`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(editKey ? { 'x-edit-key': editKey } : {}),
          ...(guestToken ? { 'x-guest-token': guestToken } : {}),
        },
        body: JSON.stringify({
          guestName: trimmedName,
          status,
          plusOnes: status === 'yes' ? plusOnes : 0,
          bringingNote: bringingNote.trim() || undefined,
          guestToken: guestToken || undefined,
          postToWall: bringingNote.trim() ? postToWall : false,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        rsvp?: RsvpRecord;
        guestToken?: string;
        detail?: EventDetailResponse;
      };

      if (!response.ok || !data.rsvp) {
        setErrorMessage(data.error || 'Could not save your RSVP. Please try again.');
        return;
      }

      const nextToken = data.guestToken || guestToken || '';
      if (nextToken && typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(getGuestTokenStorageKey(event.id), nextToken);
        } catch {
          // Ignore storage quota / private mode issues
        }
      }

      setSavedFeedback(
        data.rsvp.status === 'yes'
          ? "You're on the list! Looking forward to seeing you."
          : 'Response saved. Thanks for letting the host know!',
      );
      onRsvpSuccess({
        rsvp: data.rsvp,
        guestToken: nextToken,
        detail: data.detail,
      });
      onEditingChange(false);
    } catch {
      setErrorMessage('Network error while saving your RSVP. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWithdrawRsvp = async () => {
    if (!viewerRsvp || !guestToken) return;
    setIsWithdrawing(true);
    setErrorMessage(null);
    try {
      const res = await fetch(
        `/api/events/${encodeURIComponent(event.id)}/rsvps/${encodeURIComponent(viewerRsvp.id)}`,
        {
          method: 'DELETE',
          headers: {
            'x-guest-token': guestToken,
          },
        },
      );
      if (!res.ok) {
        setErrorMessage('Could not remove your RSVP. Please try again.');
        return;
      }
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.removeItem(getGuestTokenStorageKey(event.id));
        } catch {
          // Ignore storage error
        }
      }
      const detailRes = await fetch(`/api/events/${encodeURIComponent(event.id)}`, {
        cache: 'no-store',
      });
      const freshDetail = detailRes.ok
        ? ((await detailRes.json()) as EventDetailResponse)
        : undefined;

      setStatus(null);
      setPlusOnes(0);
      setBringingNote('');
      setSavedFeedback(null);
      onGuestNameChange('');
      onWithdrawRsvp?.(freshDetail);
      onEditingChange(true);
    } catch {
      setErrorMessage('Network error while removing your RSVP.');
    } finally {
      setIsWithdrawing(false);
    }
  };

  return (
    <section
      id="rsvp-section"
      aria-labelledby="rsvp-heading"
      className="invite-card rounded-2xl border p-5 sm:p-6 transition-colors"
      style={{
        backgroundColor: 'var(--theme-surface-bg)',
        borderColor: 'var(--theme-border)',
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2
            id="rsvp-heading"
            className="text-xl sm:text-2xl font-semibold tracking-tight"
            style={{ fontFamily: 'var(--theme-font-heading)' }}
          >
            {showSummary ? 'Your RSVP' : 'RSVP'}
          </h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--theme-text-muted)' }}>
            No account needed — respond in seconds.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenSubscribe}
          className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-medium min-h-[44px] transition-opacity hover:opacity-85 cursor-pointer"
          style={{
            borderColor: 'var(--theme-border)',
            color: 'var(--theme-text-primary)',
          }}
        >
          <Bell className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Notify me of updates</span>
        </button>
      </div>

      {savedFeedback && (
        <div
          role="status"
          className="mb-4 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium"
          style={{
            borderColor: 'var(--theme-accent)',
            backgroundColor: 'color-mix(in srgb, var(--theme-accent) 14%, transparent)',
          }}
        >
          <Sparkles className="h-4 w-4 shrink-0" style={{ color: 'var(--theme-accent)' }} aria-hidden="true" />
          <span>{savedFeedback}</span>
        </div>
      )}

      {showSummary && viewerRsvp ? (
        <div className="space-y-4">
          <div
            className="rounded-xl border p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            style={{
              borderColor: 'var(--theme-accent)',
              backgroundColor: 'color-mix(in srgb, var(--theme-accent) 12%, var(--theme-card-bg))',
            }}
          >
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="invite-on-accent inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold"
                  style={{ backgroundColor: 'var(--theme-accent)' }}
                >
                  {viewerRsvp.status === 'yes' ? (
                    <>
                      <Check className="h-4 w-4" aria-hidden="true" />
                      <span>You responded: Yes, I&apos;m coming</span>
                    </>
                  ) : (
                    <>
                      <X className="h-4 w-4" aria-hidden="true" />
                      <span>You responded: No, can&apos;t make it</span>
                    </>
                  )}
                </span>
                {viewerRsvp.status === 'yes' && viewerRsvp.plusOnes > 0 && (
                  <span
                    className="rounded-full border px-2.5 py-0.5 text-xs font-medium"
                    style={{ borderColor: 'var(--theme-border)' }}
                  >
                    +{viewerRsvp.plusOnes} {viewerRsvp.plusOnes === 1 ? 'guest' : 'guests'}
                  </span>
                )}
              </div>

              <p className="text-sm font-medium">
                Name: <span className="font-semibold">{viewerRsvp.guestName}</span>
              </p>

              {viewerRsvp.bringingNote && (
                <p className="text-sm" style={{ color: 'var(--theme-text-muted)' }}>
                  (Bringing / Note: &ldquo;{viewerRsvp.bringingNote}&rdquo;)
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleStartEdit}
                className="invite-on-accent inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold min-h-[48px] transition-opacity hover:opacity-90 cursor-pointer"
                style={{ backgroundColor: 'var(--theme-accent)' }}
              >
                Update my RSVP
              </button>
              <button
                type="button"
                onClick={handleWithdrawRsvp}
                disabled={isWithdrawing}
                className="inline-flex items-center justify-center rounded-xl border px-3.5 py-2.5 text-sm font-medium min-h-[48px] transition-opacity hover:opacity-80 disabled:opacity-50 cursor-pointer"
                style={{
                  borderColor: 'var(--theme-border)',
                  color: 'var(--theme-text-muted)',
                }}
              >
                {isWithdrawing ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <fieldset className="space-y-2.5">
            <legend className="text-sm font-medium mb-1">
              Can you make it?
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label
                data-selected={status === 'yes' ? 'true' : undefined}
                className="flex items-center gap-3 rounded-xl border px-4 py-3.5 min-h-[52px] cursor-pointer transition-all"
                style={{
                  borderColor:
                    status === 'yes' ? 'var(--theme-accent)' : 'var(--theme-border)',
                  backgroundColor:
                    status === 'yes'
                      ? 'color-mix(in srgb, var(--theme-accent) 16%, var(--theme-card-bg))'
                      : 'var(--theme-card-bg)',
                  boxShadow:
                    status === 'yes' ? '0 0 0 1px var(--theme-accent)' : undefined,
                }}
              >
                <input
                  type="radio"
                  name="rsvpStatus"
                  value="yes"
                  checked={status === 'yes'}
                  onChange={() => {
                    setStatus('yes');
                    setErrorMessage(null);
                  }}
                  required
                  className="h-5 w-5 shrink-0 cursor-pointer"
                  style={{ accentColor: 'var(--theme-accent)' }}
                />
                <span
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border"
                  style={{
                    borderColor:
                      status === 'yes' ? 'var(--theme-accent)' : 'var(--theme-border)',
                    backgroundColor:
                      status === 'yes' ? 'var(--theme-accent)' : 'transparent',
                    color:
                      status === 'yes'
                        ? 'var(--theme-on-accent, #ffffff)'
                        : 'var(--theme-text-primary)',
                  }}
                  aria-hidden="true"
                >
                  <Check className="h-4 w-4" />
                </span>
                <span className="font-semibold text-base">Yes, I&apos;m coming</span>
              </label>

              <label
                data-selected={status === 'no' ? 'true' : undefined}
                className="flex items-center gap-3 rounded-xl border px-4 py-3.5 min-h-[52px] cursor-pointer transition-all"
                style={{
                  borderColor:
                    status === 'no' ? 'var(--theme-accent)' : 'var(--theme-border)',
                  backgroundColor:
                    status === 'no'
                      ? 'color-mix(in srgb, var(--theme-accent) 16%, var(--theme-card-bg))'
                      : 'var(--theme-card-bg)',
                  boxShadow:
                    status === 'no' ? '0 0 0 1px var(--theme-accent)' : undefined,
                }}
              >
                <input
                  type="radio"
                  name="rsvpStatus"
                  value="no"
                  checked={status === 'no'}
                  onChange={() => {
                    setStatus('no');
                    setPlusOnes(0);
                    setErrorMessage(null);
                  }}
                  required
                  className="h-5 w-5 shrink-0 cursor-pointer"
                  style={{ accentColor: 'var(--theme-accent)' }}
                />
                <span
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border"
                  style={{
                    borderColor:
                      status === 'no' ? 'var(--theme-accent)' : 'var(--theme-border)',
                    backgroundColor:
                      status === 'no' ? 'var(--theme-accent)' : 'transparent',
                    color:
                      status === 'no'
                        ? 'var(--theme-on-accent, #ffffff)'
                        : 'var(--theme-text-primary)',
                  }}
                  aria-hidden="true"
                >
                  <X className="h-4 w-4" />
                </span>
                <span className="font-semibold text-base">No, can&apos;t make it</span>
              </label>
            </div>
          </fieldset>

          {awaitingNames.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium" style={{ color: 'var(--theme-text-muted)' }}>
                Are you one of these guests? Tap to select:
              </p>
              <div className="flex flex-wrap gap-2">
                {awaitingNames.slice(0, 12).map((name) => {
                  const isSelected = guestName.trim().toLowerCase() === name.toLowerCase();
                  return (
                    <button
                      key={name}
                      type="button"
                      data-selected={isSelected ? 'true' : undefined}
                      onClick={() => {
                        onGuestNameChange(name);
                        setErrorMessage(null);
                      }}
                      className="rounded-full border px-3.5 py-1.5 text-sm font-medium min-h-[44px] transition-colors cursor-pointer"
                      style={{
                        borderColor: isSelected
                          ? 'var(--theme-accent)'
                          : 'var(--theme-border)',
                        backgroundColor: isSelected
                          ? 'color-mix(in srgb, var(--theme-accent) 16%, transparent)'
                          : 'var(--theme-card-bg)',
                      }}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
            <div className={status === 'yes' ? 'sm:col-span-7 space-y-1.5' : 'sm:col-span-12 space-y-1.5'}>
              <label htmlFor="rsvp-guest-name" className="block text-sm font-medium">
                Your Name <span aria-hidden="true">*</span>
              </label>
              <input
                ref={nameInputRef}
                id="rsvp-guest-name"
                name="guestName"
                type="text"
                required
                autoComplete="name"
                value={guestName}
                onChange={(e) => {
                  onGuestNameChange(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="Enter your full name"
                className="w-full rounded-xl border px-3.5 py-2.5 min-h-[48px] focus:outline-none focus-visible:ring-2"
                style={{
                  fontSize: 'max(1rem, 1em)',
                  backgroundColor: 'var(--theme-card-bg)',
                  borderColor: 'var(--theme-border)',
                  color: 'var(--theme-text-primary)',
                }}
              />
            </div>

            {status === 'yes' && (
              <div className="sm:col-span-5 space-y-1.5">
                <span id="plus-ones-label" className="block text-sm font-medium">
                  Bringing extra guests?
                </span>
                <div
                  role="group"
                  aria-labelledby="plus-ones-label"
                  className="flex items-center justify-between rounded-xl border px-2 min-h-[48px]"
                  style={{
                    backgroundColor: 'var(--theme-card-bg)',
                    borderColor: 'var(--theme-border)',
                  }}
                >
                  <button
                    type="button"
                    aria-label="Decrease plus-ones"
                    onClick={() => setPlusOnes((n) => Math.max(0, n - 1))}
                    disabled={plusOnes <= 0}
                    className="inline-flex h-10 w-10 min-w-[44px] min-h-[44px] items-center justify-center rounded-lg transition-opacity disabled:opacity-35 hover:opacity-80 cursor-pointer"
                  >
                    <Minus className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <span className="text-sm font-semibold tabular-nums px-2">
                    {plusOnes === 0 ? '+0 (Just me)' : `+${plusOnes} ${plusOnes === 1 ? 'guest' : 'guests'}`}
                  </span>
                  <button
                    type="button"
                    aria-label="Increase plus-ones"
                    onClick={() => setPlusOnes((n) => Math.min(10, n + 1))}
                    disabled={plusOnes >= 10}
                    className="inline-flex h-10 w-10 min-w-[44px] min-h-[44px] items-center justify-center rounded-lg transition-opacity disabled:opacity-35 hover:opacity-80 cursor-pointer"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="rsvp-bringing-note" className="block text-sm font-medium">
              Comment or what you&apos;re bringing
            </label>
            <textarea
              id="rsvp-bringing-note"
              name="bringingNote"
              rows={2}
              value={bringingNote}
              onChange={(e) => handleNoteChange(e.target.value)}
              placeholder={
                event.rsvpNotePrompt ||
                'e.g. Bringing homemade mac & cheese and sparkling cider!'
              }
              className="w-full rounded-xl border px-3.5 py-2.5 focus:outline-none focus-visible:ring-2"
              style={{
                resize: 'vertical',
                fontSize: 'max(1rem, 1em)',
                backgroundColor: 'var(--theme-card-bg)',
                borderColor: 'var(--theme-border)',
                color: 'var(--theme-text-primary)',
              }}
            />

            {bringingNote.trim().length > 0 && (
              <label className="inline-flex items-center gap-2.5 pt-1 text-sm cursor-pointer min-h-[44px]">
                <input
                  type="checkbox"
                  checked={postToWall}
                  onChange={(e) => {
                    setUserToggledWall(true);
                    setPostToWall(e.target.checked);
                  }}
                  className="h-4 w-4 rounded"
                  style={{ accentColor: 'var(--theme-accent)' }}
                />
                <span>Also post this note on the Event Wall</span>
              </label>
            )}
          </div>

          {errorMessage && (
            <p
              role="alert"
              className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-sm font-medium text-red-400"
            >
              {errorMessage}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={isSubmitting}
              className="invite-on-accent inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-base font-semibold min-h-[52px] transition-opacity hover:opacity-90 disabled:opacity-60 cursor-pointer"
              style={{ backgroundColor: 'var(--theme-accent)' }}
            >
              {isSubmitting
                ? 'Saving RSVP...'
                : viewerRsvp
                  ? 'Save Updated RSVP'
                  : 'Send RSVP'}
            </button>

            {viewerRsvp && isEditing && (
              <button
                type="button"
                onClick={() => {
                  setErrorMessage(null);
                  onEditingChange(false);
                }}
                className="inline-flex items-center justify-center rounded-xl border px-4 py-3 text-sm font-medium min-h-[52px] hover:opacity-80 cursor-pointer"
                style={{
                  borderColor: 'var(--theme-border)',
                  color: 'var(--theme-text-muted)',
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      )}
    </section>
  );
}
