'use client';

import React, { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  Calendar,
  Check,
  ChevronDown,
  Clock,
  Globe,
  Image as ImageIcon,
  Lock,
  MapPin,
  Palette,
  RotateCcw,
  User,
} from 'lucide-react';
import { CoverArt } from '@/components/covers/CoverArt';
import { RichTextEditor } from '@/components/editor/RichTextEditor';
import {
  getDeviceProfile,
  getDeviceProfileServerSnapshot,
  saveDeviceProfile,
  subscribeDeviceProfile,
} from '@/lib/client/deviceProfile';
import { rememberHostEvent } from '@/lib/client/recentEvents';
import {
  EXAMPLE_EVENT_PROMPTS,
  parseEventPrompt,
  type ParsedEventDraft,
} from '@/lib/nlp/parseEventPrompt';
import { getThemePreset } from '@/lib/themes/presets';
import type { EventMeta, InviteStyleConfig } from '@/types/invite';
import {
  getBrowserTimeZone,
  getSupportedTimeZones,
  isoToLocalFields,
  parseInvitedNames,
  validateAndBuildZonedIso,
  type DstConflictInfo,
} from './dateTimeUtils';
import {
  PublishSuccessDialog,
  type PublishedEventResult,
} from './PublishSuccessDialog';
import { StyleStudioDrawer, type StudioDrawerTab } from './StyleStudioDrawer';

interface InviteStudioProps {
  mode: 'create' | 'edit';
  initialDraft?: ParsedEventDraft | null;
  initialEvent?: EventMeta;
  eventId?: string;
  editKey?: string;
  onSaved?: (updated: EventMeta) => void;
  onStyleChange?: (style: InviteStyleConfig) => void;
}

function getDefaultStyle(): InviteStyleConfig {
  const preset = getThemePreset('winter-snowfall');
  return {
    themeId: preset.id,
    fontId: preset.defaultFontId,
    effectId: preset.defaultEffectId,
    coverPresetId: preset.defaultCoverPresetId,
    coverLayout: 'banner',
    colorMode: preset.colorMode,
  };
}

