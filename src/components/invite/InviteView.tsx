'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  Calendar,
  ExternalLink,
  MapPin,
  Sparkles,
  Video,
} from 'lucide-react';
import { CoverArt } from '@/components/covers/CoverArt';
import { AmbientBackdrop } from '@/components/effects/AmbientBackdrop';
import {
  getCachedGuestRsvp,
  getDeviceProfile,
  getDeviceProfileServerSnapshot,
  getSavedGuestToken,
  saveCachedGuestRsvp,
  subscribeDeviceProfile,
} from '@/lib/client/deviceProfile';
import {
  getSavedHostKey,
  rememberHostEvent,
  rememberVisitedEvent,
  saveHostKey,
} from '@/lib/client/recentEvents';
import { ensureTemporal, formatEventDateTime, type FormattedEventDateTime } from '@/lib/polyfills/temporal';
import { stripHtmlToText } from '@/lib/sanitize';
import { resolveThemeCssVars } from '@/lib/themes/presets';
import type { CommentRecord, EventDetailResponse, RsvpRecord } from '@/types/invite';
import { CalendarDateTile, formatDistinctLocation } from './CalendarDateTile';
import {
  buildExternalCalendarUrls,
  buildMapsSearchUrl,
  isSafeExternalHttpUrl,
} from './calendarLinks';
import { EventWall } from './EventWall';
import { GuestAvatar } from './GuestAvatar';
import { GuestList } from './GuestList';
import { RsvpPanel } from './RsvpPanel';
import { SafeRichHtml } from './SafeRichHtml';
import { SubscribeControl } from './SubscribeControl';

const subscribeNoop = () => () => {};

interface InviteViewProps {
  initialDetail: EventDetailResponse;
  initialFormattedDate: FormattedEventDateTime;
  initialEditKey?: string | null;
}

