'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  CalendarPlus,
  Check,
  ChevronDown,
  Clock,
  Download,
  ExternalLink,
  MapPin,
  Pencil,
  Share2,
  Sparkles,
  Users,
  Video,
} from 'lucide-react';
import { CoverArt } from '@/components/covers/CoverArt';
import { AmbientBackdrop } from '@/components/effects/AmbientBackdrop';
import {
  CalendarDateTile,
  formatDistinctLocation,
} from '@/components/invite/CalendarDateTile';
import { EventWall } from '@/components/invite/EventWall';
import { GuestList } from '@/components/invite/GuestList';
import { getGuestTokenStorageKey, RsvpPanel } from '@/components/invite/RsvpPanel';
import { SafeRichHtml } from '@/components/invite/SafeRichHtml';
import { SubscribeControl } from '@/components/invite/SubscribeControl';
import {
  buildExternalCalendarUrls,
  buildMapsSearchUrl,
  isSafeExternalHttpUrl,
} from '@/components/invite/calendarLinks';
import { formatEventDateTime, type FormattedEventDateTime } from '@/lib/polyfills/temporal';
import { rememberHostEvent, rememberVisitedEvent } from '@/lib/client/recentEvents';
import { getThemePreset, resolveThemeCssVars } from '@/lib/themes/presets';
import type { CommentRecord, EventDetailResponse, RsvpRecord } from '@/types/invite';

const HOST_KEYS_STORAGE = 'invited_host_keys';

interface InviteViewProps {
  initialDetail: EventDetailResponse;
  initialFormattedDate: FormattedEventDateTime;
  initialEditKey?: string | null;
}

function readStoredHostKey(eventId: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(HOST_KEYS_STORAGE);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const value = (parsed as Record<string, unknown>)[eventId];
      return typeof value === 'string' && value.trim() ? value.trim() : null;
    }
  } catch {
    return null;
  }
  return null;
}

function writeStoredHostKey(eventId: string, editKey: string): void {
  if (typeof window === 'undefined' || !editKey.trim()) return;
  try {
    const raw = window.localStorage.getItem(HOST_KEYS_STORAGE);
    const parsed = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    const next =
      parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? { ...parsed } : {};
    next[eventId] = editKey.trim();
    window.localStorage.setItem(HOST_KEYS_STORAGE, JSON.stringify(next));
  } catch {
    // Ignore private mode / storage quota issues
  }
}

function readStoredGuestToken(eventId: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const token = window.localStorage.getItem(getGuestTokenStorageKey(eventId));
    return token && token.trim() ? token.trim() : null;
  } catch {
    return null;
  }
}