function getDefaultDateString(): string {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const yyyy = tomorrow.getFullYear();
  const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const dd = String(tomorrow.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function InviteStudio({
  mode,
  initialDraft,
  initialEvent,
  eventId,
  editKey,
  onSaved,
  onStyleChange,
}: InviteStudioProps) {
  const titleId = useId();
  const promptInputId = useId();
  const deviceProfile = useSyncExternalStore(
    subscribeDeviceProfile,
    getDeviceProfile,
    getDeviceProfileServerSnapshot,
  );

  const initialSource = initialEvent ?? initialDraft;
  const initialStyle: InviteStyleConfig = initialSource?.style ?? getDefaultStyle();

  const [hasStartedCard, setHasStartedCard] = useState<boolean>(
    mode === 'edit' || Boolean(initialDraft || initialEvent),
  );
  const [quickPrompt, setQuickPrompt] = useState<string>('');
  const [filledNote, setFilledNote] = useState<string | null>(
    initialDraft ? `Started with ${initialDraft.detectedOccasionLabel}` : null,
  );

  const [title, setTitle] = useState<string>(initialSource?.title ?? '');
  const [startDate, setStartDate] = useState<string>(() => {
    const raw = initialSource?.startIso?.match(/^(\d{4}-\d{2}-\d{2})/)?.[1];
    return raw || getDefaultDateString();
  });
  const [startTime, setStartTime] = useState<string>(() => {
    const raw = initialSource?.startIso?.match(/T(\d{2}:\d{2})/)?.[1];
    return raw || '18:00';
  });
  const [hasEndTime, setHasEndTime] = useState<boolean>(
    Boolean(initialSource?.endIso),
  );
  const [endDate, setEndDate] = useState<string>(() => {
    const raw = initialSource?.endIso?.match(/^(\d{4}-\d{2}-\d{2})/)?.[1];
    return raw || getDefaultDateString();
  });
  const [endTime, setEndTime] = useState<string>(() => {
    const raw = initialSource?.endIso?.match(/T(\d{2}:\d{2})/)?.[1];
    return raw || '21:00';
  });
  const [timeZone, setTimeZone] = useState<string>(
    initialSource?.timeZone || 'America/New_York',
  );

  const [locationName, setLocationName] = useState<string>(
    initialSource?.locationName ?? '',
  );
  const [locationAddress, setLocationAddress] = useState<string>(
    initialSource?.locationAddress ?? '',
  );
  const [virtualUrl, setVirtualUrl] = useState<string>(
    initialSource?.virtualUrl ?? '',
  );
  const hasDistinctVenueAndAddress = Boolean(
    initialSource?.locationAddress?.trim() &&
      initialSource.locationAddress.trim().toLowerCase() !==
        (initialSource.locationName?.trim().toLowerCase() ?? ''),
  );
  const [showLocationDetails, setShowLocationDetails] = useState<boolean>(
    Boolean(
      hasDistinctVenueAndAddress ||
        (initialSource?.locationName?.trim() && initialSource?.virtualUrl?.trim()),
    ),
  );

  const [descriptionHtml, setDescriptionHtml] = useState<string>(
    initialSource?.descriptionHtml ?? '',
  );
  const [hostName, setHostName] = useState<string>(
    initialSource?.hostName ?? '',
  );
  const [hostTouched, setHostTouched] = useState<boolean>(false);
  const effectiveHostName = hostTouched
    ? hostName
    : hostName || (mode === 'create' ? (deviceProfile?.name ?? '') : '');
  const [rsvpNotePrompt, setRsvpNotePrompt] = useState<string>(
    initialSource?.rsvpNotePrompt ?? '',
  );
  const [invitedNamesRaw, setInvitedNamesRaw] = useState<string>(
    initialEvent?.invitedNames?.join(', ') ?? '',
  );
  const [hideGuestList, setHideGuestList] = useState<boolean>(
    initialEvent?.hideGuestList ?? false,
  );
  const [style, setStyle] = useState<InviteStyleConfig>(initialStyle);

  const [themeDrawerOpen, setThemeDrawerOpen] = useState<boolean>(false);
  const [themeDrawerTab, setThemeDrawerTab] = useState<StudioDrawerTab>('theme');

  const [startDstConflict, setStartDstConflict] = useState<DstConflictInfo | null>(null);
  const [startDisambiguation, setStartDisambiguation] = useState<'earlier' | 'later' | undefined>();
  const [endDstConflict, setEndDstConflict] = useState<DstConflictInfo | null>(null);
  const [endDisambiguation, setEndDisambiguation] = useState<'earlier' | 'later' | undefined>();

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<boolean>(false);
  const [publishedResult, setPublishedResult] = useState<PublishedEventResult | null>(null);

  const titleTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    onStyleChange?.(style);
  }, [style, onStyleChange]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active && !initialSource?.timeZone) {
        setTimeZone(getBrowserTimeZone());
      }
    });
    if (initialSource?.startIso) {
      const tz = initialSource.timeZone || getBrowserTimeZone();
      void isoToLocalFields(initialSource.startIso, tz).then(({ date, time }) => {
        if (active && date) setStartDate(date);
        if (active && time) setStartTime(time);
      });
    }
    if (initialSource?.endIso) {
      const tz = initialSource.timeZone || getBrowserTimeZone();
      void isoToLocalFields(initialSource.endIso, tz).then(({ date, time }) => {
        if (active && date) setEndDate(date);
        if (active && time) setEndTime(time);
      });
    }
    return () => {
      active = false;
    };
  }, [initialSource?.endIso, initialSource?.startIso, initialSource?.timeZone]);

  useEffect(() => {
    const el = titleTextareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(el.scrollHeight, 36)}px`;
  }, [title, hasStartedCard]);

  const timeZones = useMemo(() => getSupportedTimeZones(timeZone), [timeZone]);
  const activePreset = getThemePreset(style.themeId);

  function openThemeDrawer(tab: StudioDrawerTab) {
    setThemeDrawerTab(tab);
    setThemeDrawerOpen(true);
  }

  function handleAutofillPrompt(rawInput?: string) {
    const sourcePrompt = (rawInput ?? quickPrompt).trim();
    if (!sourcePrompt) {
      setHasStartedCard(true);
      return;
    }

    const parsed = parseEventPrompt(
      sourcePrompt,
      new Date(),
      timeZone || getBrowserTimeZone(),
    );
    setTitle(parsed.title);
    if (parsed.timeZone) setTimeZone(parsed.timeZone);
    setLocationName(parsed.locationName ?? '');
    setLocationAddress(parsed.locationAddress ?? '');
    setVirtualUrl(parsed.virtualUrl ?? '');
    const distinctVenueAndAddress = Boolean(
      parsed.locationAddress?.trim() &&
        parsed.locationAddress.trim().toLowerCase() !==
          (parsed.locationName?.trim().toLowerCase() ?? ''),
    );
    setShowLocationDetails(
      Boolean(distinctVenueAndAddress || (parsed.locationName && parsed.virtualUrl)),
    );
    if (parsed.hostName && !effectiveHostName.trim()) {
      setHostTouched(true);
      setHostName(parsed.hostName);
    }
    if (parsed.descriptionHtml) setDescriptionHtml(parsed.descriptionHtml);
    if (parsed.rsvpNotePrompt) setRsvpNotePrompt(parsed.rsvpNotePrompt);
    setStyle(parsed.style);

    void isoToLocalFields(parsed.startIso, parsed.timeZone).then(({ date, time }) => {
      if (date) setStartDate(date);
      if (time) setStartTime(time);
    });
    if (parsed.endIso) {
      setHasEndTime(true);
      void isoToLocalFields(parsed.endIso, parsed.timeZone).then(({ date, time }) => {
        if (date) setEndDate(date);
        if (time) setEndTime(time);
      });
    } else {
      setHasEndTime(false);
    }

    setHasStartedCard(true);
    setFilledNote(`Filled from your note · ${parsed.detectedOccasionLabel}`);
    setErrorMsg(null);
  }

  const singleLocationValue =
    !showLocationDetails && virtualUrl && !locationName ? virtualUrl : locationName;

  function handleSingleLocationChange(val: string) {
    const trimmed = val.trim();
    if (/^https?:\/\//i.test(trimmed)) {
      setVirtualUrl(val);
      setLocationName('');
      setLocationAddress('');
    } else {
      setLocationName(val);
      setLocationAddress('');
      if (/^https?:\/\//i.test(virtualUrl)) {
        setVirtualUrl('');
      }
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMsg(null);
    setSavedNotice(false);

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setErrorMsg('Please enter an event title.');
      titleTextareaRef.current?.focus();
      return;
    }

    const startRes = await validateAndBuildZonedIso(
      startDate,
      startTime,
      timeZone,
      startDisambiguation,
    );
    if (startRes.dstConflict) {
      setStartDstConflict(startRes.dstConflict);
      setErrorMsg(startRes.dstConflict.message);
      return;
    }
    setStartDstConflict(null);
    if (startRes.error || !startRes.iso) {
      setErrorMsg(startRes.error || 'Please pick a valid start date and time.');
      return;
    }

    let finalEndIso: string | undefined;
    if (hasEndTime && endDate && endTime) {
      const endRes = await validateAndBuildZonedIso(
        endDate,
        endTime,
        timeZone,
        endDisambiguation,
      );
      if (endRes.dstConflict) {
        setEndDstConflict(endRes.dstConflict);
        setErrorMsg(endRes.dstConflict.message);
        return;
      }
      setEndDstConflict(null);
      if (endRes.error || !endRes.iso) {
        setErrorMsg(endRes.error || 'Please pick a valid end date and time.');
        return;
      }
      if (new Date(endRes.iso).getTime() < new Date(startRes.iso).getTime()) {
        setErrorMsg('End time needs to be after the start time.');
        return;
      }
      finalEndIso = endRes.iso;
    }

    const payload = {
      title: trimmedTitle,
      descriptionHtml,
      startIso: startRes.iso,
      endIso: finalEndIso,
      timeZone,
      locationName: locationName.trim() || undefined,
      locationAddress: locationAddress.trim() || undefined,
      virtualUrl: virtualUrl.trim() || undefined,
      hostName: effectiveHostName.trim() || undefined,
      rsvpNotePrompt: rsvpNotePrompt.trim() || undefined,
      invitedNames: parseInvitedNames(invitedNamesRaw),
      hideGuestList,
      style,
    };

    setSubmitting(true);
    try {
      if (mode === 'create') {
        const res = await fetch('/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = (await res.json().catch(() => ({}))) as {
          id?: string;
          editKey?: string;
          event?: EventMeta;
          error?: string;
        };
        if (!res.ok || !data.id || !data.editKey || !data.event) {
          setErrorMsg(data.error || 'Could not create invite. Please check the details.');
          return;
        }

        if (payload.hostName) {
          saveDeviceProfile({ name: payload.hostName });
        }

        rememberHostEvent({
          id: data.id,
          title: data.event.title,
          startIso: data.event.startIso,
          timeZone: data.event.timeZone,
          locationName: data.event.locationName,
          themeId: data.event.style.themeId,
          editKey: data.editKey,
        });

        setPublishedResult({
          id: data.id,
          editKey: data.editKey,
          title: data.event.title,
          startIso: data.event.startIso,
          timeZone: data.event.timeZone,
          locationName: data.event.locationName,
          themeId: data.event.style.themeId,
        });
      } else if (eventId && editKey) {
        const res = await fetch(`/api/events/${encodeURIComponent(eventId)}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'x-edit-key': editKey,
          },
          body: JSON.stringify({
            ...payload,
            endIso: hasEndTime ? finalEndIso : null,
            locationName: locationName.trim() || null,
            locationAddress: locationAddress.trim() || null,
            virtualUrl: virtualUrl.trim() || null,
            hostName: effectiveHostName.trim() || null,
            rsvpNotePrompt: rsvpNotePrompt.trim() || null,
          }),
        });
        const updated = (await res.json().catch(() => ({}))) as EventMeta & {
          error?: string;
        };
        if (!res.ok || !updated.id) {
          setErrorMsg(updated.error || 'Could not save your changes.');
          return;
        }

        if (updated.hostName) {
          saveDeviceProfile({ name: updated.hostName });
        }

        rememberHostEvent({
          id: updated.id,
          title: updated.title,
          startIso: updated.startIso,
          timeZone: updated.timeZone,
          locationName: updated.locationName,
          themeId: updated.style.themeId,
          editKey,
        });

        setSavedNotice(true);
        onSaved?.(updated);
      }
    } catch {
      setErrorMsg('Could not reach the server. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {mode === 'create' && !hasStartedCard ? (
        <section
          data-testid="prompt-entry-card"
          className="pt-4 sm:pt-8 space-y-4"
        >
          <div
            className="rounded-3xl border shadow-2xl p-6 sm:p-8 space-y-5"
            style={{
              backgroundColor: 'var(--theme-card-solid, var(--theme-card-bg))',
              borderColor: 'var(--theme-border)',
              color: 'var(--theme-text-primary)',
            }}
          >
            <div className="space-y-1.5">
              <h1
                className="text-3xl sm:text-4xl font-bold tracking-tight"
                style={{
                  fontFamily: 'var(--font-invite-display), var(--font-invite-body), sans-serif',
                }}
              >
                What&apos;s your event?
              </h1>
              <p
                className="text-sm leading-relaxed"
                style={{ color: 'var(--theme-text-muted)' }}
              >
                Write what, when, or where — we&apos;ll start your invite for you.
              </p>
            </div>

            <div className="space-y-3">
              <label htmlFor={promptInputId} className="sr-only">
                What&apos;s your event?
              </label>
              <textarea
                id={promptInputId}
                data-testid="event-prompt-input"
                rows={3}
                autoFocus
                value={quickPrompt}
                onChange={(e) => setQuickPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.nativeEvent.isComposing || e.keyCode === 229) return;
                  if (e.key === 'Enter' && !e.shiftKey && quickPrompt.trim()) {
                    e.preventDefault();
                    handleAutofillPrompt();
                  }
                }}
                placeholder="Christmas dinner Saturday Dec 19 at 6pm at 42 Maple St"
                className="w-full rounded-2xl border px-4 py-3 text-base leading-relaxed outline-none focus:ring-2 resize-none"
                style={{
                  backgroundColor: 'var(--theme-surface-bg)',
                  borderColor: 'var(--theme-border)',
                  color: 'var(--theme-text-primary)',
                }}
              />

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  data-testid="prompt-continue-button"
                  disabled={!quickPrompt.trim()}
                  onClick={() => handleAutofillPrompt()}
                  className="invite-cta-btn flex-1 min-h-[48px] rounded-full px-5 text-sm sm:text-base font-semibold shadow-lg transition active:scale-[0.99] disabled:opacity-45 cursor-pointer"
                >
                  Continue
                </button>

                <button
                  type="button"
                  data-testid="skip-prompt-button"
                  onClick={() => {
                    setFilledNote(null);
                    setHasStartedCard(true);
                  }}
                  className="min-h-[48px] rounded-full border px-4 text-xs sm:text-sm font-medium transition hover:opacity-85 cursor-pointer"
                  style={{
                    backgroundColor: 'var(--theme-surface-bg)',
                    borderColor: 'var(--theme-border)',
                    color: 'var(--theme-text-primary)',
                  }}
                >
                  Fill in details yourself
                </button>
              </div>
            </div>

            <div
              className="pt-3 border-t space-y-2"
              style={{ borderColor: 'var(--theme-hairline)' }}
            >
              <p className="text-xs font-medium" style={{ color: 'var(--theme-text-muted)' }}>
                Try an example
              </p>
              <div className="flex flex-wrap gap-1.5">
                {EXAMPLE_EVENT_PROMPTS.slice(0, 4).map((sample) => (
                  <button
                    key={sample.label}
                    type="button"
                    onClick={() => {
                      setQuickPrompt(sample.prompt);
                      handleAutofillPrompt(sample.prompt);
                    }}
                    className="rounded-full border px-3 py-1.5 text-xs font-medium transition hover:opacity-90 cursor-pointer"
                    style={{
                      backgroundColor: 'var(--theme-surface-bg)',
                      borderColor: 'var(--theme-hairline)',
                      color: 'var(--theme-text-primary)',
                    }}
                  >
                    {sample.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Clean Top Toolbar: Prompt Backtrack + Edit Theme */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {mode === 'create' ? (
                <button
                  type="button"
                  onClick={() => setHasStartedCard(false)}
                  className="h-9 inline-flex items-center gap-1.5 rounded-full border px-3.5 text-xs font-medium backdrop-blur-md transition hover:opacity-90 cursor-pointer shrink-0"
                  style={{
                    backgroundColor: 'var(--theme-outer-pill-bg)',
                    borderColor: 'var(--theme-outer-pill-border)',
                    color: 'var(--theme-outer-text)',
                  }}
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Write prompt again</span>
                </button>
              ) : null}

              {filledNote ? (
                <span
                  className="hidden sm:inline-flex items-center gap-1 text-xs font-medium truncate"
                  style={{ color: 'var(--theme-outer-text)' }}
                >
                  <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">{filledNote}</span>
                </span>
              ) : null}
            </div>

            <button
              type="button"
              data-testid="edit-theme-button"
              onClick={() => openThemeDrawer('theme')}
              className="h-9 inline-flex items-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold backdrop-blur-md transition hover:opacity-90 cursor-pointer shrink-0 ml-auto"
              style={{
                backgroundColor: 'var(--theme-outer-pill-bg)',
                borderColor: 'var(--theme-outer-pill-border)',
                color: 'var(--theme-outer-text)',
              }}
            >
              <Palette className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Edit theme</span>
              <span className="opacity-70 hidden xs:inline">· {activePreset.name}</span>
            </button>
          </div>

          {/* Live Invitation Card */}
          <div
            className="rounded-3xl border shadow-2xl overflow-hidden"
            style={{
              backgroundColor: 'var(--theme-card-solid, var(--theme-card-bg))',
              borderColor: 'var(--theme-border)',
            }}
          >
            {style.coverLayout !== 'none' ? (
              <CoverArt
                flushTop
                coverPresetId={style.coverPresetId}
                customCoverUrl={style.customCoverUrl}
                layout={style.coverLayout === 'square' ? 'square' : 'banner'}
                title={title || 'Event cover preview'}
                accentColor={activePreset.accent}
                className="w-full"
              >
                <button
                  type="button"
                  data-testid="change-cover-button"
                  onClick={() => openThemeDrawer('cover')}
                  className="inline-flex items-center gap-1.5 rounded-full bg-slate-950/80 backdrop-blur-md border border-white/25 px-3.5 py-1.5 text-xs font-medium text-white shadow-lg hover:bg-slate-950 transition cursor-pointer"
                >
                  <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Change cover</span>
                </button>
              </CoverArt>
            ) : (
              <div className="p-4 pb-0">
                <button
                  type="button"
                  data-testid="change-cover-button"
                  onClick={() => {
                    setStyle((prev) => ({ ...prev, coverLayout: 'banner' }));
                    openThemeDrawer('cover');
                  }}
                  className="w-full rounded-2xl border border-dashed py-3.5 px-4 text-xs font-medium flex items-center justify-center gap-2 transition hover:opacity-85 cursor-pointer"
                  style={{
                    borderColor: 'var(--theme-border)',
                    color: 'var(--theme-text-muted)',
                  }}
                >
                  <ImageIcon className="h-4 w-4" aria-hidden="true" />
                  <span>Add cover photo or artwork</span>
                </button>
              </div>
            )}

            <div className="p-5 sm:p-6 space-y-4">
              {/* 1. Event Title */}
              <div className="pb-3 border-b" style={{ borderColor: 'var(--theme-hairline)' }}>
                <label htmlFor={titleId} className="sr-only">
                  Event title
                </label>
                <textarea
                  ref={titleTextareaRef}
                  id={titleId}
                  rows={1}
                  required
                  maxLength={140}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Event title"
                  className="w-full bg-transparent border-0 outline-none resize-none text-2xl sm:text-[28px] font-bold leading-tight tracking-tight placeholder:opacity-45"
                  style={{
                    color: 'var(--theme-text-primary)',
                    fontFamily: 'var(--font-invite-display), var(--font-invite-body), sans-serif',
                  }}
                />
              </div>

              {/* 2. Date & Time */}
              <div className="space-y-2.5 pb-3 border-b" style={{ borderColor: 'var(--theme-hairline)' }}>
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="inline-flex items-center gap-1.5 text-xs font-medium"
                    style={{ color: 'var(--theme-text-muted)' }}
                  >
                    <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>When</span>
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <input
                    id="event-start-date"
                    type="date"
                    required
                    aria-label="Start date"
                    value={startDate}
                    onChange={(e) => {
                      const next = e.target.value;
                      setStartDate(next);
                      setStartDstConflict(null);
                      setStartDisambiguation(undefined);
                      if (!hasEndTime) setEndDate(next);
                    }}
                    className="w-full min-w-0 appearance-none rounded-xl border px-2.5 py-2 text-sm outline-none focus:ring-2"
                    style={{
                      backgroundColor: 'var(--theme-surface-bg)',
                      borderColor: 'var(--theme-border)',
                      color: 'var(--theme-text-primary)',
                    }}
                  />
                  <input
                    id="event-start-time"
                    type="time"
                    required
                    aria-label="Start time"
                    value={startTime}
                    onChange={(e) => {
                      setStartTime(e.target.value);
                      setStartDstConflict(null);
                      setStartDisambiguation(undefined);
                    }}
                    className="w-full min-w-0 appearance-none rounded-xl border px-2.5 py-2 text-sm outline-none focus:ring-2"
                    style={{
                      backgroundColor: 'var(--theme-surface-bg)',
                      borderColor: 'var(--theme-border)',
                      color: 'var(--theme-text-primary)',
                    }}
                  />
                </div>

                {startDstConflict ? (
                  <div
                    role="alert"
                    className="rounded-xl border border-amber-400/40 bg-amber-500/10 p-2.5 space-y-2 text-xs"
                  >
                    <p>{startDstConflict.message}</p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setStartDisambiguation('earlier');
                          setStartDstConflict(null);
                        }}
                        className="rounded-lg border px-2.5 py-1 font-medium cursor-pointer"
                      >
                        Use earlier ({startDstConflict.earlierLabel})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setStartDisambiguation('later');
                          setStartDstConflict(null);
                        }}
                        className="rounded-lg border px-2.5 py-1 font-medium cursor-pointer"
                      >
                        Use later ({startDstConflict.laterLabel})
                      </button>
                    </div>
                  </div>
                ) : null}

                {hasEndTime ? (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className="inline-flex items-center gap-1.5 text-xs font-medium"
                        style={{ color: 'var(--theme-text-muted)' }}
                      >
                        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Ends</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setHasEndTime(false);
                          setEndDstConflict(null);
                        }}
                        className="text-xs opacity-75 hover:opacity-100 cursor-pointer"
                        style={{ color: 'var(--theme-text-muted)' }}
                      >
                        Remove
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        id="event-end-date"
                        type="date"
                        aria-label="End date"
                        value={endDate}
                        onChange={(e) => {
                          setEndDate(e.target.value);
                          setEndDstConflict(null);
                          setEndDisambiguation(undefined);
                        }}
                        className="w-full min-w-0 appearance-none rounded-xl border px-2.5 py-2 text-sm outline-none focus:ring-2"
                        style={{
                          backgroundColor: 'var(--theme-surface-bg)',
                          borderColor: 'var(--theme-border)',
                          color: 'var(--theme-text-primary)',
                        }}
                      />
                      <input
                        id="event-end-time"
                        type="time"
                        aria-label="End time"
                        value={endTime}
                        onChange={(e) => {
                          setEndTime(e.target.value);
                          setEndDstConflict(null);
                          setEndDisambiguation(undefined);
                        }}
                        className="w-full min-w-0 appearance-none rounded-xl border px-2.5 py-2 text-sm outline-none focus:ring-2"
                        style={{
                          backgroundColor: 'var(--theme-surface-bg)',
                          borderColor: 'var(--theme-border)',
                          color: 'var(--theme-text-primary)',
                        }}
                      />
                    </div>
                    {endDstConflict ? (
                      <div
                        role="alert"
                        className="rounded-xl border border-amber-400/40 bg-amber-500/10 p-2.5 space-y-2 text-xs"
                      >
                        <p>{endDstConflict.message}</p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEndDisambiguation('earlier');
                              setEndDstConflict(null);
                            }}
                            className="rounded-lg border px-2.5 py-1 font-medium cursor-pointer"
                          >
                            {endDstConflict.earlierLabel}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEndDisambiguation('later');
                              setEndDstConflict(null);
                            }}
                            className="rounded-lg border px-2.5 py-1 font-medium cursor-pointer"
                          >
                            {endDstConflict.laterLabel}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setHasEndTime(true);
                      setEndDate(startDate);
                    }}
                    className="text-xs font-medium opacity-80 hover:opacity-100 transition cursor-pointer"
                    style={{ color: 'var(--theme-text-muted)' }}
                  >
                    + Add end time
                  </button>
                )}
              </div>

              {/* 3. Place or Video Link + Hosted By */}
              <div className="space-y-3 pb-3 border-b" style={{ borderColor: 'var(--theme-hairline)' }}>
                {!showLocationDetails ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <MapPin
                        className="h-4 w-4 shrink-0"
                        style={{ color: 'var(--theme-text-muted)' }}
                        aria-hidden="true"
                      />
                      <input
                        id="event-location-single"
                        type="text"
                        maxLength={200}
                        value={singleLocationValue}
                        onChange={(e) => handleSingleLocationChange(e.target.value)}
                        placeholder="Add a place, address, or link"
                        aria-label="Event location or link"
                        className="flex-1 min-w-0 rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2"
                        style={{
                          backgroundColor: 'var(--theme-surface-bg)',
                          borderColor: 'var(--theme-border)',
                          color: 'var(--theme-text-primary)',
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowLocationDetails(true)}
                      className="pl-6 text-xs font-medium opacity-75 hover:opacity-100 transition cursor-pointer"
                      style={{ color: 'var(--theme-text-muted)' }}
                    >
                      + Separate venue and street address
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className="inline-flex items-center gap-1.5 text-xs font-medium"
                        style={{ color: 'var(--theme-text-muted)' }}
                      >
                        <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Where</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowLocationDetails(false)}
                        className="text-xs opacity-75 hover:opacity-100 cursor-pointer"
                        style={{ color: 'var(--theme-text-muted)' }}
                      >
                        Single field
                      </button>
                    </div>
                    <input
                      id="event-location-name"
                      type="text"
                      maxLength={140}
                      value={locationName}
                      onChange={(e) => setLocationName(e.target.value)}
                      placeholder="Place name"
                      className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2"
                      style={{
                        backgroundColor: 'var(--theme-surface-bg)',
                        borderColor: 'var(--theme-border)',
                        color: 'var(--theme-text-primary)',
                      }}
                    />
                    <input
                      id="event-location-address"
                      type="text"
                      maxLength={240}
                      value={locationAddress}
                      onChange={(e) => setLocationAddress(e.target.value)}
                      placeholder="Street address, city, state"
                      className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2"
                      style={{
                        backgroundColor: 'var(--theme-surface-bg)',
                        borderColor: 'var(--theme-border)',
                        color: 'var(--theme-text-primary)',
                      }}
                    />
                    <input
                      id="event-virtual-url"
                      type="url"
                      maxLength={400}
                      value={virtualUrl}
                      onChange={(e) => setVirtualUrl(e.target.value)}
                      placeholder="Video call link https://... (optional)"
                      className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2"
                      style={{
                        backgroundColor: 'var(--theme-surface-bg)',
                        borderColor: 'var(--theme-border)',
                        color: 'var(--theme-text-primary)',
                      }}
                    />
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <User
                    className="h-4 w-4 shrink-0"
                    style={{ color: 'var(--theme-text-muted)' }}
                    aria-hidden="true"
                  />
                  <input
                    id="event-host-name"
                    type="text"
                    maxLength={80}
                    aria-label="Hosted by"
                    value={effectiveHostName}
                    onChange={(e) => {
                      setHostTouched(true);
                      setHostName(e.target.value);
                    }}
                    placeholder="Hosted by (your name)"
                    className="flex-1 min-w-0 rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2"
                    style={{
                      backgroundColor: 'var(--theme-surface-bg)',
                      borderColor: 'var(--theme-border)',
                      color: 'var(--theme-text-primary)',
                    }}
                  />
                </div>
              </div>

              {/* 4. Details */}
              <RichTextEditor
                label=""
                placeholder="Add details, what food or drinks to bring, parking..."
                value={descriptionHtml}
                onChange={setDescriptionHtml}
              />
            </div>
          </div>

          {/* Closed-By-Default Guest & Time Zone Options */}
          <details
            className="group rounded-3xl border shadow-lg overflow-hidden"
            style={{
              backgroundColor: 'var(--theme-card-solid, var(--theme-card-bg))',
              borderColor: 'var(--theme-hairline)',
            }}
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-5 py-3.5 text-xs sm:text-sm font-medium">
              <span>More options</span>
              <ChevronDown
                className="h-4 w-4 opacity-70 transition-transform group-open:rotate-180"
                aria-hidden="true"
              />
            </summary>

            <div
              className="border-t p-5 space-y-3.5"
              style={{ borderColor: 'var(--theme-hairline)' }}
            >
              <div>
                <label
                  htmlFor="event-rsvp-prompt"
                  className="block text-xs font-medium mb-1"
                  style={{ color: 'var(--theme-text-muted)' }}
                >
                  Question on the RSVP form
                </label>
                <input
                  id="event-rsvp-prompt"
                  type="text"
                  maxLength={140}
                  value={rsvpNotePrompt}
                  onChange={(e) => setRsvpNotePrompt(e.target.value)}
                  placeholder="Bringing food, a dish, or a note?"
                  className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2"
                  style={{
                    backgroundColor: 'var(--theme-surface-bg)',
                    borderColor: 'var(--theme-border)',
                    color: 'var(--theme-text-primary)',
                  }}
                />
              </div>

              <div>
                <label
                  htmlFor="event-invited-names"
                  className="block text-xs font-medium mb-1"
                  style={{ color: 'var(--theme-text-muted)' }}
                >
                  Invited guests (optional, separated by commas)
                </label>
                <input
                  id="event-invited-names"
                  type="text"
                  maxLength={1200}
                  value={invitedNamesRaw}
                  onChange={(e) => setInvitedNamesRaw(e.target.value)}
                  placeholder="Alex, Jordan, Sam"
                  className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2"
                  style={{
                    backgroundColor: 'var(--theme-surface-bg)',
                    borderColor: 'var(--theme-border)',
                    color: 'var(--theme-text-primary)',
                  }}
                />
              </div>

              <div>
                <label
                  htmlFor="event-timezone"
                  className="flex items-center gap-1.5 text-xs font-medium mb-1"
                  style={{ color: 'var(--theme-text-muted)' }}
                >
                  <Globe className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Time zone</span>
                </label>
                <select
                  id="event-timezone"
                  aria-label="Event time zone"
                  value={timeZone}
                  onChange={(e) => {
                    setTimeZone(e.target.value);
                    setStartDstConflict(null);
                    setStartDisambiguation(undefined);
                    setEndDstConflict(null);
                    setEndDisambiguation(undefined);
                  }}
                  className="w-full rounded-xl border px-3 py-2 text-sm outline-none cursor-pointer"
                  style={{
                    backgroundColor: 'var(--theme-surface-bg)',
                    borderColor: 'var(--theme-border)',
                    color: 'var(--theme-text-primary)',
                  }}
                >
                  {timeZones.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </div>

              <label className="flex items-center gap-2.5 text-xs sm:text-sm cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={hideGuestList}
                  onChange={(e) => setHideGuestList(e.target.checked)}
                  className="rounded border"
                />
                <span className="inline-flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />
                  <span>Keep guest list private (only you see names)</span>
                </span>
              </label>
            </div>
          </details>

          {errorMsg ? (
            <p role="alert" className="text-xs sm:text-sm font-medium text-rose-400 px-1">
              {errorMsg}
            </p>
          ) : null}

          {savedNotice && eventId ? (
            <div
              className="rounded-2xl border px-4 py-3 text-xs sm:text-sm flex items-center justify-between gap-2"
              style={{
                backgroundColor: 'var(--theme-card-solid, var(--theme-card-bg))',
                borderColor: 'var(--theme-accent)',
              }}
            >
              <span className="inline-flex items-center gap-1.5 font-medium">
                <Check className="h-4 w-4" style={{ color: 'var(--theme-accent)' }} aria-hidden="true" />
                <span>Saved</span>
              </span>
              <Link
                href={`/e/${eventId}`}
                className="inline-flex items-center gap-1 font-medium underline underline-offset-2"
              >
                <span>View invite</span>
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="invite-cta-btn w-full min-h-[50px] rounded-full py-3.5 px-5 text-sm sm:text-base font-semibold transition active:scale-[0.99] disabled:opacity-60 cursor-pointer shadow-xl"
          >
            {submitting
              ? mode === 'create'
                ? 'Creating invite...'
                : 'Saving...'
              : mode === 'create'
                ? 'Create invite'
                : 'Save changes'}
          </button>
        </form>
      )}

      <StyleStudioDrawer
        open={themeDrawerOpen}
        initialTab={themeDrawerTab}
        onClose={() => setThemeDrawerOpen(false)}
        style={style}
        onChange={setStyle}
        eventId={eventId}
        editKey={editKey}
      />

      <PublishSuccessDialog
        published={publishedResult}
        onClose={() => setPublishedResult(null)}
      />
    </>
  );
}
