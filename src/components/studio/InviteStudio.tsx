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
  Sliders,
  Sparkles,
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
import {
  CTA_PRESETS,
  THEME_PRESETS,
  getThemePreset,
  type ThemePreset,
} from '@/lib/themes/presets';
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
import { StyleStudioDrawer } from './StyleStudioDrawer';

interface InviteStudioProps {
  mode: 'create' | 'edit';
  initialDraft?: ParsedEventDraft | null;
  initialEvent?: EventMeta;
  eventId?: string;
  editKey?: string;
  onSaved?: (updated: EventMeta) => void;
  onStyleChange?: (style: InviteStyleConfig) => void;
}

const QUICK_THEME_IDS = [
  'winter-snowfall',
  'cozy-christmas',
  'sacred-nativity',
  'candlelit-dinner',
  'birthday-confetti',
  'warm-thanksgiving',
  'spring-easter-garden',
  'aurora-midnight',
  'minimal-paper',
] as const;

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
  const deviceProfile = useSyncExternalStore(
    subscribeDeviceProfile,
    getDeviceProfile,
    getDeviceProfileServerSnapshot,
  );

  const initialSource = initialEvent ?? initialDraft;
  const initialStyle: InviteStyleConfig = initialSource?.style ?? getDefaultStyle();

  const [showAutoFill, setShowAutoFill] = useState<boolean>(false);
  const [quickPrompt, setQuickPrompt] = useState<string>('');
  const [autofillNote, setAutofillNote] = useState<string | null>(null);

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
  const [showLocationDetails, setShowLocationDetails] = useState<boolean>(
    Boolean(
      initialSource?.locationAddress?.trim() ||
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
  const [showCoverPicker, setShowCoverPicker] = useState<boolean>(false);
  const [showCustomize, setShowCustomize] = useState<boolean>(false);

  const [startDstConflict, setStartDstConflict] = useState<DstConflictInfo | null>(null);
  const [startDisambiguation, setStartDisambiguation] = useState<'earlier' | 'later' | undefined>();
  const [endDstConflict, setEndDstConflict] = useState<DstConflictInfo | null>(null);
  const [endDisambiguation, setEndDisambiguation] = useState<'earlier' | 'later' | undefined>();

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<boolean>(false);
  const [publishedResult, setPublishedResult] = useState<PublishedEventResult | null>(null);

  const titleTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync live style up to client page wrapper
  useEffect(() => {
    onStyleChange?.(style);
  }, [style, onStyleChange]);

  // Pre-fill browser timezone & ISO local fields accurately using Temporal
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

  // Auto-size title textarea when content wraps
  useEffect(() => {
    const el = titleTextareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(el.scrollHeight, 36)}px`;
  }, [title]);

  const timeZones = useMemo(() => getSupportedTimeZones(timeZone), [timeZone]);
  const activePreset = getThemePreset(style.themeId);
  const quickThemes = useMemo(
    () =>
      QUICK_THEME_IDS.map((id) => THEME_PRESETS.find((t) => t.id === id)).filter(
        (t): t is ThemePreset => Boolean(t),
      ),
    [],
  );

  function applyQuickTheme(preset: ThemePreset) {
    setStyle((prev) => ({
      ...prev,
      themeId: preset.id,
      fontId: preset.defaultFontId,
      effectId: preset.defaultEffectId,
      coverPresetId: prev.customCoverUrl ? prev.coverPresetId : preset.defaultCoverPresetId,
      coverLayout: prev.coverLayout === 'none' ? 'banner' : prev.coverLayout,
      colorMode: preset.colorMode,
      customAccentHex: undefined,
      customCtaEndHex: undefined,
      ctaStyle: undefined,
      customSurfaceHex: undefined,
    }));
  }

  function handleAutofillPrompt(rawInput?: string) {
    const sourcePrompt = (rawInput ?? quickPrompt).trim();
    if (!sourcePrompt) return;

    const parsed = parseEventPrompt(
      sourcePrompt,
      new Date(),
      timeZone || getBrowserTimeZone(),
    );
    setTitle(parsed.title);
    if (parsed.timeZone) setTimeZone(parsed.timeZone);
    if (parsed.locationName !== undefined) setLocationName(parsed.locationName);
    if (parsed.locationAddress !== undefined) setLocationAddress(parsed.locationAddress);
    if (parsed.virtualUrl !== undefined) setVirtualUrl(parsed.virtualUrl);
    if (parsed.locationAddress || (parsed.locationName && parsed.virtualUrl)) {
      setShowLocationDetails(true);
    }
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

    setShowAutoFill(false);
    setAutofillNote(`Autofilled (${parsed.detectedOccasionLabel})`);
    setErrorMsg(null);
  }

  const singleLocationValue =
    !showLocationDetails && virtualUrl && !locationName ? virtualUrl : locationName;

  function handleSingleLocationChange(val: string) {
    const trimmed = val.trim();
    if (/^https?:\/\//i.test(trimmed)) {
      setVirtualUrl(val);
      setLocationName('');
    } else {
      setLocationName(val);
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
      setErrorMsg('Please enter an event name.');
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
      setErrorMsg(startRes.error || 'Invalid start date or time.');
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
        setErrorMsg(endRes.error || 'Invalid end date or time.');
        return;
      }
      if (new Date(endRes.iso).getTime() < new Date(startRes.iso).getTime()) {
        setErrorMsg('End time must be after start time.');
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
          setErrorMsg(data.error || 'Could not create invite. Please check required fields.');
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
          setErrorMsg(updated.error || 'Could not save event updates.');
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
      setErrorMsg('Network error saving invite. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const isThemeMatchActive =
    !style.customAccentHex && !style.customCtaEndHex && !style.ctaStyle;

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-3.5">
        {/* Top 1-Row Vibe & Optional Autofill Pill Bar */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {mode === 'create' ? (
              <button
                type="button"
                aria-expanded={showAutoFill}
                onClick={() => setShowAutoFill((prev) => !prev)}
                className="shrink-0 h-8 inline-flex items-center gap-1.5 rounded-full border px-3 text-xs font-semibold backdrop-blur-md transition cursor-pointer"
                style={{
                  backgroundColor: showAutoFill
                    ? 'var(--theme-card-solid)'
                    : 'var(--theme-outer-pill-bg)',
                  borderColor: showAutoFill
                    ? 'var(--theme-accent)'
                    : 'var(--theme-outer-pill-border)',
                  color: showAutoFill
                    ? 'var(--theme-text-primary)'
                    : 'var(--theme-outer-text)',
                }}
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Auto-fill</span>
              </button>
            ) : null}

            {quickThemes.map((preset) => {
              const selected = style.themeId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => applyQuickTheme(preset)}
                  className="shrink-0 h-8 inline-flex items-center gap-1 rounded-full border px-3 text-xs font-medium backdrop-blur-md transition cursor-pointer"
                  style={
                    selected
                      ? {
                          backgroundColor: 'var(--theme-card-solid)',
                          borderColor: 'var(--theme-accent)',
                          color: 'var(--theme-text-primary)',
                        }
                      : {
                          backgroundColor: 'var(--theme-outer-pill-bg)',
                          borderColor: 'var(--theme-outer-pill-border)',
                          color: 'var(--theme-outer-text)',
                        }
                  }
                >
                  <span aria-hidden="true">{preset.emoji}</span>
                  <span>{preset.name.split(' ')[0]}</span>
                </button>
              );
            })}
          </div>

          {mode === 'create' && showAutoFill ? (
            <div
              className="rounded-2xl border p-3 shadow-lg space-y-2.5"
              style={{
                backgroundColor: 'var(--theme-card-solid, var(--theme-card-bg))',
                borderColor: 'var(--theme-border)',
                color: 'var(--theme-text-primary)',
              }}
            >
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  aria-label="Describe your event to autofill"
                  value={quickPrompt}
                  onChange={(e) => setQuickPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAutofillPrompt();
                    }
                  }}
                  placeholder="Describe it: Christmas brunch Dec 5 at 9:30am..."
                  className="flex-1 min-w-0 rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2"
                  style={{
                    backgroundColor: 'var(--theme-surface-bg)',
                    borderColor: 'var(--theme-border)',
                    color: 'var(--theme-text-primary)',
                  }}
                />
                <button
                  type="button"
                  disabled={!quickPrompt.trim()}
                  onClick={() => handleAutofillPrompt()}
                  className="invite-cta-btn shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition disabled:opacity-45 cursor-pointer"
                >
                  Fill
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {EXAMPLE_EVENT_PROMPTS.slice(0, 4).map((sample) => (
                  <button
                    key={sample.label}
                    type="button"
                    onClick={() => {
                      setQuickPrompt(sample.prompt);
                      handleAutofillPrompt(sample.prompt);
                    }}
                    className="rounded-full border px-2.5 py-1 text-xs transition hover:opacity-85 cursor-pointer"
                    style={{
                      backgroundColor: 'var(--theme-surface-bg)',
                      borderColor: 'var(--theme-hairline)',
                      color: 'var(--theme-text-muted)',
                    }}
                  >
                    {sample.emoji} {sample.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {autofillNote ? (
            <p
              className="flex items-center gap-1.5 text-xs px-1 font-medium"
              style={{ color: 'var(--theme-outer-text)' }}
            >
              <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{autofillNote} · Edit anything below</span>
            </p>
          ) : null}
        </div>

        {/* Live Editorial Invitation Card Composer */}
        <div
          className="rounded-3xl border shadow-2xl overflow-hidden"
          style={{
            backgroundColor: 'var(--theme-card-solid, var(--theme-card-bg))',
            borderColor: 'var(--theme-border)',
          }}
        >
          {/* Flush Top Cover Art + Overlay Change Cover Button */}
          {style.coverLayout !== 'none' ? (
            <CoverArt
              flushTop
              coverPresetId={style.coverPresetId}
              customCoverUrl={style.customCoverUrl}
              layout={style.coverLayout === 'square' ? 'square' : 'banner'}
              title={title || 'Event cover preview'}
              className="w-full"
            >
              <button
                type="button"
                aria-expanded={showCoverPicker}
                onClick={() => setShowCoverPicker((prev) => !prev)}
                className="inline-flex items-center gap-1.5 rounded-full bg-slate-950/80 backdrop-blur-md border border-white/25 px-3 py-1.5 text-xs font-medium text-white shadow-lg hover:bg-slate-950 transition cursor-pointer"
              >
                <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{showCoverPicker ? 'Done' : 'Change Cover'}</span>
              </button>
            </CoverArt>
          ) : (
            <div className="p-4 pb-0">
              <button
                type="button"
                onClick={() => {
                  setStyle((prev) => ({ ...prev, coverLayout: 'banner' }));
                  setShowCoverPicker(true);
                }}
                className="w-full rounded-2xl border border-dashed py-3.5 px-4 text-xs font-medium flex items-center justify-center gap-2 transition hover:opacity-85 cursor-pointer"
                style={{
                  borderColor: 'var(--theme-border)',
                  color: 'var(--theme-text-muted)',
                }}
              >
                <ImageIcon className="h-4 w-4" aria-hidden="true" />
                <span>Add Cover Art</span>
              </button>
            </div>
          )}

          {/* Inline Cover Art Picker Drawer (inside card below cover when opened) */}
          {showCoverPicker ? (
            <div
              className="p-4 border-b"
              style={{ borderColor: 'var(--theme-hairline)' }}
            >
              <StyleStudioDrawer
                section="covers"
                style={style}
                onChange={setStyle}
                eventId={eventId}
                editKey={editKey}
              />
            </div>
          ) : null}

          <div className="p-5 sm:p-6 space-y-4">
            {/* 1. Event Title */}
            <div className="pb-3 border-b" style={{ borderColor: 'var(--theme-hairline)' }}>
              <label htmlFor={titleId} className="sr-only">
                Event Name
              </label>
              <textarea
                ref={titleTextareaRef}
                id={titleId}
                rows={1}
                required
                maxLength={140}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Event Title"
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
                  <span>Date &amp; Time</span>
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

            {/* 3. Smart Location or Link + Hosted By */}
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
                      placeholder="Add address, venue, or link"
                      aria-label="Event location or virtual link"
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
                    + Street address or separate video link
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
                      <span>Location</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowLocationDetails(false)}
                      className="text-xs opacity-75 hover:opacity-100 cursor-pointer"
                      style={{ color: 'var(--theme-text-muted)' }}
                    >
                      Simplify
                    </button>
                  </div>
                  <input
                    id="event-location-name"
                    type="text"
                    maxLength={140}
                    value={locationName}
                    onChange={(e) => setLocationName(e.target.value)}
                    placeholder="Venue or place name"
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
                    placeholder="Virtual link https://... (optional)"
                    className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2"
                    style={{
                      backgroundColor: 'var(--theme-surface-bg)',
                      borderColor: 'var(--theme-border)',
                      color: 'var(--theme-text-primary)',
                    }}
                  />
                </div>
              )}

              {/* Hosted By */}
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

            {/* 4. Rich Description */}
            <RichTextEditor
              label=""
              placeholder="Add event details, what food or gifts to bring, parking..."
              value={descriptionHtml}
              onChange={setDescriptionHtml}
            />
          </div>
        </div>

        {/* Button Color / Gradient Customizer + Style Controls */}
        <section
          className="rounded-3xl border shadow-xl p-4 sm:p-5 space-y-3"
          style={{
            backgroundColor: 'var(--theme-card-solid, var(--theme-card-bg))',
            borderColor: 'var(--theme-border)',
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <span
              className="inline-flex items-center gap-1.5 text-xs font-semibold"
              style={{ color: 'var(--theme-text-primary)' }}
            >
              <Palette className="h-3.5 w-3.5" style={{ color: 'var(--theme-accent)' }} aria-hidden="true" />
              <span>Button Style</span>
            </span>

            <button
              type="button"
              aria-expanded={showCustomize}
              onClick={() => setShowCustomize((prev) => !prev)}
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition hover:opacity-90 cursor-pointer"
              style={{
                backgroundColor: 'var(--theme-surface-bg)',
                borderColor: 'var(--theme-hairline)',
                color: 'var(--theme-text-primary)',
              }}
            >
              <Sliders className="h-3 w-3" style={{ color: 'var(--theme-accent)' }} aria-hidden="true" />
              <span>Customize Style</span>
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${showCustomize ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
            </button>
          </div>

          {/* 1-Row Quick Button Gradient Swatch Picker */}
          <div className="flex items-center gap-2 overflow-x-auto py-1">
            <button
              type="button"
              aria-label="Match invite theme button gradient"
              aria-pressed={isThemeMatchActive}
              onClick={() =>
                setStyle((prev) => ({
                  ...prev,
                  customAccentHex: undefined,
                  customCtaEndHex: undefined,
                  ctaStyle: undefined,
                }))
              }
              className={`shrink-0 h-8 rounded-full border px-3 text-[11px] font-semibold inline-flex items-center gap-1.5 transition cursor-pointer ${
                isThemeMatchActive ? 'ring-2 ring-sky-400' : 'opacity-85 hover:opacity-100'
              }`}
              style={{
                backgroundColor: 'var(--theme-surface-bg)',
                borderColor: isThemeMatchActive
                  ? 'var(--theme-accent)'
                  : 'var(--theme-hairline)',
                color: 'var(--theme-text-primary)',
              }}
            >
              <span
                aria-hidden="true"
                className="h-3.5 w-3.5 rounded-full"
                style={{
                  background: `linear-gradient(135deg, ${activePreset.ctaStart} 0%, ${activePreset.ctaEnd} 100%)`,
                }}
              />
              <span>Theme Match</span>
            </button>

            {CTA_PRESETS.map((swatch) => {
              const selected =
                style.customAccentHex?.toLowerCase() === swatch.startHex.toLowerCase() &&
                (swatch.mode === 'solid'
                  ? style.ctaStyle === 'solid'
                  : style.customCtaEndHex?.toLowerCase() === swatch.endHex.toLowerCase());
              return (
                <button
                  key={swatch.id}
                  type="button"
                  aria-label={`Use ${swatch.name} button gradient`}
                  aria-pressed={selected}
                  title={swatch.name}
                  onClick={() =>
                    setStyle((prev) => ({
                      ...prev,
                      ctaStyle: swatch.mode,
                      customAccentHex: swatch.startHex,
                      customCtaEndHex: swatch.endHex,
                    }))
                  }
                  className={`shrink-0 h-8 w-8 rounded-full border-2 transition cursor-pointer ${
                    selected ? 'scale-110 ring-2 ring-offset-1 ring-sky-400 border-white' : 'border-black/15'
                  }`}
                  style={{
                    background:
                      swatch.mode === 'solid'
                        ? swatch.startHex
                        : `linear-gradient(135deg, ${swatch.startHex} 0%, ${swatch.endHex} 100%)`,
                  }}
                />
              );
            })}
          </div>

          {showCustomize ? (
            <div className="pt-2 border-t" style={{ borderColor: 'var(--theme-hairline)' }}>
              <StyleStudioDrawer
                section="customize"
                style={style}
                onChange={setStyle}
                eventId={eventId}
                editKey={editKey}
              />
            </div>
          ) : null}
        </section>

        {/* Closed-By-Default Guest & RSVP Options */}
        <details
          className="group rounded-3xl border shadow-lg overflow-hidden"
          style={{
            backgroundColor: 'var(--theme-card-solid, var(--theme-card-bg))',
            borderColor: 'var(--theme-hairline)',
          }}
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-5 py-3.5 text-xs sm:text-sm font-medium">
            <span>More options (RSVP question, guest list, time zone)</span>
            <ChevronDown
              className="h-4 w-4 opacity-70 transition-transform group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>

          <div
            className="border-t p-5 space-y-3"
            style={{ borderColor: 'var(--theme-hairline)' }}
          >
            <div>
              <label
                htmlFor="event-rsvp-prompt"
                className="block text-xs font-medium mb-1"
                style={{ color: 'var(--theme-text-muted)' }}
              >
                RSVP note question
              </label>
              <input
                id="event-rsvp-prompt"
                type="text"
                maxLength={140}
                value={rsvpNotePrompt}
                onChange={(e) => setRsvpNotePrompt(e.target.value)}
                placeholder="What food, dish, or gift are you bringing?"
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
                Invited guest names (comma-separated, optional)
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
                <span>Hide guest list from guests</span>
              </span>
            </label>
          </div>
        </details>

        {errorMsg ? (
          <p role="alert" className="text-xs sm:text-sm font-medium text-rose-300 px-1">
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
              <span>View Invite</span>
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        ) : null}

        {/* Full-Width Live CTA Button Reflecting Custom Gradient / Color */}
        <button
          type="submit"
          disabled={submitting}
          className="invite-cta-btn w-full min-h-[50px] rounded-full py-3.5 px-5 text-sm sm:text-base font-semibold transition active:scale-[0.99] disabled:opacity-60 cursor-pointer shadow-xl"
        >
          {submitting
            ? mode === 'create'
              ? 'Creating Invite...'
              : 'Saving...'
            : mode === 'create'
              ? 'Create Invite'
              : 'Save Changes'}
        </button>
      </form>

      <PublishSuccessDialog
        published={publishedResult}
        onClose={() => setPublishedResult(null)}
      />
    </>
  );
}