export function InviteView({
  initialDetail,
  initialFormattedDate,
  initialEditKey = null,
}: InviteViewProps) {
  const [detail, setDetail] = useState<EventDetailResponse>(initialDetail);
  const [formattedDate, setFormattedDate] = useState<FormattedEventDateTime>(initialFormattedDate);
  const [editKey, setEditKey] = useState<string | null>(initialEditKey);
  const [guestToken, setGuestToken] = useState<string | null>(null);
  const [rsvpGuestName, setRsvpGuestName] = useState<string>(
    initialDetail.viewerRsvp?.guestName ?? '',
  );
  const [isEditingRsvp, setIsEditingRsvp] = useState<boolean>(false);
  const [subscribeSignal, setSubscribeSignal] = useState<number>(0);
  const [shareCopied, setShareCopied] = useState<boolean>(false);
  const shareOrigin = useSyncExternalStore(
    subscribeNoop,
    () => window.location.origin,
    () => 'https://invited.local',
  );
  const [calendarUrls, setCalendarUrls] = useState<{
    googleUrl: string;
    outlookUrl: string;
  } | null>(null);

  const rsvpNameInputRef = useRef<HTMLInputElement>(null);
  const deviceProfile = useSyncExternalStore(
    subscribeDeviceProfile,
    getDeviceProfile,
    getDeviceProfileServerSnapshot,
  );

  const event = detail.event;
  const themeVars = useMemo(
    () => resolveThemeCssVars(event.style) as React.CSSProperties,
    [event.style],
  );

  const refreshDetail = useCallback(
    async (overrides?: { editKey?: string | null; guestToken?: string | null }) => {
      const effectiveEditKey =
        overrides && 'editKey' in overrides ? overrides.editKey : editKey;
      const effectiveToken =
        overrides && 'guestToken' in overrides ? overrides.guestToken : guestToken;

      try {
        const headers: Record<string, string> = {};
        if (effectiveEditKey) headers['x-edit-key'] = effectiveEditKey;
        if (effectiveToken) headers['x-guest-token'] = effectiveToken;

        const res = await fetch(`/api/events/${event.id}`, {
          headers,
          cache: 'no-store',
        });
        if (!res.ok) return;
        const fresh = (await res.json()) as EventDetailResponse;
        setDetail(fresh);
        if (fresh.viewerRsvp) {
          saveCachedGuestRsvp(event.id, fresh.viewerRsvp);
          setRsvpGuestName(fresh.viewerRsvp.guestName);
        } else if (effectiveToken) {
          saveCachedGuestRsvp(event.id, null);
        }
      } catch {
        // Keep current rendered detail if offline
      }
    },
    [editKey, event.id, guestToken],
  );

  // Client hydration: edit key, guest token, local cache, viewer timezone, recent events
  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) return;

      const storedEditKey = initialEditKey || getSavedHostKey(event.id);
      if (storedEditKey) {
        saveHostKey(event.id, storedEditKey);
        setEditKey(storedEditKey);
      }

      const storedToken = getSavedGuestToken(event.id);
      if (storedToken) {
        setGuestToken(storedToken);
      }

      const cachedRsvp = getCachedGuestRsvp(event.id);
      if (cachedRsvp && !initialDetail.viewerRsvp) {
        setDetail((prev) =>
          prev.viewerRsvp ? prev : { ...prev, viewerRsvp: cachedRsvp },
        );
        setRsvpGuestName(cachedRsvp.guestName);
      }

      if (storedEditKey && initialDetail.isHost) {
        rememberHostEvent({
          id: event.id,
          title: event.title,
          startIso: event.startIso,
          timeZone: event.timeZone,
          locationName: event.locationName,
          themeId: event.style.themeId,
          editKey: storedEditKey,
        });
      } else {
        rememberVisitedEvent({
          id: event.id,
          title: event.title,
          startIso: event.startIso,
          timeZone: event.timeZone,
          locationName: event.locationName,
          themeId: event.style.themeId,
        });
      }

      if (storedToken || (!initialDetail.isHost && storedEditKey)) {
        void refreshDetail({
          editKey: storedEditKey,
          guestToken: storedToken,
        });
      }
    });

    void (async () => {
      try {
        await ensureTemporal();
        const viewerTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const localized = await formatEventDateTime(
          event.startIso,
          event.endIso,
          event.timeZone,
          viewerTz,
        );
        if (!cancelled) {
          setFormattedDate(localized);
        }
      } catch {
        // Keep initial SSR date formatting
      }
    })();

    return () => {
      cancelled = true;
    };
    // Only run hydration effect cleanly on initial mount / event id switch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.id, initialEditKey]);

  // Keep My Invites history in sync if background refresh discovers host role
  useEffect(() => {
    if (detail.isHost && editKey) {
      rememberHostEvent({
        id: event.id,
        title: event.title,
        startIso: event.startIso,
        timeZone: event.timeZone,
        locationName: event.locationName,
        themeId: event.style.themeId,
        editKey,
      });
    }
  }, [
    detail.isHost,
    editKey,
    event.id,
    event.locationName,
    event.startIso,
    event.style.themeId,
    event.timeZone,
    event.title,
  ]);

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
        const filteredYes = prev.rsvps.yes.filter((item) => item.id !== rsvp.id);
        const filteredNo = prev.rsvps.no.filter((item) => item.id !== rsvp.id);
        const nextYes = rsvp.status === 'yes' ? [rsvp, ...filteredYes] : filteredYes;
        const nextNo = rsvp.status === 'no' ? [rsvp, ...filteredNo] : filteredNo;
        const totalHeadcount = nextYes.reduce((sum, item) => sum + 1 + item.plusOnes, 0);
        return {
          ...prev,
          viewerRsvp: rsvp,
          rsvps: {
            ...prev.rsvps,
            yes: nextYes,
            no: nextNo,
            totalHeadcount,
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

  const handleCommentsChange = (nextComments: CommentRecord[]) => {
    setDetail((prev) => ({
      ...prev,
      comments: nextComments,
    }));
  };

  useEffect(() => {
    let cancelled = false;
    const shareUrl = `${shareOrigin}/e/${event.id}`;
    void buildExternalCalendarUrls(event, shareUrl)
      .then((urls) => {
        if (!cancelled) {
          setCalendarUrls(urls);
        }
      })
      .catch(() => {
        // Fallback links stay hidden if Temporal calendar formatting fails
      });
    return () => {
      cancelled = true;
    };
  }, [event, shareOrigin]);

  async function handleShareInvite() {
    const shareUrl = `${shareOrigin}/e/${event.id}`;
    const nav = typeof navigator !== 'undefined' ? navigator : null;
    try {
      if (nav && typeof nav.share === 'function') {
        await nav.share({ title: event.title, url: shareUrl });
        return;
      }
      if (nav?.clipboard) {
        await nav.clipboard.writeText(shareUrl);
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 2200);
      }
    } catch {
      // User dismissed share sheet
    }
  }

  const heroLocation = formatDistinctLocation(event.locationName, event.locationAddress);
  const mapsUrl = buildMapsSearchUrl(event.locationName, event.locationAddress);
  const safeVirtualUrl = isSafeExternalHttpUrl(event.virtualUrl)
    ? event.virtualUrl!.trim()
    : null;
  const mapQuery = [heroLocation.primaryLocation, heroLocation.secondaryAddress]
    .filter(Boolean)
    .join(', ');

  const plainDescription = stripHtmlToText(event.descriptionHtml ?? '');
  const hasMeaningfulDescription = Boolean(plainDescription.trim());

  const activeEditHref =
    detail.isHost && editKey
      ? `/e/${event.id}/edit?key=${encodeURIComponent(editKey)}`
      : null;

  const recognizedHeaderName = detail.viewerRsvp?.guestName || deviceProfile?.name || '';
  const hasCover = event.style.coverLayout !== 'none';

  return (
    <div
      style={{
        ...themeVars,
        backgroundColor: 'var(--theme-page-bg)',
        color: 'var(--theme-text-primary)',
        fontFamily: 'var(--font-invite-body), var(--font-sans), sans-serif',
      }}
      className="min-h-screen relative overflow-x-hidden"
    >
      <AmbientBackdrop effectId={event.style.effectId} />

      {/* Minimal 48px single-row header */}
      <header className="relative z-10 h-12 max-w-[480px] lg:max-w-[920px] mx-auto px-4 lg:px-8 flex items-center justify-between gap-2">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-semibold tracking-tight hover:opacity-80 transition shrink-0"
          style={{ color: 'var(--theme-text-primary)' }}
        >
          <Sparkles className="h-3.5 w-3.5" style={{ color: 'var(--theme-accent)' }} aria-hidden="true" />
          <span>invited</span>
        </Link>

        <nav className="flex items-center gap-2 min-w-0">
          <Link
            href="/create"
            className="text-xs sm:text-sm font-medium opacity-80 hover:opacity-100 px-2 py-1 whitespace-nowrap transition"
            style={{ color: 'var(--theme-text-primary)' }}
          >
            Create Invite
          </Link>

          <SubscribeControl
            eventId={event.id}
            eventTitle={event.title}
            subscriberCount={detail.subscriberCount}
            openSignal={subscribeSignal}
            onSubscribed={() => void refreshDetail()}
            variant="pill"
          />

          {recognizedHeaderName ? (
            <GuestAvatar name={recognizedHeaderName} size="sm" className="shrink-0" />
          ) : null}
        </nav>
      </header>

      <main className="relative z-10 max-w-[480px] lg:max-w-[920px] mx-auto px-4 lg:px-8 pt-2 sm:pt-4 pb-16">
        <div
          className={
            hasCover
              ? 'grid grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)] gap-5 lg:gap-12 items-start'
              : 'max-w-[540px] mx-auto space-y-6'
          }
        >
          {/* Left / Top Visual Column */}
          {hasCover ? (
            <div className="space-y-6 lg:sticky lg:top-8 min-w-0">
              <CoverArt
                coverPresetId={event.style.coverPresetId}
                customCoverUrl={event.style.customCoverUrl}
                layout={event.style.coverLayout === 'banner' ? 'banner' : 'square'}
                title={event.title}
                className="w-full"
              />

              {event.hostName ? (
                <section className="hidden lg:block space-y-3">
                  <h2
                    className="text-sm font-medium pb-2 border-b"
                    style={{
                      color: 'var(--theme-text-muted)',
                      borderColor: 'var(--theme-hairline)',
                      fontFamily: 'var(--font-invite-display), var(--font-invite-body), sans-serif',
                    }}
                  >
                    Hosted By
                  </h2>
                  <div className="flex items-center gap-2.5">
                    <GuestAvatar name={event.hostName} size="sm" />
                    <span
                      className="text-sm font-medium truncate"
                      style={{ color: 'var(--theme-text-primary)' }}
                    >
                      {event.hostName}
                    </span>
                  </div>
                </section>
              ) : null}
            </div>
          ) : null}

          {/* Right / Main Flow Column */}
          <div className="min-w-0 space-y-6">
            {/* Subtle Host Manage Access Strip */}
            {activeEditHref ? (
              <div
                className="rounded-2xl border backdrop-blur-md px-4 py-3 flex items-center justify-between gap-3"
                style={{
                  backgroundColor: 'var(--theme-glass-bg)',
                  borderColor: 'var(--theme-hairline)',
                }}
              >
                <p
                  className="text-xs sm:text-sm leading-snug min-w-0"
                  style={{ color: 'var(--theme-text-muted)' }}
                >
                  You have manage access for this event.
                </p>
                <Link
                  href={activeEditHref}
                  className="shrink-0 inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-xs sm:text-sm font-semibold transition hover:opacity-90"
                  style={{
                    backgroundColor: 'var(--theme-accent)',
                    color: 'var(--theme-on-accent)',
                  }}
                >
                  <span>Manage</span>
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>
            ) : null}

            {/* Unboxed Hero Title + Host + Date + Location */}
            <header className="space-y-4">
              <div className="space-y-2">
                <h1
                  className="text-[28px] sm:text-[34px] font-bold leading-[1.12] tracking-tight break-words"
                  style={{
                    color: 'var(--theme-text-primary)',
                    fontFamily: 'var(--font-invite-display), var(--font-invite-body), sans-serif',
                  }}
                >
                  {event.title}
                </h1>

                {event.hostName ? (
                  <div className="flex items-center gap-2">
                    <GuestAvatar name={event.hostName} size="xs" />
                    <span
                      className="text-sm font-medium truncate"
                      style={{ color: 'var(--theme-text-muted)' }}
                    >
                      Hosted by {event.hostName}
                    </span>
                  </div>
                ) : null}
              </div>

              <div className="space-y-3 pt-1">
                {/* Date / Time Row with Popover Calendar Menu */}
                <div>
                  <button
                    type="button"
                    popoverTarget="calendar-menu"
                    className="w-full flex items-center gap-3.5 text-left group cursor-pointer"
                  >
                    <CalendarDateTile
                      startIso={event.startIso}
                      timeZone={event.timeZone}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className="text-sm sm:text-base font-medium leading-snug group-hover:underline break-words"
                        style={{ color: 'var(--theme-text-primary)' }}
                      >
                        {formattedDate.dateLabel}
                      </p>
                      <p
                        className="text-xs sm:text-sm leading-snug break-words"
                        style={{ color: 'var(--theme-text-muted)' }}
                      >
                        {formattedDate.timeLabel}
                      </p>
                      {formattedDate.viewerTimeLabel ? (
                        <p
                          className="text-xs leading-snug break-words mt-0.5 opacity-80"
                          style={{ color: 'var(--theme-text-muted)' }}
                        >
                          {formattedDate.viewerTimeLabel}
                        </p>
                      ) : null}
                    </div>
                  </button>

                  <div
                    id="calendar-menu"
                    popover="auto"
                    className="m-auto rounded-2xl border p-2 shadow-2xl w-[min(18rem,calc(100%-2rem))]"
                    style={{
                      backgroundColor: 'var(--theme-surface-bg)',
                      borderColor: 'var(--theme-border)',
                      color: 'var(--theme-text-primary)',
                    }}
                  >
                    <p
                      className="px-3 py-1.5 text-xs font-medium border-b mb-1"
                      style={{
                        color: 'var(--theme-text-muted)',
                        borderColor: 'var(--theme-hairline)',
                      }}
                    >
                      Add to Calendar
                    </p>
                    {calendarUrls ? (
                      <a
                        href={calendarUrls.googleUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm hover:bg-white/10 transition"
                      >
                        <span>Google Calendar</span>
                        <ExternalLink className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />
                      </a>
                    ) : null}
                    <a
                      href={`/api/events/${event.id}/ics`}
                      className="flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm hover:bg-white/10 transition"
                    >
                      <span>Apple / iCal (.ics)</span>
                      <Calendar className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />
                    </a>
                    {calendarUrls ? (
                      <a
                        href={calendarUrls.outlookUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm hover:bg-white/10 transition"
                      >
                        <span>Outlook</span>
                        <ExternalLink className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />
                      </a>
                    ) : null}
                  </div>
                </div>

                {/* Hero Location Row */}
                {heroLocation.primaryLocation || heroLocation.secondaryAddress ? (
                  <div data-testid="hero-location">
                    {mapsUrl ? (
                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3.5 group"
                      >
                        <div
                          aria-hidden="true"
                          className="h-10 w-10 rounded-xl border flex items-center justify-center shrink-0 backdrop-blur-sm"
                          style={{
                            backgroundColor: 'var(--theme-glass-bg)',
                            borderColor: 'var(--theme-hairline)',
                            color: 'var(--theme-text-muted)',
                          }}
                        >
                          <MapPin className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p
                            className="text-sm sm:text-base font-medium leading-snug group-hover:underline break-words"
                            style={{ color: 'var(--theme-text-primary)' }}
                          >
                            {heroLocation.primaryLocation || heroLocation.secondaryAddress} ↗
                          </p>
                          {heroLocation.primaryLocation && heroLocation.secondaryAddress ? (
                            <p
                              className="text-xs sm:text-sm leading-snug break-words"
                              style={{ color: 'var(--theme-text-muted)' }}
                            >
                              {heroLocation.secondaryAddress}
                            </p>
                          ) : null}
                        </div>
                      </a>
                    ) : (
                      <div className="flex items-center gap-3.5">
                        <div
                          aria-hidden="true"
                          className="h-10 w-10 rounded-xl border flex items-center justify-center shrink-0 backdrop-blur-sm"
                          style={{
                            backgroundColor: 'var(--theme-glass-bg)',
                            borderColor: 'var(--theme-hairline)',
                            color: 'var(--theme-text-muted)',
                          }}
                        >
                          <MapPin className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p
                            className="text-sm sm:text-base font-medium leading-snug break-words"
                            style={{ color: 'var(--theme-text-primary)' }}
                          >
                            {heroLocation.primaryLocation || heroLocation.secondaryAddress}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}

                {/* Virtual Link Row */}
                {safeVirtualUrl ? (
                  <a
                    href={safeVirtualUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3.5 group"
                  >
                    <div
                      aria-hidden="true"
                      className="h-10 w-10 rounded-xl border flex items-center justify-center shrink-0 backdrop-blur-sm"
                      style={{
                        backgroundColor: 'var(--theme-glass-bg)',
                        borderColor: 'var(--theme-hairline)',
                        color: 'var(--theme-text-muted)',
                      }}
                    >
                      <Video className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className="text-sm sm:text-base font-medium leading-snug group-hover:underline truncate"
                        style={{ color: 'var(--theme-text-primary)' }}
                      >
                        Join Virtual Event ↗
                      </p>
                      <p
                        className="text-xs truncate"
                        style={{ color: 'var(--theme-text-muted)' }}
                      >
                        {safeVirtualUrl}
                      </p>
                    </div>
                  </a>
                ) : null}
              </div>
            </header>

            {/* Primary Registration / RSVP Frosted Card */}
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
              onShareInvite={() => void handleShareInvite()}
              shareCopied={shareCopied}
              nameInputRef={rsvpNameInputRef}
            />

            {/* Flat Hairline Section: About Event */}
            {hasMeaningfulDescription ? (
              <section className="space-y-3">
                <h2
                  className="text-sm font-medium pb-2 border-b"
                  style={{
                    color: 'var(--theme-text-muted)',
                    borderColor: 'var(--theme-hairline)',
                    fontFamily: 'var(--font-invite-display), var(--font-invite-body), sans-serif',
                  }}
                >
                  About Event
                </h2>
                <SafeRichHtml
                  html={event.descriptionHtml}
                  className="invite-prose text-sm sm:text-base leading-relaxed"
                />
              </section>
            ) : null}

            {/* Flat Hairline Section: Location + Rounded Google Map */}
            {mapQuery && mapsUrl ? (
              <section data-testid="location-section" className="space-y-3">
                <h2
                  className="text-sm font-medium pb-2 border-b"
                  style={{
                    color: 'var(--theme-text-muted)',
                    borderColor: 'var(--theme-hairline)',
                    fontFamily: 'var(--font-invite-display), var(--font-invite-body), sans-serif',
                  }}
                >
                  Location
                </h2>
                <div className="space-y-0.5">
                  {heroLocation.primaryLocation ? (
                    <p
                      className="text-sm sm:text-base font-medium break-words"
                      style={{ color: 'var(--theme-text-primary)' }}
                    >
                      {heroLocation.primaryLocation}
                    </p>
                  ) : null}
                  {heroLocation.secondaryAddress ? (
                    <p
                      className="text-xs sm:text-sm break-words"
                      style={{ color: 'var(--theme-text-muted)' }}
                    >
                      {heroLocation.secondaryAddress}
                    </p>
                  ) : null}
                </div>

                <div
                  className="relative rounded-2xl overflow-hidden border h-44 sm:h-52"
                  style={{
                    borderColor: 'var(--theme-hairline)',
                    backgroundColor: 'var(--theme-surface-bg)',
                  }}
                >
                  <iframe
                    title={`Map of ${mapQuery}`}
                    src={`https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=14&output=embed`}
                    className="w-full h-full border-0"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-lg bg-white/95 px-2.5 py-1.5 text-xs font-semibold text-slate-900 shadow-md hover:bg-white transition"
                  >
                    <span>Maps</span>
                    <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </a>
                </div>
              </section>
            ) : null}

            {/* Flat Hairline Section: Guest List */}
            <GuestList
              event={event}
              rsvps={detail.rsvps}
              isHost={detail.isHost}
              viewerRsvp={detail.viewerRsvp}
              onSelectAwaitingName={handleSelectAwaitingName}
            />

            {/* Flat Hairline Section: Activity Wall */}
            <EventWall
              eventId={event.id}
              comments={detail.comments}
              isHost={detail.isHost}
              editKey={editKey}
              guestToken={guestToken}
              defaultAuthorName={detail.viewerRsvp?.guestName ?? rsvpGuestName}
              viewerRsvpStatus={detail.viewerRsvp?.status}
              onCommentsChange={handleCommentsChange}
              onRefreshDetail={() => refreshDetail()}
            />

            {/* Mobile Hosted By Section */}
            {event.hostName ? (
              <section className="lg:hidden space-y-3">
                <h2
                  className="text-sm font-medium pb-2 border-b"
                  style={{
                    color: 'var(--theme-text-muted)',
                    borderColor: 'var(--theme-hairline)',
                    fontFamily: 'var(--font-invite-display), var(--font-invite-body), sans-serif',
                  }}
                >
                  Hosted By
                </h2>
                <div className="flex items-center gap-2.5">
                  <GuestAvatar name={event.hostName} size="sm" />
                  <span
                    className="text-sm font-medium truncate"
                    style={{ color: 'var(--theme-text-primary)' }}
                  >
                    {event.hostName}
                  </span>
                </div>
              </section>
            ) : null}
          </div>
        </div>
      </main>

      {/* Quiet minimal footer */}
      <footer
        className="relative z-10 max-w-[480px] lg:max-w-[920px] mx-auto px-4 lg:px-8 pt-6 pb-10 border-t flex items-center justify-between gap-4 text-xs"
        style={{
          borderColor: 'var(--theme-hairline)',
          color: 'var(--theme-text-muted)',
        }}
      >
        <span className="font-semibold tracking-tight">invited</span>
        <Link href="/create" className="hover:underline inline-flex items-center gap-1">
          <span>Create a free invite</span>
          <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
        </Link>
      </footer>
    </div>
  );
}
