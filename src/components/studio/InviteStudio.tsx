'use client';

import React, { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Calendar, Check, ChevronDown, Clock, Globe, Image as ImageIcon, Lock, MapPin, Palette, User } from 'lucide-react';
import { CoverArt } from '@/components/covers/CoverArt';
import { RichTextEditor } from '@/components/editor/RichTextEditor';
import {
  getDeviceProfile,
  getDeviceProfileServerSnapshot,
  saveDeviceProfile,
  subscribeDeviceProfile,
} from '@/lib/client/deviceProfile';
import { rememberHostEvent } from '@/lib/client/recentEvents';
import { type ParsedEventDraft } from '@/lib/nlp/parseEventPrompt';
import { stripHtmlToText } from '@/lib/sanitize';
import { getThemePreset } from '@/lib/themes/presets';
import type { EventMeta, InviteStyleConfig } from '@/types/invite';
import {
  getBrowserTimeZone,
  getSupportedTimeZones,
  isoToLocalFields,
  normalizeDateInput,
  normalizeTimeInput,
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
  skipSavedDraft?: boolean;
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

const CREATE_DRAFT_KEY = 'invited_create_draft_v1';

interface StoredStudioDraft {
  title: string;
  startDate: string;
  startTime: string;
  hasEndTime: boolean;
  endDate: string;
  endTime: string;
  timeZone: string;
  locationName: string;
  locationAddress: string;
  virtualUrl: string;
  hostName: string;
  descriptionHtml: string;
  rsvpNotePrompt: string;
  hideGuestList: boolean;
  style: InviteStyleConfig;
}

export function InviteStudio({
  mode,
  initialDraft,
  skipSavedDraft = false,
  initialEvent,
  eventId,
  editKey,
  onSaved,
  onStyleChange,
}: InviteStudioProps) {
  const titleId = useId();
  const notifyGuestsId = useId();
  const deviceProfile = useSyncExternalStore(
    subscribeDeviceProfile,
    getDeviceProfile,
    getDeviceProfileServerSnapshot,
  );

  const initialSource = initialEvent ?? initialDraft;
  const initialStyle: InviteStyleConfig = initialSource?.style ?? getDefaultStyle();
  const hasExplicitInitialDate = Boolean(
    initialEvent?.startIso ||
      (initialDraft?.startIso && initialDraft.hasExplicitDate !== false),
  );
  const hasExplicitInitialTime = Boolean(
    initialEvent?.startIso ||
      (initialDraft?.startIso && initialDraft.hasExplicitTime !== false),
  );

  const [title, setTitle] = useState<string>(initialSource?.title ?? '');
  const [startDate, setStartDate] = useState<string>(() => {
    if (!hasExplicitInitialDate) return '';
    return initialSource?.startIso?.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ?? '';
  });
  const [startTime, setStartTime] = useState<string>(() => {
    if (!hasExplicitInitialTime) return '';
    return initialSource?.startIso?.match(/T(\d{2}:\d{2})/)?.[1] ?? '';
  });
  const [hasEndTime, setHasEndTime] = useState<boolean>(
    Boolean(initialSource?.endIso),
  );
  const [endDate, setEndDate] = useState<string>(() => {
    if (!initialSource?.endIso) return '';
    return initialSource.endIso.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ?? '';
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
  const [notifyGuestsOverride, setNotifyGuestsOverride] = useState<boolean | null>(null);
  const [initialDateBaseline, setInitialDateBaseline] = useState<{
    startDate: string;
    startTime: string;
    endDate: string;
    endTime: string;
  }>(() => ({
    startDate: initialEvent?.startIso?.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] || '',
    startTime: initialEvent?.startIso?.match(/T(\d{2}:\d{2})/)?.[1] || '18:00',
    endDate: initialEvent?.endIso?.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] || '',
    endTime: initialEvent?.endIso?.match(/T(\d{2}:\d{2})/)?.[1] || '21:00',
  }));

  const titleTextareaRef = useRef<HTMLTextAreaElement>(null);
  const draftHydratedRef = useRef<boolean>(false);

  const hasUnsavedDraftContent =
    mode === 'create' &&
    Boolean(
      title.trim() ||
        locationName.trim() ||
        locationAddress.trim() ||
        virtualUrl.trim() ||
        stripHtmlToText(descriptionHtml).trim(),
    );

  // Hydrate saved draft once in create mode when no explicit initialDraft was supplied
  useEffect(() => {
    if (mode !== 'create' || initialDraft || skipSavedDraft) {
      if (skipSavedDraft) {
        try {
          window.localStorage.removeItem(CREATE_DRAFT_KEY);
        } catch {
          // Ignore storage access errors
        }
      }
      draftHydratedRef.current = true;
      return;
    }
    queueMicrotask(() => {
      try {
        const raw = window.localStorage.getItem(CREATE_DRAFT_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<StoredStudioDraft>;
          if (parsed && typeof parsed === 'object') {
            if (typeof parsed.title === 'string') setTitle(parsed.title);
            if (typeof parsed.startDate === 'string' && parsed.startDate) setStartDate(parsed.startDate);
            if (typeof parsed.startTime === 'string' && parsed.startTime) setStartTime(parsed.startTime);
            if (typeof parsed.hasEndTime === 'boolean') setHasEndTime(parsed.hasEndTime);
            if (typeof parsed.endDate === 'string' && parsed.endDate) setEndDate(parsed.endDate);
            if (typeof parsed.endTime === 'string' && parsed.endTime) setEndTime(parsed.endTime);
            if (typeof parsed.timeZone === 'string' && parsed.timeZone) setTimeZone(parsed.timeZone);
            if (typeof parsed.locationName === 'string') setLocationName(parsed.locationName);
            if (typeof parsed.locationAddress === 'string') setLocationAddress(parsed.locationAddress);
            if (typeof parsed.virtualUrl === 'string') setVirtualUrl(parsed.virtualUrl);
            if (typeof parsed.hostName === 'string' && parsed.hostName) {
              setHostTouched(true);
              setHostName(parsed.hostName);
            }
            if (typeof parsed.descriptionHtml === 'string') setDescriptionHtml(parsed.descriptionHtml);
            if (typeof parsed.rsvpNotePrompt === 'string') setRsvpNotePrompt(parsed.rsvpNotePrompt);
            if (typeof parsed.hideGuestList === 'boolean') setHideGuestList(parsed.hideGuestList);
            if (parsed.style && typeof parsed.style === 'object') setStyle(parsed.style);
          }
        }
      } catch {
        // Ignore storage read errors
      } finally {
        draftHydratedRef.current = true;
      }
    });
  }, [mode, initialDraft, skipSavedDraft]);

  // Auto-persist create draft so partial invites survive refresh and show Draft indicator
  useEffect(() => {
    if (mode !== 'create' || !draftHydratedRef.current) return;
    try {
      if (!hasUnsavedDraftContent) {
        window.localStorage.removeItem(CREATE_DRAFT_KEY);
        return;
      }
      const snapshot: StoredStudioDraft = {
        title,
        startDate,
        startTime,
        hasEndTime,
        endDate,
        endTime,
        timeZone,
        locationName,
        locationAddress,
        virtualUrl,
        hostName: effectiveHostName,
        descriptionHtml,
        rsvpNotePrompt,
        hideGuestList,
        style,
      };
      window.localStorage.setItem(CREATE_DRAFT_KEY, JSON.stringify(snapshot));
    } catch {
      // Ignore storage quota errors
    }
  }, [
    mode,
    hasUnsavedDraftContent,
    title,
    startDate,
    startTime,
    hasEndTime,
    endDate,
    endTime,
    timeZone,
    locationName,
    locationAddress,
    virtualUrl,
    effectiveHostName,
    descriptionHtml,
    rsvpNotePrompt,
    hideGuestList,
    style,
  ]);

  function clearCreateDraft() {
    setTitle('');
    setStartDate('');
    setStartTime('');
    setHasEndTime(false);
    setEndDate('');
    setEndTime('21:00');
    setLocationName('');
    setLocationAddress('');
    setVirtualUrl('');
    setShowLocationDetails(false);
    setDescriptionHtml('');
    setRsvpNotePrompt('');
    setHideGuestList(false);
    setStyle(getDefaultStyle());
    try {
      window.localStorage.removeItem(CREATE_DRAFT_KEY);
    } catch {
      // Ignore storage errors
    }
  }

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
    if (initialSource?.startIso && (hasExplicitInitialDate || hasExplicitInitialTime)) {
      const tz = initialSource.timeZone || getBrowserTimeZone();
      void isoToLocalFields(initialSource.startIso, tz).then(({ date, time }) => {
        if (active && hasExplicitInitialDate && date) setStartDate(date);
        if (active && hasExplicitInitialTime && time) setStartTime(time);
        if (active && initialEvent) {
          setInitialDateBaseline((prev) => ({
            ...prev,
            startDate: date || prev.startDate,
            startTime: time || prev.startTime,
          }));
        }
      });
    }
    if (initialSource?.endIso) {
      const tz = initialSource.timeZone || getBrowserTimeZone();
      void isoToLocalFields(initialSource.endIso, tz).then(({ date, time }) => {
        if (active && date) setEndDate(date);
        if (active && time) setEndTime(time);
        if (active && initialEvent) {
          setInitialDateBaseline((prev) => ({
            ...prev,
            endDate: date || prev.endDate,
            endTime: time || prev.endTime,
          }));
        }
      });
    }
    return () => {
      active = false;
    };
  }, [hasExplicitInitialDate, hasExplicitInitialTime, initialEvent, initialSource?.endIso, initialSource?.startIso, initialSource?.timeZone]);

  useEffect(() => {
    const el = titleTextareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(el.scrollHeight, 36)}px`;
  }, [title]);

  const timeZones = useMemo(() => getSupportedTimeZones(timeZone), [timeZone]);
  const activePreset = getThemePreset(style.themeId);

  const hasMaterialDetailChanges = useMemo(() => {
    if (mode !== 'edit' || !initialEvent) return false;
    const normalizedDesc = stripHtmlToText(descriptionHtml).replace(/\s+/g, ' ').trim();
    const initialDesc = stripHtmlToText(initialEvent.descriptionHtml ?? '')
      .replace(/\s+/g, ' ')
      .trim();
    const initialHasEnd = Boolean(initialEvent.endIso);

    return (
      title.trim() !== initialEvent.title.trim() ||
      normalizeDateInput(startDate) !== normalizeDateInput(initialDateBaseline.startDate) ||
      normalizeTimeInput(startTime) !== normalizeTimeInput(initialDateBaseline.startTime) ||
      hasEndTime !== initialHasEnd ||
      (hasEndTime &&
        (normalizeDateInput(endDate) !== normalizeDateInput(initialDateBaseline.endDate) ||
          normalizeTimeInput(endTime) !== normalizeTimeInput(initialDateBaseline.endTime))) ||
      timeZone !== initialEvent.timeZone ||
      locationName.trim() !== (initialEvent.locationName ?? '').trim() ||
      locationAddress.trim() !== (initialEvent.locationAddress ?? '').trim() ||
      virtualUrl.trim() !== (initialEvent.virtualUrl ?? '').trim() ||
      normalizedDesc !== initialDesc
    );
  }, [
    mode,
    initialEvent,
    title,
    startDate,
    startTime,
    hasEndTime,
    endDate,
    endTime,
    timeZone,
    locationName,
    locationAddress,
    virtualUrl,
    descriptionHtml,
    initialDateBaseline,
  ]);

  const effectiveNotifyGuests = notifyGuestsOverride ?? hasMaterialDetailChanges;

  function openThemeDrawer(tab: StudioDrawerTab) {
    setThemeDrawerTab(tab);
    setThemeDrawerOpen(true);
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
      invitedNames: initialEvent?.invitedNames ?? [],
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

        try {
          window.localStorage.removeItem(CREATE_DRAFT_KEY);
        } catch {
          // Ignore storage errors
        }

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
            notifyGuests: effectiveNotifyGuests,
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

        setInitialDateBaseline({
          startDate,
          startTime,
          endDate,
          endTime,
        });
        setNotifyGuestsOverride(null);
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
      <form
        onSubmit={handleSubmit}
        className={`space-y-3.5 pt-1 ${themeDrawerOpen ? 'pb-64' : ''}`}
      >
        {hasUnsavedDraftContent ? (
          <div className="flex items-center justify-between gap-2 px-1">
            <span
              data-testid="create-draft-badge"
              className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium backdrop-blur-md"
              style={{
                backgroundColor: 'var(--theme-outer-pill-bg)',
                borderColor: 'var(--theme-outer-pill-border)',
                color: 'var(--theme-outer-text)',
              }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: 'var(--theme-accent)' }}
                aria-hidden="true"
              />
              <span>Draft</span>
            </span>

            <button
              type="button"
              onClick={clearCreateDraft}
              className="text-[11px] font-medium opacity-75 hover:opacity-100 underline underline-offset-2 cursor-pointer"
              style={{ color: 'var(--theme-outer-text)' }}
            >
              Clear draft
            </button>
          </div>
        ) : null}

        {/* Live Invitation Card — goes straight into creating with Theme & Cover controls */}
        <div
          className="invite-glass-card rounded-3xl border overflow-hidden"
          style={{
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
                <div className="inline-flex items-center gap-1.5">
                  <button
                    type="button"
                    data-testid="edit-theme-button"
                    onClick={() => openThemeDrawer('theme')}
                    className="inline-flex items-center gap-1.5 rounded-full bg-slate-950/75 backdrop-blur-md border border-white/20 px-3 py-1.5 text-xs font-medium text-white shadow-lg hover:bg-slate-950 transition cursor-pointer"
                  >
                    <Palette className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Theme</span>
                  </button>
                  <button
                    type="button"
                    data-testid="change-cover-button"
                    onClick={() => openThemeDrawer('cover')}
                    className="inline-flex items-center gap-1.5 rounded-full bg-slate-950/75 backdrop-blur-md border border-white/20 px-3 py-1.5 text-xs font-medium text-white shadow-lg hover:bg-slate-950 transition cursor-pointer"
                  >
                    <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Cover</span>
                  </button>
                </div>
              </CoverArt>
            ) : (
              <div className="px-5 pt-4 flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  data-testid="edit-theme-button"
                  onClick={() => openThemeDrawer('theme')}
                  className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition hover:opacity-85 cursor-pointer"
                  style={{
                    backgroundColor: 'var(--theme-surface-bg)',
                    borderColor: 'var(--theme-border)',
                    color: 'var(--theme-text-primary)',
                  }}
                >
                  <Palette className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Theme · {activePreset.name}</span>
                </button>
                <button
                  type="button"
                  data-testid="change-cover-button"
                  onClick={() => {
                    setStyle((prev) => ({ ...prev, coverLayout: 'banner' }));
                    openThemeDrawer('cover');
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-dashed px-3 py-1.5 text-xs font-medium transition hover:opacity-85 cursor-pointer"
                  style={{
                    borderColor: 'var(--theme-border)',
                    color: 'var(--theme-text-muted)',
                  }}
                >
                  <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Add cover</span>
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
                  data-title-input="true"
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
                    className="w-full min-w-0 appearance-none rounded-xl border px-2.5 py-2 text-base sm:text-sm outline-none focus:ring-2"
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
                    className="w-full min-w-0 appearance-none rounded-xl border px-2.5 py-2 text-base sm:text-sm outline-none focus:ring-2"
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
                        className="w-full min-w-0 appearance-none rounded-xl border px-2.5 py-2 text-base sm:text-sm outline-none focus:ring-2"
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
                        className="w-full min-w-0 appearance-none rounded-xl border px-2.5 py-2 text-base sm:text-sm outline-none focus:ring-2"
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
                        className="flex-1 min-w-0 rounded-xl border px-3 py-2 text-base sm:text-sm outline-none focus:ring-2"
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
                      className="w-full rounded-xl border px-3 py-2 text-base sm:text-sm outline-none focus:ring-2"
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
                      className="w-full rounded-xl border px-3 py-2 text-base sm:text-sm outline-none focus:ring-2"
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
                      className="w-full rounded-xl border px-3 py-2 text-base sm:text-sm outline-none focus:ring-2"
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
                    className="flex-1 min-w-0 rounded-xl border px-3 py-2 text-base sm:text-sm outline-none focus:ring-2"
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
            className="invite-glass-card group rounded-3xl border overflow-hidden"
            style={{
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
                  className="w-full rounded-xl border px-3 py-2 text-base sm:text-sm outline-none focus:ring-2"
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
                  className="w-full rounded-xl border px-3 py-2 text-base sm:text-sm outline-none cursor-pointer"
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

          {mode === 'edit' && initialEvent ? (
            <div
              className="rounded-2xl border px-4 py-3 space-y-1"
              style={{
                backgroundColor: 'var(--theme-card-solid, var(--theme-card-bg))',
                borderColor: effectiveNotifyGuests
                  ? 'var(--theme-accent)'
                  : 'var(--theme-hairline)',
              }}
            >
              <div className="flex items-center gap-2.5 min-h-[36px]">
                <input
                  id={notifyGuestsId}
                  type="checkbox"
                  name="notifyGuests"
                  data-testid="edit-notify-guests-checkbox"
                  checked={effectiveNotifyGuests}
                  onChange={(e) => setNotifyGuestsOverride(e.target.checked)}
                  className="invite-checkbox h-4 w-4 shrink-0 rounded"
                  style={{ accentColor: 'var(--theme-accent)' }}
                />
                <label
                  htmlFor={notifyGuestsId}
                  className="invite-checkbox-label text-xs sm:text-sm font-medium cursor-pointer"
                  style={{ color: 'var(--theme-text-primary)' }}
                >
                  Email subscribed guests about these changes
                </label>
              </div>
              <p
                className="text-xs pl-6"
                style={{ color: 'var(--theme-text-muted)' }}
              >
                {hasMaterialDetailChanges
                  ? 'Time, location, or details changed'
                  : "Style tweak only — guests won't be emailed unless checked"}
              </p>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="invite-cta-btn w-full min-h-[50px] rounded-full py-3.5 px-5 text-base font-semibold transition active:scale-[0.99] disabled:opacity-60 cursor-pointer shadow-xl"
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