export function InviteView({
  initialDetail,
  initialFormattedDate,
  initialEditKey = null,
}: InviteViewProps) {
  const [detail, setDetail] = useState<EventDetailResponse>(initialDetail);
  const [formattedDate, setFormattedDate] =
    useState<FormattedEventDateTime>(initialFormattedDate);
  const [editKey, setEditKey] = useState<string | null>(initialEditKey);
  const [guestToken, setGuestToken] = useState<string | null>(null);
  const [rsvpGuestName, setRsvpGuestName] = useState<string>(
    initialDetail.viewerRsvp?.guestName ?? '',
  );
  const [isEditingRsvp, setIsEditingRsvp] = useState<boolean>(false);
  const [subscribeSignal, setSubscribeSignal] = useState<number>(0);
  const [shareLabel, setShareLabel] = useState<'Share' | 'Link copied!'>('Share');
  const [calendarUrls, setCalendarUrls] = useState<{
    googleUrl: string;
    outlookUrl: string;
  } | null>(null);

  const rsvpNameInputRef = useRef<HTMLInputElement | null>(null);
  const shareTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const event = detail.event;
  const preset = useMemo(() => getThemePreset(event.style.themeId), [event.style.themeId]);
  const cssVars = useMemo(() => resolveThemeCssVars(event.style), [event.style]);
  const colorMode = event.style.colorMode ?? preset.colorMode;

  const refreshDetail = useCallback(
    async (overrideTokens?: { editKey?: string | null; guestToken?: string | null }) => {
      const activeEditKey =
        overrideTokens && 'editKey' in overrideTokens ? overrideTokens.editKey : editKey;
      const activeGuestToken =
        overrideTokens && 'guestToken' in overrideTokens
          ? overrideTokens.guestToken
          : guestToken;

      const headers: Record<string, string> = {};
      if (activeEditKey) headers['x-edit-key'] = activeEditKey;
      if (activeGuestToken) headers['x-guest-token'] = activeGuestToken;

      const res = await fetch(`/api/events/${encodeURIComponent(event.id)}`, {
        cache: 'no-store',
        headers,
      });
      if (!res.ok) return;
      const next = (await res.json()) as EventDetailResponse;
      setDetail(next);
      if (next.viewerRsvp?.guestName) {
        setRsvpGuestName((current) => current || next.viewerRsvp?.guestName || '');
      }
    },
    [event.id, editKey, guestToken],
  );

  // Hydrate viewer-local timezone and external calendar URLs
  useEffect(() => {
    let cancelled = false;

    const viewerTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    void formatEventDateTime(event.startIso, event.endIso, event.timeZone, viewerTz).then(
      (resolved) => {
        if (!cancelled) {
          setFormattedDate(resolved);
        }
      },
    );

    const shareUrl = window.location.origin + `/e/${encodeURIComponent(event.id)}`;
    void buildExternalCalendarUrls(event, shareUrl).then((urls) => {
      if (!cancelled) {
        setCalendarUrls(urls);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [event]);

  // Hydrate saved host/guest tokens and record the visit in My Events
  useEffect(() => {
    let cancelled = false;

    const hydrateTokens = async () => {
      const baseEvent = initialDetail.event;
      if (initialEditKey && initialDetail.isHost) {
        writeStoredHostKey(baseEvent.id, initialEditKey);
      }
      const storedHostKey = initialEditKey || readStoredHostKey(baseEvent.id);
      const storedGuestToken = readStoredGuestToken(baseEvent.id);

      if (!cancelled) {
        if (storedHostKey) setEditKey(storedHostKey);
        if (storedGuestToken) setGuestToken(storedGuestToken);
      }

      let resolvedEvent = baseEvent;
      let resolvedIsHost = initialDetail.isHost;

      if (storedGuestToken || (storedHostKey && !initialDetail.isHost)) {
        const headers: Record<string, string> = {};
        if (storedHostKey) headers['x-edit-key'] = storedHostKey;
        if (storedGuestToken) headers['x-guest-token'] = storedGuestToken;

        const res = await fetch(`/api/events/${encodeURIComponent(baseEvent.id)}`, {
          cache: 'no-store',
          headers,
        });
        if (cancelled) return;
        if (res.ok) {
          const next = (await res.json()) as EventDetailResponse;
          if (cancelled) return;
          resolvedEvent = next.event;
          resolvedIsHost = next.isHost;
          setDetail(next);
          if (next.viewerRsvp?.guestName) {
            setRsvpGuestName((curr) => curr || next.viewerRsvp?.guestName || '');
          }
        }
      }

      if (cancelled) return;
      if (resolvedIsHost && storedHostKey) {
        rememberHostEvent({
          id: resolvedEvent.id,
          title: resolvedEvent.title,
          startIso: resolvedEvent.startIso,
          timeZone: resolvedEvent.timeZone,
          locationName: resolvedEvent.locationName,
          themeId: resolvedEvent.style.themeId,
          editKey: storedHostKey,
        });
      } else {
        rememberVisitedEvent({
          id: resolvedEvent.id,
          title: resolvedEvent.title,
          startIso: resolvedEvent.startIso,
          timeZone: resolvedEvent.timeZone,
          locationName: resolvedEvent.locationName,
          themeId: resolvedEvent.style.themeId,
        });
      }
    };

    void hydrateTokens();

    return () => {
      cancelled = true;
    };
  }, [initialDetail, initialEditKey]);

  useEffect(() => {
    return () => {
      if (shareTimerRef.current) clearTimeout(shareTimerRef.current);
    };
  }, []);

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/e/${encodeURIComponent(event.id)}`;
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: event.title,
          text: `You're invited to ${event.title} (${formattedDate.fullLabel})`,
          url: shareUrl,
        });
        return;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareLabel('Link copied!');
      if (shareTimerRef.current) clearTimeout(shareTimerRef.current);
      shareTimerRef.current = setTimeout(() => setShareLabel('Share'), 2400);
    } catch {
      // Fallback: prompt selection if clipboard API is blocked
      window.prompt('Copy invitation link:', shareUrl);
    }
  };

  const handleRsvpSuccess = ({
    rsvp,
    guestToken: nextToken,
    detail: updatedDetail,
  }: {
    rsvp: RsvpRecord;
    guestToken: string;
    detail?: EventDetailResponse;
  }) => {
    if (nextToken) {
      setGuestToken(nextToken);
    }
    if (updatedDetail) {
      setDetail({
        ...updatedDetail,
        viewerRsvp: updatedDetail.viewerRsvp ?? rsvp,
      });
    } else {
      setDetail((prev) => {
        const nextYes = prev.rsvps.yes.filter((item) => item.id !== rsvp.id);
        const nextNo = prev.rsvps.no.filter((item) => item.id !== rsvp.id);
        if (rsvp.status === 'yes') {
          nextYes.unshift(rsvp);
        } else {
          nextNo.unshift(rsvp);
        }
        const totalHeadcount = nextYes.reduce((sum, item) => sum + 1 + item.plusOnes, 0);
        const respondedNames = new Set(
          [...nextYes, ...nextNo].map((item) => item.guestName.trim().toLowerCase()),
        );
        const awaitingNames = prev.event.invitedNames.filter(
          (name) => !respondedNames.has(name.trim().toLowerCase()),
        );
        return {
          ...prev,
          viewerRsvp: rsvp,
          rsvps: {
            yes: nextYes,
            no: nextNo,
            totalHeadcount,
            awaitingNames,
          },
        };
      });
      void refreshDetail({ guestToken: nextToken || guestToken });
    }
  };

  const handleWithdrawRsvp = (freshDetail?: EventDetailResponse) => {
    setGuestToken(null);
    if (freshDetail) {
      setDetail({ ...freshDetail, viewerRsvp: undefined });
    } else {
      void refreshDetail({ guestToken: null });
    }
  };

  const handleSelectAwaitingName = (name: string) => {
    setRsvpGuestName(name);
    setIsEditingRsvp(true);
    const section = document.getElementById('rsvp-section');
    section?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => {
      rsvpNameInputRef.current?.focus();
    }, 250);
  };

  const handleCommentsChange = (comments: CommentRecord[]) => {
    setDetail((prev) => ({ ...prev, comments }));
  };

  const mapsUrl = buildMapsSearchUrl(event.locationName, event.locationAddress);
  const { primaryLocation, secondaryAddress } = formatDistinctLocation(
    event.locationName,
    event.locationAddress,
  );
  const hasVirtualLink = isSafeExternalHttpUrl(event.virtualUrl);
  const hasLocationCard = Boolean(
    primaryLocation || secondaryAddress || hasVirtualLink,
  );
  const activeHostKey = editKey || initialEditKey;
  const editHref = activeHostKey
    ? `/e/${encodeURIComponent(event.id)}/edit?key=${encodeURIComponent(activeHostKey)}`
    : `/e/${encodeURIComponent(event.id)}/edit`;

  return (
    <div
      className="relative min-h-screen overflow-x-clip"
      style={{
        ...(cssVars as React.CSSProperties),
        colorScheme: colorMode,
        backgroundColor: 'var(--theme-page-bg)',
        color: 'var(--theme-text-primary)',
        fontFamily: 'var(--theme-font-body)',
      }}
    >
      <AmbientBackdrop
        effectId={event.style.effectId}
        accentColor={cssVars['--theme-accent']}
        colorMode={colorMode}
        className="fixed inset-0 z-0"
      />

      {/* Top compact chrome (<12% height) */}
      <header className="relative z-10 mx-auto max-w-4xl px-4 pt-5 pb-2 flex flex-wrap items-center justify-between gap-2">
        <Link
          href="/"
          className="invite-pill inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs sm:text-sm font-medium min-h-[44px] backdrop-blur-md transition-opacity hover:opacity-85"
          style={{
            backgroundColor: 'var(--theme-card-bg)',
            borderColor: 'var(--theme-border)',
            color: 'var(--theme-text-primary)',
          }}
        >
          <span
            className="font-semibold tracking-tight"
            style={{ fontFamily: 'var(--theme-font-heading)' }}
          >
            invited
          </span>
          <span className="hidden sm:inline" style={{ color: 'var(--theme-text-muted)' }}>
            · Create your own invite
          </span>
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          {detail.isHost && (
            <Link
              href={editHref}
              className="invite-on-accent inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs sm:text-sm font-semibold min-h-[44px] shadow-sm transition-opacity hover:opacity-90"
              style={{ backgroundColor: 'var(--theme-accent)' }}
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              <span>You are the Host · Edit Event</span>
            </Link>
          )}

          <button
            type="button"
            onClick={() => void handleShare()}
            className="invite-pill inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs sm:text-sm font-medium min-h-[44px] backdrop-blur-md transition-opacity hover:opacity-85 cursor-pointer"
            style={{
              backgroundColor: 'var(--theme-card-bg)',
              borderColor: 'var(--theme-border)',
              color: 'var(--theme-text-primary)',
            }}
          >
            {shareLabel === 'Link copied!' ? (
              <Check
                className="h-4 w-4"
                style={{ color: 'var(--theme-accent)' }}
                aria-hidden="true"
              />
            ) : (
              <Share2 className="h-4 w-4" aria-hidden="true" />
            )}
            <span>{shareLabel}</span>
          </button>

          <SubscribeControl
            eventId={event.id}
            eventTitle={event.title}
            subscriberCount={detail.subscriberCount}
            openSignal={subscribeSignal}
            onSubscribed={() => {
              void refreshDetail();
            }}
            variant="pill"
          />
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-4xl px-4 pt-2 pb-14 space-y-6">
        {/* Main Editorial Hero Card */}
        <article
          className="invite-card rounded-3xl border shadow-2xl overflow-hidden backdrop-blur-xl"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--theme-card-bg) 86%, transparent)',
            borderColor: 'var(--theme-border)',
          }}
        >
          {event.style.coverLayout === 'banner' && (
            <div className="w-full max-h-[360px] overflow-hidden border-b" style={{ borderColor: 'var(--theme-border)' }}>
              <CoverArt
                coverPresetId={event.style.coverPresetId}
                customCoverUrl={event.style.customCoverUrl}
                layout="banner"
                title={event.title}
                accentColor={cssVars['--theme-accent']}
                className="rounded-none border-0 shadow-none"
              />
            </div>
          )}

          <div className="p-5 sm:p-8 space-y-7">
            {/* Hero Title + Optional Square Cover */}
            <div
              className={
                event.style.coverLayout === 'square'
                  ? 'grid grid-cols-1 md:grid-cols-[240px_1fr] gap-6 items-center'
                  : 'space-y-4'
              }
            >
              {event.style.coverLayout === 'square' && (
                <div className="mx-auto md:mx-0 w-full max-w-[240px]">
                  <CoverArt
                    coverPresetId={event.style.coverPresetId}
                    customCoverUrl={event.style.customCoverUrl}
                    layout="square"
                    title={event.title}
                    accentColor={cssVars['--theme-accent']}
                  />
                </div>
              )}

              <div className="space-y-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium"
                    style={{
                      backgroundColor: 'var(--theme-surface-bg)',
                      borderColor: 'var(--theme-border)',
                    }}
                  >
                    <span aria-hidden="true">{preset.emoji}</span>
                    <span>{preset.name}</span>
                  </span>

                  <span
                    className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium"
                    style={{
                      backgroundColor: 'var(--theme-surface-bg)',
                      borderColor: 'var(--theme-border)',
                    }}
                  >
                    <Users
                      className="h-3.5 w-3.5"
                      style={{ color: 'var(--theme-accent)' }}
                      aria-hidden="true"
                    />
                    <span className="tabular-nums">{detail.rsvps.totalHeadcount} Going</span>
                  </span>
                </div>

                <h1
                  className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight leading-[1.12]"
                  style={{
                    fontFamily: 'var(--theme-font-heading)',
                    textWrap: 'balance',
                  }}
                >
                  {event.title}
                </h1>

                {event.hostName && (
                  <p className="inline-flex items-center gap-2 text-sm sm:text-base">
                    <span
                      className="inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold invite-on-accent"
                      style={{ backgroundColor: 'var(--theme-accent)' }}
                      aria-hidden="true"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                    </span>
                    <span style={{ color: 'var(--theme-text-muted)' }}>
                      Hosted by{' '}
                      <strong
                        className="font-semibold"
                        style={{ color: 'var(--theme-text-primary)' }}
                      >
                        {event.hostName}
                      </strong>
                    </span>
                  </p>
                )}
              </div>
            </div>

            {/* Timezone-Aware Date/Time & Location Cards */}
            <div
              className={`grid grid-cols-1 ${hasLocationCard ? 'md:grid-cols-2' : ''} gap-4`}
            >
              {/* Date & Time Card */}
              <div
                className="rounded-2xl border p-4 sm:p-5 flex flex-col justify-between gap-4"
                style={{
                  backgroundColor: 'var(--theme-surface-bg)',
                  borderColor: 'var(--theme-border)',
                }}
              >
                <div className="flex items-start gap-3.5">
                  <CalendarDateTile
                    startIso={event.startIso}
                    timeZone={event.timeZone}
                    size="md"
                  />
                  <div className="min-w-0 space-y-1">
                    <p className="font-semibold text-base leading-snug">
                      {formattedDate.dateLabel}
                    </p>
                    <p className="text-sm" style={{ color: 'var(--theme-text-muted)' }}>
                      {formattedDate.timeLabel}
                    </p>
                    {formattedDate.viewerTimeLabel && (
                      <p
                        className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium mt-1"
                        style={{
                          backgroundColor: 'var(--theme-card-bg)',
                          borderColor: 'var(--theme-border)',
                        }}
                      >
                        <Clock
                          className="h-3.5 w-3.5 shrink-0"
                          style={{ color: 'var(--theme-accent)' }}
                          aria-hidden="true"
                        />
                        <span>{formattedDate.viewerTimeLabel}</span>
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <button
                    type="button"
                    popoverTarget="calendar-menu"
                    className="inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium min-h-[48px] transition-opacity hover:opacity-85 cursor-pointer"
                    style={{
                      backgroundColor: 'var(--theme-card-bg)',
                      borderColor: 'var(--theme-border)',
                    }}
                  >
                    <CalendarPlus
                      className="h-4 w-4"
                      style={{ color: 'var(--theme-accent)' }}
                      aria-hidden="true"
                    />
                    <span>Add to Calendar</span>
                    <ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />
                  </button>

                  <div
                    id="calendar-menu"
                    popover="auto"
                    className="m-auto w-[min(90vw,19rem)] rounded-2xl border p-3 shadow-2xl space-y-1.5"
                    style={{
                      backgroundColor: 'var(--theme-card-bg)',
                      borderColor: 'var(--theme-border)',
                      color: 'var(--theme-text-primary)',
                    }}
                  >
                    <div className="flex items-center justify-between px-2 py-1">
                      <span className="text-xs font-semibold uppercase tracking-wider opacity-75">
                        Add to Calendar
                      </span>
                      <button
                        type="button"
                        popoverTarget="calendar-menu"
                        popoverTargetAction="hide"
                        className="text-xs px-2 py-1 rounded-md hover:opacity-80 cursor-pointer"
                        style={{ color: 'var(--theme-text-muted)' }}
                      >
                        Close
                      </button>
                    </div>

                    <a
                      href={`/api/events/${encodeURIComponent(event.id)}/ics`}
                      download
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium min-h-[48px] transition-colors hover:opacity-85"
                      style={{ backgroundColor: 'var(--theme-surface-bg)' }}
                    >
                      <Download
                        className="h-4 w-4 shrink-0"
                        style={{ color: 'var(--theme-accent)' }}
                        aria-hidden="true"
                      />
                      <span>Download .ics (Apple / Outlook)</span>
                    </a>

                    {calendarUrls && (
                      <>
                        <a
                          href={calendarUrls.googleUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium min-h-[48px] transition-colors hover:opacity-85"
                          style={{ backgroundColor: 'var(--theme-surface-bg)' }}
                        >
                          <span>Google Calendar</span>
                          <ExternalLink className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />
                        </a>

                        <a
                          href={calendarUrls.outlookUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium min-h-[48px] transition-colors hover:opacity-85"
                          style={{ backgroundColor: 'var(--theme-surface-bg)' }}
                        >
                          <span>Outlook.com</span>
                          <ExternalLink className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />
                        </a>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Location / Virtual Link Card */}
              {hasLocationCard && (
                <div
                  className="rounded-2xl border p-4 sm:p-5 flex flex-col justify-between gap-4"
                  style={{
                    backgroundColor: 'var(--theme-surface-bg)',
                    borderColor: 'var(--theme-border)',
                  }}
                >
                  <div className="flex items-start gap-3.5">
                    <div
                      className="invite-on-accent inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                      style={{ backgroundColor: 'var(--theme-accent)' }}
                      aria-hidden="true"
                    >
                      {event.locationName || event.locationAddress ? (
                        <MapPin className="h-5 w-5" />
                      ) : (
                        <Video className="h-5 w-5" />
                      )}
                    </div>
                    <div className="min-w-0 space-y-1">
                      <p className="font-semibold text-base leading-snug break-words">
                        {primaryLocation ||
                          (hasVirtualLink ? 'Virtual Event' : 'Location Details')}
                      </p>
                      {secondaryAddress && (
                        <p
                          className="text-sm break-words"
                          style={{ color: 'var(--theme-text-muted)' }}
                        >
                          {secondaryAddress}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {mapsUrl && (
                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium min-h-[48px] transition-opacity hover:opacity-85"
                        style={{
                          backgroundColor: 'var(--theme-card-bg)',
                          borderColor: 'var(--theme-border)',
                        }}
                      >
                        <MapPin
                          className="h-4 w-4"
                          style={{ color: 'var(--theme-accent)' }}
                          aria-hidden="true"
                        />
                        <span>View Map</span>
                        <ExternalLink className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />
                      </a>
                    )}

                    {hasVirtualLink && event.virtualUrl && (
                      <a
                        href={event.virtualUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="invite-on-accent inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold min-h-[48px] transition-opacity hover:opacity-90"
                        style={{ backgroundColor: 'var(--theme-accent)' }}
                      >
                        <Video className="h-4 w-4" aria-hidden="true" />
                        <span>Join Online</span>
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Event Description */}
            {event.descriptionHtml.trim() && (
              <section
                aria-label="About this event"
                className="rounded-2xl border p-5 sm:p-6"
                style={{
                  backgroundColor: 'var(--theme-surface-bg)',
                  borderColor: 'var(--theme-border)',
                }}
              >
                <SafeRichHtml
                  html={event.descriptionHtml}
                  className="invite-prose text-base sm:text-[1.0625rem]"
                />
              </section>
            )}

            {/* Strict Binary RSVP Panel */}
            <RsvpPanel
              event={event}
              awaitingNames={detail.rsvps.awaitingNames}
              viewerRsvp={detail.viewerRsvp}
              editKey={editKey}
              guestToken={guestToken}
              guestName={rsvpGuestName}
              onGuestNameChange={setRsvpGuestName}
              isEditing={isEditingRsvp}
              onEditingChange={setIsEditingRsvp}
              onRsvpSuccess={handleRsvpSuccess}
              onWithdrawRsvp={handleWithdrawRsvp}
              onOpenSubscribe={() => setSubscribeSignal((n) => n + 1)}
              nameInputRef={rsvpNameInputRef}
            />
          </div>
        </article>

        {/* Guest List & Event Wall */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5">
            <GuestList
              event={event}
              rsvps={detail.rsvps}
              isHost={detail.isHost}
              viewerRsvp={detail.viewerRsvp}
              onSelectAwaitingName={handleSelectAwaitingName}
            />
          </div>

          <div className="lg:col-span-7">
            <EventWall
              eventId={event.id}
              comments={detail.comments}
              isHost={detail.isHost}
              editKey={editKey}
              guestToken={guestToken}
              defaultAuthorName={
                detail.viewerRsvp?.guestName ||
                (detail.isHost ? event.hostName : undefined)
              }
              viewerRsvpStatus={detail.viewerRsvp?.status}
              onCommentsChange={handleCommentsChange}
              onRefreshDetail={refreshDetail}
            />
          </div>
        </div>
      </main>

      <footer className="relative z-10 mx-auto max-w-4xl px-4 pb-10 text-center">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-medium min-h-[44px] backdrop-blur-md transition-opacity hover:opacity-85"
          style={{
            backgroundColor: 'var(--theme-card-bg)',
            borderColor: 'var(--theme-border)',
            color: 'var(--theme-text-muted)',
          }}
        >
          <span>
            Made with{' '}
            <strong style={{ color: 'var(--theme-text-primary)' }}>invited</strong> — Create
            a free, account-free invite →
          </span>
        </Link>
      </footer>
    </div>
  );
}
