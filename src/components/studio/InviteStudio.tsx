'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Calendar,
  Check,
  Clock,
  ExternalLink,
  Eye,
  Globe,
  Link2,
  MapPin,
  Plus,
  Sparkles,
  Trash2,
  User,
  Users,
  Wand2,
  X,
} from 'lucide-react';
import { RichTextEditor } from '@/components/editor/RichTextEditor';
import { InvitePreviewCard } from '@/components/studio/InvitePreviewCard';
import {
  PublishSuccessDialog,
  type PublishedEventResult,
} from '@/components/studio/PublishSuccessDialog';
import { StyleStudioDrawer } from '@/components/studio/StyleStudioDrawer';
import {
  getBrowserTimeZone,
  getSupportedTimeZones,
  isoToLocalFields,
  parseInvitedNames,
  validateAndBuildZonedIso,
  type DstConflictInfo,
} from '@/components/studio/dateTimeUtils';
import {
  rememberHostEvent,
  removeRecentEvent,
} from '@/lib/client/recentEvents';
import {
  parseEventPrompt,
  type ParsedEventDraft,
} from '@/lib/nlp/parseEventPrompt';
import { setupDialogLightDismiss } from '@/lib/polyfills/ui';
import { getThemePreset } from '@/lib/themes/presets';
import type { EventMeta, InviteStyleConfig } from '@/types/invite';

interface InviteStudioProps {
  mode: 'create' | 'edit';
  initialDraft?: ParsedEventDraft | null;
  initialEvent?: EventMeta;
  eventId?: string;
  editKey?: string;
  onSaved?: (updated: EventMeta) => void;
}

function getDefaultStyle(): InviteStyleConfig {
  const preset = getThemePreset('aurora-midnight');
  return {
    themeId: preset.id,
    fontId: preset.defaultFontId,
    effectId: preset.defaultEffectId,
    coverPresetId: preset.defaultCoverPresetId,
    coverLayout: 'square',
    colorMode: preset.colorMode,
  };
}

