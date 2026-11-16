'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  Calendar,
  ChevronDown,
  Clock,
  ExternalLink,
  MapPin,
  Share2,
  Video,
} from 'lucide-react';
import { CoverArt } from '@/components/covers/CoverArt';
import { AmbientBackdrop } from '@/components/effects/AmbientBackdrop';
import { InviteIcon } from '@/components/icons/InviteIcons';
import { RecentEventsDialog } from '@/components/studio/RecentEventsDialog';
import {
  getCachedGuestRsvp,
  getSavedGuestToken,
  saveCachedGuestRsvp,
} from '@/lib/client/deviceProfile';
import {
  getSavedHostKey,
  rememberHostEvent,
  rememberVisitedEvent,
  saveHostKey,
} from '@/lib/client/recentEvents';
import { useThemeViewportSync } from '@/lib/client/useThemeViewportSync';
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
  const [recentOpen, setRecentOpen] = useState<boolean>(false);
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

  const event = detail.event;
  const themeVars = useMemo(
    () => resolveThemeCssVars(event.style),
    [event.style],
  );
  const backdropMode =
    themeVars['--theme-backdrop-mode'] === 'light' ? 'light' : 'dark';

  useThemeViewportSync(themeVars['--theme-page-bg'], backdropMode);

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
    setTimeout(() => {
      rsvpNameInputRef.current?.focus();
    }, 120);
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
      // User dismissed native share sheet
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

  const hasCover = event.style.coverLayout !== 'none';

  return (
    <div
      style={{
        ...(themeVars as React.CSSProperties),
        backgroundColor: 'var(--theme-page-bg)',
        color: 'var(--theme-text-primary)',
        fontFamily: 'var(--font-invite-body), var(--font-sans), sans-serif',
      }}
      className="min-h-dvh relative overflow-x-hidden"
    >
      <AmbientBackdrop
        fixedViewport
        effectId={event.style.effectId}
        pageBg={themeVars['--theme-page-bg']}
        accentColor={themeVars['--theme-accent']}
        secondaryColor={themeVars['--theme-cta-end']}
        colorMode={backdropMode}
        className="z-0"
      />

      {/* Compact single-row top bar */}
      <header className="relative z-10 app-top-bar h-12 max-w-[580px] mx-auto flex items-center justify-between gap-2">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-semibold tracking-tight hover:opacity-80 transition shrink-0"
          style={{ color: 'var(--theme-outer-text)' }}
        >
          <InviteIcon name="brand" className="h-4 w-4" />
          <span>invited</span>
        </Link>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setRecentOpen(true)}
            className="h-8 inline-flex items-center gap-1.5 rounded-full border px-3 text-xs font-medium backdrop-blur-md transition hover:opacity-90 cursor-pointer"
            style={{
              backgroundColor: 'var(--theme-outer-pill-bg)',
              borderColor: 'var(--theme-outer-pill-border)',
              color: 'var(--theme-outer-text)',
            }}
          >
            <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>My Invites</span>
          </button>

          {activeEditHref ? (
            <Link
              href={activeEditHref}
              className="invite-cta-btn h-8 inline-flex items-center gap-1 rounded-full px-3 text-xs font-semibold shadow-sm hover:opacity-95 transition"
            >
              <span>Edit invite</span>
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          ) : null}
        </div>
      </header>

      <main className="relative z-10 max-w-[580px] mx-auto px-3.5 sm:px-6 pt-1.5 pb-28 space-y-4">
        {/* Primary Uncluttered Frosted-Glass Invitation Card */}
        <article
          className="invite-glass-card rounded-3xl border overflow-hidden"
          style={{
            borderColor: 'var(--theme-border)',
          }}
        >
          {hasCover ? (
            <CoverArt
              flushTop
              coverPresetId={event.style.coverPresetId}
              customCoverUrl={event.style.customCoverUrl}
              layout={event.style.coverLayout === 'square' ? 'square' : 'banner'}
              title={event.title}
              accentColor={themeVars['--theme-accent']}
              className="w-full"
            />
          ) : null}

          <div className="p-5 sm:p-7 space-y-5">
            {/* Title + Date Badge Lockup */}
            <header className="flex items-start gap-3.5">
              <CalendarDateTile
                startIso={event.startIso}
                timeZone={event.timeZone}
                size="md"
              />
              <div className="min-w-0 flex-1 space-y-1">
                <h1
                  className="text-[24px] sm:text-[30px] font-bold leading-[1.15] tracking-tight [text-wrap:balance] break-words"
                  style={{
                    color: 'var(--theme-text-primary)',
                    fontFamily: 'var(--font-invite-display), var(--font-invite-body), sans-serif',
                  }}
                >
                  {event.title}
                </h1>
                {event.hostName ? (
                  <div className="flex items-center gap-2 pt-0.5">
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
            </header>

            {/* When & Where */}
            <div
              className="pt-4 border-t space-y-3"
              style={{ borderColor: 'var(--theme-hairline)' }}
            >
              {/* Date / Time + Popover Calendar Menu */}
              <div>
                <button
                  type="button"
                  popoverTarget="calendar-menu"
                  className="w-full flex items-center gap-3 text-left group cursor-pointer"
                >
                  <div
                    aria-hidden="true"
                    className="h-9 w-9 rounded-full flex items-center justify-center shrink-0"
                    style={{
                      backgroundColor: 'var(--theme-surface-bg)',
                      color: 'var(--theme-text-muted)',
                    }}
                  >
                    <Clock className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className="text-sm sm:text-[15px] font-semibold leading-snug group-hover:underline break-words"
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
                        className="text-xs leading-snug break-words mt-0.5 opacity-85"
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
                  className="popover-reveal m-auto rounded-2xl border p-2 shadow-2xl w-[min(18rem,calc(100%-2rem))] backdrop-blur-xl"
                  style={{
                    backgroundColor: 'var(--theme-card-solid, var(--theme-surface-bg))',
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
                      className="flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm hover:opacity-80 transition"
                    >
                      <span>Google Calendar</span>
                      <ExternalLink className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />
                    </a>
                  ) : null}
                  <a
                    href={`/api/events/${event.id}/ics`}
                    className="flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm hover:opacity-80 transition"
                  >
                    <span>Apple / iCal (.ics)</span>
                    <Calendar className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />
                  </a>
                  {calendarUrls ? (
                    <a
                      href={calendarUrls.outlookUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm hover:opacity-80 transition"
                    >
                      <span>Outlook</span>
                      <ExternalLink className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />
                    </a>
                  ) : null}
                </div>
              </div>

              {/* Single Deduplicated Location Row + Optional Collapsible Map */}
              {heroLocation.primaryLocation || heroLocation.secondaryAddress ? (
                <div data-testid="hero-location" className="space-y-2">
                  {mapsUrl ? (
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 group"
                    >
                      <div
                        aria-hidden="true"
                        className="h-9 w-9 rounded-full flex items-center justify-center shrink-0"
                        style={{
                          backgroundColor: 'var(--theme-surface-bg)',
                          color: 'var(--theme-text-muted)',
                        }}
                      >
                        <MapPin className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          className="text-sm sm:text-[15px] font-semibold leading-snug group-hover:underline break-words"
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
                    <div className="flex items-center gap-3">
                      <div
                        aria-hidden="true"
                        className="h-9 w-9 rounded-full flex items-center justify-center shrink-0"
                        style={{
                          backgroundColor: 'var(--theme-surface-bg)',
                          color: 'var(--theme-text-muted)',
                        }}
                      >
                        <MapPin className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          className="text-sm sm:text-[15px] font-semibold leading-snug break-words"
                          style={{ color: 'var(--theme-text-primary)' }}
                        >
                          {heroLocation.primaryLocation || heroLocation.secondaryAddress}
                        </p>
                      </div>
                    </div>
                  )}

                  {mapQuery && mapsUrl ? (
                    <details data-testid="location-section" className="group pl-12">
                      <summary
                        className="inline-flex items-center gap-1 text-xs font-medium cursor-pointer list-none opacity-80 hover:opacity-100"
                        style={{ color: 'var(--theme-accent)' }}
                      >
                        <span>Show map</span>
                        <ChevronDown
                          className="h-3.5 w-3.5 transition-transform group-open:rotate-180"
                          aria-hidden="true"
                        />
                      </summary>
                      <div
                        className="mt-2 rounded-2xl overflow-hidden border h-40 sm:h-44"
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
                      </div>
                    </details>
                  ) : null}
                </div>
              ) : null}

              {/* Virtual Event Link */}
              {safeVirtualUrl ? (
                <a
                  href={safeVirtualUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 group"
                >
                  <div
                    aria-hidden="true"
                    className="h-9 w-9 rounded-full flex items-center justify-center shrink-0"
                    style={{
                      backgroundColor: 'var(--theme-surface-bg)',
                      color: 'var(--theme-text-muted)',
                    }}
                  >
                    <Video className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className="text-sm sm:text-[15px] font-semibold leading-snug group-hover:underline truncate"
                      style={{ color: 'var(--theme-text-primary)' }}
                    >
                      Join Online ↗
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

            {/* Event Description */}
            {hasMeaningfulDescription ? (
              <div
                className="pt-4 border-t"
                style={{ borderColor: 'var(--theme-hairline)' }}
              >
                <SafeRichHtml
                  html={event.descriptionHtml}
                  className="invite-prose text-[15px] leading-relaxed"
                />
              </div>
            ) : null}
          </div>
        </article>

        {/* Guests Card */}
        <GuestList
          event={event}
          rsvps={detail.rsvps}
          isHost={detail.isHost}
          viewerRsvp={detail.viewerRsvp}
          onSelectAwaitingName={handleSelectAwaitingName}
        />

        {/* Comments Card */}
        <EventWall
          eventId={event.id}
          hostName={event.hostName}
          comments={detail.comments}
          isHost={detail.isHost}
          editKey={editKey}
          guestToken={guestToken}
          defaultAuthorName={detail.viewerRsvp?.guestName ?? rsvpGuestName}
          viewerRsvpStatus={detail.viewerRsvp?.status}
          onCommentsChange={handleCommentsChange}
          onRefreshDetail={() => refreshDetail()}
        />

        {/* Minimal Quiet Footer Links */}
        <footer
          className="pt-1 pb-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs font-medium"
          style={{ color: 'var(--theme-outer-muted)' }}
        >
          <SubscribeControl
            eventId={event.id}
            eventTitle={event.title}
            subscriberCount={detail.subscriberCount}
            viewerSubscription={detail.viewerSubscription}
            openSignal={subscribeSignal}
            onSubscribed={() => void refreshDetail()}
            variant="link"
          />
          <span aria-hidden="true">·</span>
          <button
            type="button"
            onClick={() => void handleShareInvite()}
            className="inline-flex items-center gap-1 hover:underline cursor-pointer"
          >
            <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{shareCopied ? 'Link copied!' : 'Share'}</span>
          </button>
          <span aria-hidden="true">·</span>
          <Link href="/create" className="inline-flex items-center gap-1 hover:underline">
            <span>Create a free invite</span>
            <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
          </Link>
        </footer>
      </main>

      {/* Fixed Sticky Bottom RSVP Bar & Native Modal Dialog Sheet */}
      <RsvpPanel
        event={event}
        awaitingNames={detail.rsvps.awaitingNames}
        viewerRsvp={detail.viewerRsvp}
        viewerSubscription={detail.viewerSubscription}
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

      <RecentEventsDialog open={recentOpen} onClose={() => setRecentOpen(false)} />
    </div>
  );
}