function getDefaultDateSevenDaysOut(): string {
  const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function InviteStudio({
  mode,
  initialDraft,
  initialEvent,
  eventId,
  editKey,
  onSaved,
}: InviteStudioProps) {
  const router = useRouter();

  const [quickPrompt, setQuickPrompt] = useState('');
  const [quickFillFeedback, setQuickFillFeedback] = useState<string | null>(
    null,
  );

  const [title, setTitle] = useState(
    initialEvent?.title ?? initialDraft?.title ?? '',
  );
  const [timeZone, setTimeZone] = useState(
    initialEvent?.timeZone ?? initialDraft?.timeZone ?? 'America/New_York',
  );
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('18:00');
  const [showEndTime, setShowEndTime] = useState(
    Boolean(initialEvent?.endIso ?? initialDraft?.endIso),
  );
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('21:00');

  const [startDisambiguation, setStartDisambiguation] = useState<
    'earlier' | 'later' | undefined
  >(undefined);
  const [endDisambiguation, setEndDisambiguation] = useState<
    'earlier' | 'later' | undefined
  >(undefined);

  const [startDstState, setStartDstState] = useState<{
    key: string;
    conflict: DstConflictInfo | null;
    iso?: string;
  } | null>(null);
  const [endDstState, setEndDstState] = useState<{
    key: string;
    conflict: DstConflictInfo | null;
    iso?: string;
  } | null>(null);
  const [submitDstError, setSubmitDstError] = useState<{
    target: 'start' | 'end';
    conflict: DstConflictInfo;
  } | null>(null);

  const [locationName, setLocationName] = useState(
    initialEvent?.locationName ?? initialDraft?.locationName ?? '',
  );
  const [locationAddress, setLocationAddress] = useState(
    initialEvent?.locationAddress ?? initialDraft?.locationAddress ?? '',
  );
  const [virtualUrl, setVirtualUrl] = useState(
    initialEvent?.virtualUrl ?? initialDraft?.virtualUrl ?? '',
  );
  const [hostName, setHostName] = useState(
    initialEvent?.hostName ?? initialDraft?.hostName ?? '',
  );

  const [descriptionHtml, setDescriptionHtml] = useState(
    initialEvent?.descriptionHtml ?? initialDraft?.descriptionHtml ?? '',
  );
  const [rsvpNotePrompt, setRsvpNotePrompt] = useState(
    initialEvent?.rsvpNotePrompt ??
      initialDraft?.rsvpNotePrompt ??
      'What dish, drink, or note would you like to share?',
  );
  const [invitedNamesRaw, setInvitedNamesRaw] = useState(
    initialEvent?.invitedNames?.join(', ') ?? '',
  );
  const [hideGuestList, setHideGuestList] = useState(
    initialEvent?.hideGuestList ?? false,
  );

  const [style, setStyle] = useState<InviteStyleConfig>(
    initialEvent?.style ?? initialDraft?.style ?? getDefaultStyle(),
  );

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [publishedResult, setPublishedResult] =
    useState<PublishedEventResult | null>(null);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const deleteDialogRef = useRef<HTMLDialogElement>(null);
  const previewSectionRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const timeZones = useMemo(() => getSupportedTimeZones(timeZone), [timeZone]);
  const invitedNames = useMemo(
    () => parseInvitedNames(invitedNamesRaw),
    [invitedNamesRaw],
  );

  // Initialize timezone and local date/time fields cleanly
  useEffect(() => {
    let cancelled = false;
    const initDates = async () => {
      const targetTz =
        initialEvent?.timeZone ??
        initialDraft?.timeZone ??
        getBrowserTimeZone();
      if (!cancelled) {
        setTimeZone(targetTz);
      }

      const sourceStart = initialEvent?.startIso ?? initialDraft?.startIso;
      if (sourceStart) {
        const localStart = await isoToLocalFields(sourceStart, targetTz);
        if (!cancelled) {
          setStartDate(localStart.date || getDefaultDateSevenDaysOut());
          setStartTime(localStart.time || '18:00');
        }
      } else if (!cancelled) {
        setStartDate(getDefaultDateSevenDaysOut());
        setStartTime('18:00');
      }

      const sourceEnd = initialEvent?.endIso ?? initialDraft?.endIso;
      if (sourceEnd) {
        const localEnd = await isoToLocalFields(sourceEnd, targetTz);
        if (!cancelled) {
          setShowEndTime(true);
          setEndDate(localEnd.date || getDefaultDateSevenDaysOut());
          setEndTime(localEnd.time || '21:00');
        }
      }
    };

    void initDates();
    return () => {
      cancelled = true;
    };
  }, [initialEvent, initialDraft]);

  const startCheckKey =
    startDate && startTime
      ? `${startDate}|${startTime}|${timeZone}|${startDisambiguation ?? ''}`
      : '';
  const endEffectiveDate = endDate || startDate;
  const endCheckKey =
    showEndTime && endEffectiveDate && endTime
      ? `${endEffectiveDate}|${endTime}|${timeZone}|${endDisambiguation ?? ''}`
      : '';

  // Live Temporal.ZonedDateTime DST validation for start date/time
  useEffect(() => {
    if (!startCheckKey) return;
    let cancelled = false;
    void validateAndBuildZonedIso(
      startDate,
      startTime,
      timeZone,
      startDisambiguation,
    ).then((res) => {
      if (cancelled) return;
      setStartDstState({
        key: startCheckKey,
        conflict: res.dstConflict ?? null,
        iso: res.iso,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [startCheckKey, startDate, startTime, timeZone, startDisambiguation]);

  // Live Temporal.ZonedDateTime DST validation for optional end date/time
  useEffect(() => {
    if (!endCheckKey) return;
    let cancelled = false;
    void validateAndBuildZonedIso(
      endEffectiveDate,
      endTime,
      timeZone,
      endDisambiguation,
    ).then((res) => {
      if (cancelled) return;
      setEndDstState({
        key: endCheckKey,
        conflict: res.dstConflict ?? null,
        iso: res.iso,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [endCheckKey, endEffectiveDate, endTime, timeZone, endDisambiguation]);

  const startDstConflict =
    submitDstError?.target === 'start'
      ? submitDstError.conflict
      : startCheckKey && startDstState?.key === startCheckKey
        ? startDstState.conflict
        : null;
  const resolvedStartIso =
    startCheckKey && startDstState?.key === startCheckKey
      ? startDstState.iso
      : initialEvent?.startIso ?? initialDraft?.startIso;

  const endDstConflict =
    submitDstError?.target === 'end'
      ? submitDstError.conflict
      : endCheckKey && endDstState?.key === endCheckKey
        ? endDstState.conflict
        : null;
  const resolvedEndIso = showEndTime
    ? endCheckKey && endDstState?.key === endCheckKey
      ? endDstState.iso
      : initialEvent?.endIso ?? initialDraft?.endIso
    : undefined;

  // Wire Delete confirmation <dialog> light-dismiss
  useEffect(() => {
    const dialog = deleteDialogRef.current;
    if (!dialog) return;
    const cleanup = setupDialogLightDismiss(dialog);
    const handleClose = () => {
      setDeleteDialogOpen(false);
    };
    dialog.addEventListener('close', handleClose);
    return () => {
      cleanup();
      dialog.removeEventListener('close', handleClose);
    };
  }, []);

  useEffect(() => {
    const dialog = deleteDialogRef.current;
    if (!dialog) return;
    if (deleteDialogOpen && !dialog.open) {
      dialog.showModal();
    } else if (!deleteDialogOpen && dialog.open) {
      dialog.close();
    }
  }, [deleteDialogOpen]);

  const applyQuickFill = async () => {
    const trimmed = quickPrompt.trim();
    if (!trimmed) {
      setQuickFillFeedback('Write a short description first to autofill.');
      return;
    }

    const parsed = parseEventPrompt(trimmed, new Date(), timeZone);
    setTitle(parsed.title);
    setTimeZone(parsed.timeZone || timeZone);
    setLocationName(parsed.locationName ?? '');
    setLocationAddress(parsed.locationAddress ?? '');
    setVirtualUrl(parsed.virtualUrl ?? '');
    setHostName(parsed.hostName ?? '');
    setDescriptionHtml(parsed.descriptionHtml);
    setRsvpNotePrompt(parsed.rsvpNotePrompt);
    setStyle(parsed.style);
    setStartDisambiguation(undefined);
    setEndDisambiguation(undefined);

    const startFields = await isoToLocalFields(
      parsed.startIso,
      parsed.timeZone || timeZone,
    );
    if (startFields.date) setStartDate(startFields.date);
    if (startFields.time) setStartTime(startFields.time);

    if (parsed.endIso) {
      const endFields = await isoToLocalFields(
        parsed.endIso,
        parsed.timeZone || timeZone,
      );
      setShowEndTime(true);
      if (endFields.date) setEndDate(endFields.date);
      if (endFields.time) setEndTime(endFields.time);
    } else {
      setShowEndTime(false);
    }

    setQuickFillFeedback(
      `Autofilled "${parsed.title}" with the ${getThemePreset(parsed.style.themeId).name} theme.`,
    );
    setSubmitError(null);
  };

  const handleQuickPromptKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      void applyQuickFill();
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) return;

    setSubmitError(null);
    setSaveSuccessMsg(null);
    setSubmitDstError(null);

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setSubmitError('Please enter an event title.');
      titleInputRef.current?.focus();
      return;
    }

    const startRes = await validateAndBuildZonedIso(
      startDate,
      startTime,
      timeZone,
      startDisambiguation,
    );
    if (startRes.dstConflict) {
      setSubmitDstError({ target: 'start', conflict: startRes.dstConflict });
      setSubmitError(
        'Please resolve the Daylight Saving Time conflict on your start time before continuing.',
      );
      return;
    }
    if (startRes.error || !startRes.iso) {
      setSubmitError(startRes.error || 'Please pick a valid start date and time.');
      return;
    }

    let finalEndIso: string | undefined;
    if (showEndTime && endTime) {
      const effectiveEndDate = endDate || startDate;
      const endRes = await validateAndBuildZonedIso(
        effectiveEndDate,
        endTime,
        timeZone,
        endDisambiguation,
      );
      if (endRes.dstConflict) {
        setSubmitDstError({ target: 'end', conflict: endRes.dstConflict });
        setSubmitError(
          'Please resolve the Daylight Saving Time conflict on your end time before continuing.',
        );
        return;
      }
      if (endRes.error || !endRes.iso) {
        setSubmitError(endRes.error || 'Please pick a valid end date and time.');
        return;
      }
      if (Date.parse(endRes.iso) <= Date.parse(startRes.iso)) {
        setSubmitError('End date & time must be after the start date & time.');
        return;
      }
      finalEndIso = endRes.iso;
    }

    const cleanVirtual = virtualUrl.trim();
    if (cleanVirtual && !/^https?:\/\//i.test(cleanVirtual)) {
      setSubmitError('Virtual event link must start with https:// or http://.');
      return;
    }

    const optionalValue = (val: string | undefined): string | null | undefined => {
      const trimmed = val?.trim();
      if (trimmed) return trimmed;
      return mode === 'edit' ? null : undefined;
    };

    const payload = {
      title: cleanTitle,
      descriptionHtml,
      startIso: startRes.iso,
      endIso: finalEndIso ?? (mode === 'edit' ? null : undefined),
      timeZone,
      locationName: optionalValue(locationName),
      locationAddress: optionalValue(locationAddress),
      virtualUrl: optionalValue(cleanVirtual),
      hostName: optionalValue(hostName),
      rsvpNotePrompt: optionalValue(rsvpNotePrompt),
      invitedNames,
      hideGuestList,
      style,
    };

    setIsSubmitting(true);
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
        if (!res.ok) {
          throw new Error(data.error || 'Failed to publish invite.');
        }

        const createdId = data.id ?? data.event?.id;
        const createdKey = data.editKey;
        if (!createdId || !createdKey) {
          throw new Error('Server did not return event links.');
        }

        setPublishedResult({
          id: createdId,
          editKey: createdKey,
          title: data.event?.title ?? cleanTitle,
          startIso: data.event?.startIso ?? startRes.iso,
          timeZone: data.event?.timeZone ?? timeZone,
          locationName: data.event?.locationName ?? (locationName.trim() || undefined),
          themeId: style.themeId,
        });
      } else {
        if (!eventId || !editKey) {
          throw new Error('Missing event ID or host edit key.');
        }
        const res = await fetch(`/api/events/${encodeURIComponent(eventId)}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'x-edit-key': editKey,
          },
          body: JSON.stringify(payload),
        });
        const data = (await res.json().catch(() => ({}))) as
          | EventMeta
          | { event?: EventMeta; error?: string };

        if (!res.ok) {
          const errObj = data as { error?: string };
          throw new Error(errObj.error || 'Failed to save event changes.');
        }

        const updatedEvent =
          'event' in data && data.event
            ? data.event
            : (data as EventMeta);

        rememberHostEvent({
          id: eventId,
          title: updatedEvent.title ?? cleanTitle,
          startIso: updatedEvent.startIso ?? startRes.iso,
          timeZone: updatedEvent.timeZone ?? timeZone,
          locationName:
            updatedEvent.locationName ?? (locationName.trim() || undefined),
          themeId: updatedEvent.style?.themeId ?? style.themeId,
          editKey,
        });

        setSaveSuccessMsg('All changes saved and live on your invite.');
        onSaved?.(updatedEvent);
      }
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Something went wrong saving.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!eventId || !editKey || isDeleting) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/events/${encodeURIComponent(eventId)}`, {
        method: 'DELETE',
        headers: { 'x-edit-key': editKey },
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error || 'Could not delete this event.');
      }
      removeRecentEvent(eventId);
      setDeleteDialogOpen(false);
      router.push('/');
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : 'Failed to delete event.',
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 pb-28">
      {/* Quick Fill Bar on /create */}
      {mode === 'create' ? (
        <details className="group rounded-3xl border border-emerald-400/25 bg-emerald-500/[0.06] overflow-hidden backdrop-blur-xl">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-medium text-emerald-100 hover:bg-emerald-500/[0.09] transition min-h-[52px]">
            <span className="inline-flex items-center gap-2.5">
              <Wand2 className="h-4 w-4 text-emerald-300" aria-hidden="true" />
              <span>
                Quick Fill from a sentence{' '}
                <span className="text-emerald-200/70 font-normal">
                  (paste a text or description to autofill fields &amp; theme)
                </span>
              </span>
            </span>
            <span className="text-xs text-emerald-300 font-semibold group-open:hidden">
              Expand
            </span>
          </summary>

          <div className="border-t border-emerald-400/20 p-5 space-y-3">
            <div className="flex flex-col sm:flex-row gap-2.5">
              <label htmlFor="studio-quick-fill" className="sr-only">
                Describe your event in plain English
              </label>
              <input
                id="studio-quick-fill"
                type="text"
                value={quickPrompt}
                onChange={(e) => setQuickPrompt(e.target.value)}
                onKeyDown={handleQuickPromptKeyDown}
                placeholder="e.g. Friendsgiving dinner Nov 26 at 5pm at my place, hosted by Maya"
                className="flex-1 rounded-2xl border border-white/15 bg-slate-950/80 px-4 py-3 text-base text-white placeholder:text-slate-500 min-h-[48px] [@media(pointer:coarse)]:min-h-[52px]"
              />
              <button
                type="button"
                onClick={() => void applyQuickFill()}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-emerald-300 transition min-h-[48px] [@media(pointer:coarse)]:min-h-[52px] shrink-0"
              >
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                <span>Autofill Fields</span>
              </button>
            </div>
            {quickFillFeedback ? (
              <p className="text-xs text-emerald-200" role="status">
                {quickFillFeedback}
              </p>
            ) : null}
          </div>
        </details>
      ) : null}

      {/* Mobile jump-to-preview pill */}
      <div className="flex justify-end lg:hidden">
        <button
          type="button"
          onClick={() =>
            previewSectionRef.current?.scrollIntoView({ behavior: 'smooth' })
          }
          className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-xs font-medium text-slate-200 hover:bg-white/[0.12] min-h-[44px]"
        >
          <Eye className="h-3.5 w-3.5 text-emerald-300" aria-hidden="true" />
          <span>Jump to Live Preview</span>
        </button>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} noValidate>
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)] gap-6 xl:gap-8 items-start">
          {/* Left Column: Form Flow */}
          <div className="space-y-6">
            {/* Section 1: Event Essentials */}
            <section
              aria-labelledby="essentials-heading"
              className="invite-card rounded-3xl border border-white/12 bg-white/[0.04] p-5 sm:p-6 space-y-5"
            >
              <div>
                <h2
                  id="essentials-heading"
                  className="text-lg font-semibold text-white"
                >
                  Event Essentials
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  The core details guests see right away.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="event-title"
                    className="block text-sm font-medium text-slate-200 mb-1.5"
                  >
                    Event Title <span className="text-rose-400">*</span>
                  </label>
                  <input
                    ref={titleInputRef}
                    id="event-title"
                    name="title"
                    type="text"
                    required
                    maxLength={140}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Cozy Christmas Cocoa & Games Night"
                    className="w-full rounded-2xl border border-white/15 bg-slate-900/75 px-4 py-3 text-base text-white placeholder:text-slate-500 focus:border-emerald-400/70 focus:outline-none focus:ring-2 focus:ring-emerald-400/20 min-h-[48px] [@media(pointer:coarse)]:min-h-[52px]"
                  />
                </div>

                {/* Date & Start Time */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label
                      htmlFor="event-start-date"
                      className="flex items-center gap-1.5 text-sm font-medium text-slate-200 mb-1.5"
                    >
                      <Calendar
                        className="h-3.5 w-3.5 text-emerald-300"
                        aria-hidden="true"
                      />
                      <span>
                        Start Date <span className="text-rose-400">*</span>
                      </span>
                    </label>
                    <input
                      id="event-start-date"
                      name="startDate"
                      type="date"
                      required
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value);
                        setStartDisambiguation(undefined);
                        setSubmitDstError(null);
                        if (!endDate) setEndDate(e.target.value);
                      }}
                      className="w-full rounded-2xl border border-white/15 bg-slate-900/75 px-4 py-3 text-base text-white focus:border-emerald-400/70 focus:outline-none focus:ring-2 focus:ring-emerald-400/20 min-h-[48px] [@media(pointer:coarse)]:min-h-[52px]"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="event-start-time"
                      className="flex items-center gap-1.5 text-sm font-medium text-slate-200 mb-1.5"
                    >
                      <Clock
                        className="h-3.5 w-3.5 text-emerald-300"
                        aria-hidden="true"
                      />
                      <span>
                        Start Time <span className="text-rose-400">*</span>
                      </span>
                    </label>
                    <input
                      id="event-start-time"
                      name="startTime"
                      type="time"
                      required
                      value={startTime}
                      onChange={(e) => {
                        setStartTime(e.target.value);
                        setStartDisambiguation(undefined);
                        setSubmitDstError((prev) =>
                          prev?.target === 'start' ? null : prev,
                        );
                      }}
                      className="w-full rounded-2xl border border-white/15 bg-slate-900/75 px-4 py-3 text-base text-white focus:border-emerald-400/70 focus:outline-none focus:ring-2 focus:ring-emerald-400/20 min-h-[48px] [@media(pointer:coarse)]:min-h-[52px]"
                    />
                  </div>
                </div>

                {/* Start DST Conflict Warning */}
                {startDstConflict ? (
                  <div
                    role="alert"
                    className="rounded-2xl border border-amber-400/45 bg-amber-500/15 p-3.5 space-y-2.5 text-xs sm:text-sm text-amber-100"
                  >
                    <div className="flex items-start gap-2">
                      <AlertTriangle
                        className="h-4 w-4 text-amber-300 shrink-0 mt-0.5"
                        aria-hidden="true"
                      />
                      <p>{startDstConflict.message}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {startDstConflict.kind === 'ambiguous' ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setStartDisambiguation('earlier');
                              setSubmitDstError(null);
                            }}
                            className="rounded-xl bg-amber-300 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-200 min-h-[40px]"
                          >
                            Use first ({startDstConflict.earlierLabel})
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setStartDisambiguation('later');
                              setSubmitDstError(null);
                            }}
                            className="rounded-xl border border-amber-300/40 px-3 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-400/20 min-h-[40px]"
                          >
                            Use second ({startDstConflict.laterLabel})
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setStartDate(startDstConflict.laterDate);
                            setStartTime(startDstConflict.laterTime);
                            setStartDisambiguation(undefined);
                            setSubmitDstError(null);
                          }}
                          className="rounded-xl bg-amber-300 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-200 min-h-[40px]"
                        >
                          Adjust to {startDstConflict.laterTime}
                        </button>
                      )}
                    </div>
                  </div>
                ) : null}

                {/* Optional End Date & Time */}
                {!showEndTime ? (
                  <div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowEndTime(true);
                        if (!endDate) setEndDate(startDate);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-white/12 bg-white/[0.04] px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-300 hover:bg-white/[0.08] hover:text-white transition min-h-[44px]"
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Add optional end time</span>
                    </button>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-3.5 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Optional End Time
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setShowEndTime(false);
                          setEndDstState(null);
                          setSubmitDstError((prev) =>
                            prev?.target === 'end' ? null : prev,
                          );
                          setEndDisambiguation(undefined);
                        }}
                        className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white min-h-[36px] px-2"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Remove</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label
                          htmlFor="event-end-date"
                          className="block text-xs font-medium text-slate-300 mb-1"
                        >
                          End Date
                        </label>
                        <input
                          id="event-end-date"
                          name="endDate"
                          type="date"
                          value={endDate || startDate}
                          onChange={(e) => {
                            setEndDate(e.target.value);
                            setEndDisambiguation(undefined);
                            setSubmitDstError((prev) =>
                              prev?.target === 'end' ? null : prev,
                            );
                          }}
                          className="w-full rounded-xl border border-white/15 bg-slate-900 px-3.5 py-2.5 text-base text-white min-h-[48px] [@media(pointer:coarse)]:min-h-[52px]"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="event-end-time"
                          className="block text-xs font-medium text-slate-300 mb-1"
                        >
                          End Time
                        </label>
                        <input
                          id="event-end-time"
                          name="endTime"
                          type="time"
                          value={endTime}
                          onChange={(e) => {
                            setEndTime(e.target.value);
                            setEndDisambiguation(undefined);
                            setSubmitDstError((prev) =>
                              prev?.target === 'end' ? null : prev,
                            );
                          }}
                          className="w-full rounded-xl border border-white/15 bg-slate-900 px-3.5 py-2.5 text-base text-white min-h-[48px] [@media(pointer:coarse)]:min-h-[52px]"
                        />
                      </div>
                    </div>

                    {endDstConflict ? (
                      <div
                        role="alert"
                        className="rounded-xl border border-amber-400/45 bg-amber-500/15 p-3 space-y-2 text-xs text-amber-100"
                      >
                        <p>{endDstConflict.message}</p>
                        <div className="flex flex-wrap gap-2">
                          {endDstConflict.kind === 'ambiguous' ? (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setEndDisambiguation('earlier');
                                  setSubmitDstError(null);
                                }}
                                className="rounded-lg bg-amber-300 px-3 py-1.5 font-semibold text-slate-950 min-h-[36px]"
                              >
                                First ({endDstConflict.earlierLabel})
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEndDisambiguation('later');
                                  setSubmitDstError(null);
                                }}
                                className="rounded-lg border border-amber-300/40 px-3 py-1.5 font-semibold text-amber-100 min-h-[36px]"
                              >
                                Second ({endDstConflict.laterLabel})
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setEndDate(endDstConflict.laterDate);
                                setEndTime(endDstConflict.laterTime);
                                setEndDisambiguation(undefined);
                                setSubmitDstError(null);
                              }}
                              className="rounded-lg bg-amber-300 px-3 py-1.5 font-semibold text-slate-950 min-h-[36px]"
                            >
                              Adjust to {endDstConflict.laterTime}
                            </button>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}

                {/* Timezone */}
                <div>
                  <label
                    htmlFor="event-timezone"
                    className="flex items-center gap-1.5 text-sm font-medium text-slate-200 mb-1.5"
                  >
                    <Globe
                      className="h-3.5 w-3.5 text-sky-300"
                      aria-hidden="true"
                    />
                    <span>Event Timezone</span>
                  </label>
                  <select
                    id="event-timezone"
                    name="timeZone"
                    value={timeZone}
                    onChange={(e) => {
                      setTimeZone(e.target.value);
                      setStartDisambiguation(undefined);
                      setEndDisambiguation(undefined);
                      setSubmitDstError(null);
                    }}
                    className="w-full rounded-2xl border border-white/15 bg-slate-900/75 px-4 py-3 text-base text-white focus:border-emerald-400/70 focus:outline-none focus:ring-2 focus:ring-emerald-400/20 min-h-[48px] [@media(pointer:coarse)]:min-h-[52px]"
                  >
                    {timeZones.map((tz) => (
                      <option key={tz} value={tz} className="bg-slate-900">
                        {tz.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Location & Virtual */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label
                      htmlFor="event-location-name"
                      className="flex items-center gap-1.5 text-sm font-medium text-slate-200 mb-1.5"
                    >
                      <MapPin
                        className="h-3.5 w-3.5 text-rose-300"
                        aria-hidden="true"
                      />
                      <span>Location Name</span>
                    </label>
                    <input
                      id="event-location-name"
                      name="locationName"
                      type="text"
                      value={locationName}
                      onChange={(e) => setLocationName(e.target.value)}
                      placeholder="e.g. Our Place or Cedar Park Pavilion"
                      className="w-full rounded-2xl border border-white/15 bg-slate-900/75 px-4 py-3 text-base text-white placeholder:text-slate-500 min-h-[48px] [@media(pointer:coarse)]:min-h-[52px]"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="event-location-address"
                      className="block text-sm font-medium text-slate-200 mb-1.5"
                    >
                      Street Address (optional)
                    </label>
                    <input
                      id="event-location-address"
                      name="locationAddress"
                      type="text"
                      value={locationAddress}
                      onChange={(e) => setLocationAddress(e.target.value)}
                      placeholder="e.g. 42 Maple St, Portland"
                      className="w-full rounded-2xl border border-white/15 bg-slate-900/75 px-4 py-3 text-base text-white placeholder:text-slate-500 min-h-[48px] [@media(pointer:coarse)]:min-h-[52px]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label
                      htmlFor="event-virtual-url"
                      className="flex items-center gap-1.5 text-sm font-medium text-slate-200 mb-1.5"
                    >
                      <Link2
                        className="h-3.5 w-3.5 text-violet-300"
                        aria-hidden="true"
                      />
                      <span>Optional Virtual Link</span>
                    </label>
                    <input
                      id="event-virtual-url"
                      name="virtualUrl"
                      type="url"
                      value={virtualUrl}
                      onChange={(e) => setVirtualUrl(e.target.value)}
                      placeholder="https://meet.google.com/..."
                      className="w-full rounded-2xl border border-white/15 bg-slate-900/75 px-4 py-3 text-base text-white placeholder:text-slate-500 min-h-[48px] [@media(pointer:coarse)]:min-h-[52px]"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="event-host-name"
                      className="flex items-center gap-1.5 text-sm font-medium text-slate-200 mb-1.5"
                    >
                      <User
                        className="h-3.5 w-3.5 text-amber-300"
                        aria-hidden="true"
                      />
                      <span>Host Name</span>
                    </label>
                    <input
                      id="event-host-name"
                      name="hostName"
                      type="text"
                      value={hostName}
                      onChange={(e) => setHostName(e.target.value)}
                      placeholder="e.g. Sarah & Jordan"
                      className="w-full rounded-2xl border border-white/15 bg-slate-900/75 px-4 py-3 text-base text-white placeholder:text-slate-500 min-h-[48px] [@media(pointer:coarse)]:min-h-[52px]"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Section 2: Rich Description & Guest Options */}
            <section
              aria-labelledby="description-options-heading"
              className="invite-card rounded-3xl border border-white/12 bg-white/[0.04] p-5 sm:p-6 space-y-5"
            >
              <div>
                <h2
                  id="description-options-heading"
                  className="text-lg font-semibold text-white"
                >
                  Description &amp; Guest Options
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Add formatted details, potluck prompts, or pre-list guests.
                </p>
              </div>

              <RichTextEditor
                label="Event Description"
                hint="Formatted with clean editorial prose"
                value={descriptionHtml}
                onChange={setDescriptionHtml}
              />

              <div>
                <label
                  htmlFor="event-rsvp-prompt"
                  className="block text-sm font-medium text-slate-200 mb-1.5"
                >
                  Prompt for guests&apos; RSVP note
                </label>
                <input
                  id="event-rsvp-prompt"
                  name="rsvpNotePrompt"
                  type="text"
                  value={rsvpNotePrompt}
                  onChange={(e) => setRsvpNotePrompt(e.target.value)}
                  placeholder="What dish or drink are you bringing?"
                  className="w-full rounded-2xl border border-white/15 bg-slate-900/75 px-4 py-3 text-base text-white placeholder:text-slate-500 min-h-[48px] [@media(pointer:coarse)]:min-h-[52px]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <label
                    htmlFor="event-invited-names"
                    className="flex items-center gap-1.5 text-sm font-medium text-slate-200"
                  >
                    <Users
                      className="h-3.5 w-3.5 text-sky-300"
                      aria-hidden="true"
                    />
                    <span>Invited Names (optional)</span>
                  </label>
                  {invitedNames.length > 0 ? (
                    <span className="rounded-full bg-sky-400/15 px-2.5 py-0.5 text-xs font-medium text-sky-200">
                      {invitedNames.length} listed for Awaiting Reply
                    </span>
                  ) : null}
                </div>
                <textarea
                  id="event-invited-names"
                  name="invitedNames"
                  rows={2}
                  value={invitedNamesRaw}
                  onChange={(e) => setInvitedNamesRaw(e.target.value)}
                  placeholder="Comma or line separated, e.g. Alex Rivera, Priya Patel, Sam & Mia"
                  className="w-full rounded-2xl border border-white/15 bg-slate-900/75 px-4 py-3 text-base text-white placeholder:text-slate-500 resize-y [field-sizing:content] min-h-[80px]"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Guests can tap their name in 1 click to RSVP, and unresponded
                  names appear under Awaiting Reply.
                </p>
              </div>

              <label
                htmlFor="event-hide-guest-list"
                className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/12 bg-slate-950/50 p-3.5 hover:bg-white/[0.04] transition min-h-[52px]"
              >
                <input
                  id="event-hide-guest-list"
                  name="hideGuestList"
                  type="checkbox"
                  checked={hideGuestList}
                  onChange={(e) => setHideGuestList(e.target.checked)}
                  className="mt-0.5 h-5 w-5 rounded border-white/25 bg-slate-900 text-emerald-400 focus:ring-emerald-400"
                />
                <div className="space-y-0.5">
                  <span className="block text-sm font-medium text-white">
                    Hide guest list from other guests
                  </span>
                  <span className="block text-xs text-slate-400">
                    Guests will still see total headcount attending, while
                    individual names remain private to you.
                  </span>
                </div>
              </label>
            </section>

            {/* Section 3: Progressive-Disclosure Styling Studio */}
            <StyleStudioDrawer
              style={style}
              onChange={setStyle}
              eventId={eventId}
              editKey={editKey}
            />
          </div>

          {/* Right/Sticky Column: Live Interactive Invite Preview */}
          <div
            ref={previewSectionRef}
            className="lg:sticky lg:top-6 space-y-4"
          >
            <InvitePreviewCard
              title={title}
              descriptionHtml={descriptionHtml}
              startIso={resolvedStartIso}
              endIso={resolvedEndIso}
              timeZone={timeZone}
              locationName={locationName}
              locationAddress={locationAddress}
              virtualUrl={virtualUrl}
              hostName={hostName}
              rsvpNotePrompt={rsvpNotePrompt}
              invitedCount={invitedNames.length}
              hideGuestList={hideGuestList}
              style={style}
            />
          </div>
        </div>

        {/* Sticky Publish / Save Bar */}
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/15 bg-slate-950/88 backdrop-blur-2xl">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-8">
            <div className="min-w-0 flex-1">
              {submitError ? (
                <p className="text-xs sm:text-sm text-rose-300 font-medium" role="alert">
                  {submitError}
                </p>
              ) : saveSuccessMsg ? (
                <p className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-emerald-300 font-medium" role="status">
                  <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{saveSuccessMsg}</span>
                </p>
              ) : (
                <p className="text-xs text-slate-400 hidden sm:block">
                  {mode === 'create'
                    ? 'Free & account-free — publish to get your Guest Invite Link + Secret Edit Link.'
                    : 'Saving updates your live invite immediately.'}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2.5 ml-auto">
              {mode === 'edit' && eventId ? (
                <>
                  <Link
                    href={`/e/${eventId}`}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-white hover:bg-white/[0.14] transition min-h-[48px] [@media(pointer:coarse)]:min-h-[52px]"
                  >
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    <span className="hidden sm:inline">View Public Invite</span>
                    <span className="sm:hidden">View</span>
                  </Link>

                  <button
                    type="button"
                    onClick={() => {
                      setDeleteError(null);
                      setDeleteDialogOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-rose-400/35 bg-rose-500/10 px-3.5 py-2.5 text-sm font-medium text-rose-200 hover:bg-rose-500/20 transition min-h-[48px] [@media(pointer:coarse)]:min-h-[52px]"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    <span className="hidden sm:inline">Delete Event</span>
                  </button>
                </>
              ) : null}

              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-300 px-5 sm:px-6 py-2.5 text-sm sm:text-base font-semibold text-slate-950 shadow-lg shadow-emerald-500/20 hover:brightness-105 transition min-h-[48px] [@media(pointer:coarse)]:min-h-[52px] disabled:opacity-70"
              >
                {mode === 'create'
                  ? isSubmitting
                    ? 'Publishing Invite...'
                    : 'Publish Invite & Get Links'
                  : isSubmitting
                    ? 'Saving Changes...'
                    : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Post-Publish Dual-Link Celebration Modal */}
      <PublishSuccessDialog
        published={publishedResult}
        onClose={() => setPublishedResult(null)}
      />

      {/* Delete Event Confirmation Modal */}
      <dialog
        ref={deleteDialogRef}
        closedby="any"
        aria-labelledby="delete-event-title"
        className="m-auto w-[min(92vw,440px)] rounded-3xl border border-white/15 bg-slate-950 p-6 text-slate-100 shadow-2xl"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-rose-500/20 text-rose-300">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="space-y-1">
              <h2
                id="delete-event-title"
                className="text-lg font-semibold text-white"
              >
                Delete &ldquo;{title || 'this event'}&rdquo;?
              </h2>
              <p className="text-sm text-slate-300">
                This permanently removes the public invite link, all RSVPs, and
                the event wall. This cannot be undone.
              </p>
            </div>
          </div>

          {deleteError ? (
            <p className="text-xs text-rose-300" role="alert">
              {deleteError}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setDeleteDialogOpen(false)}
              className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-white/10 min-h-[48px]"
            >
              Keep Event
            </button>
            <button
              type="button"
              disabled={isDeleting}
              onClick={() => void handleConfirmDelete()}
              className="rounded-xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-400 transition min-h-[48px] disabled:opacity-70"
            >
              {isDeleting ? 'Deleting...' : 'Yes, Delete Permanently'}
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
