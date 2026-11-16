'use client';

import React, { useId, useState } from 'react';
import { Lock } from 'lucide-react';
import type { EventDetailResponse, EventMeta, RsvpRecord } from '@/types/invite';
import { GuestAvatar } from './GuestAvatar';

interface GuestListProps {
  event: EventMeta;
  rsvps: EventDetailResponse['rsvps'];
  isHost: boolean;
  viewerRsvp?: RsvpRecord;
  onSelectAwaitingName: (name: string) => void;
}

type GuestTab = 'yes' | 'no' | 'awaiting';

export function GuestList({
  event,
  rsvps,
  isHost,
  viewerRsvp,
  onSelectAwaitingName,
}: GuestListProps) {
  const headingId = useId();
  const [activeTab, setActiveTab] = useState<GuestTab>('yes');

  const isPrivateForViewer = event.hideGuestList && !isHost;
  const hasAnyGuestActivity =
    rsvps.yes.length > 0 || rsvps.no.length > 0 || rsvps.awaitingNames.length > 0;
  const normalizedHost = event.hostName?.trim().toLowerCase() || '';

  if (!isPrivateForViewer && !hasAnyGuestActivity) {
    return null;
  }

  if (isPrivateForViewer) {
    return (
      <section
        aria-labelledby={headingId}
        className="invite-glass-card rounded-3xl border p-5 sm:p-6 space-y-3"
        style={{
          borderColor: 'var(--theme-border)',
        }}
      >
        <div
          className="flex items-center justify-between gap-2 pb-2.5 border-b"
          style={{ borderColor: 'var(--theme-hairline)' }}
        >
          <h2
            id={headingId}
            className="text-base font-bold flex items-center gap-1.5"
            style={{
              color: 'var(--theme-text-primary)',
              fontFamily: 'var(--font-invite-display), var(--font-invite-body), sans-serif',
            }}
          >
            <Lock className="h-4 w-4 shrink-0 opacity-75" aria-hidden="true" />
            <span>Guests</span>
          </h2>
          <span className="text-xs font-semibold" style={{ color: 'var(--theme-text-muted)' }}>
            {rsvps.totalHeadcount} Going
          </span>
        </div>

        <p className="text-sm leading-relaxed" style={{ color: 'var(--theme-text-muted)' }}>
          Guest list is kept private by the host — {rsvps.totalHeadcount} attending so far.
        </p>

        {viewerRsvp ? (
          <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
            Your RSVP: {viewerRsvp.status === 'yes' ? 'Going' : "Can't make it"}
            {viewerRsvp.plusOnes > 0 ? ` (+${viewerRsvp.plusOnes})` : ''}
            {viewerRsvp.bringingNote ? ` · ${viewerRsvp.bringingNote}` : ''}
          </p>
        ) : null}
      </section>
    );
  }

  const showNoTab = rsvps.no.length > 0;
  const showAwaitingTab = rsvps.awaitingNames.length > 0;
  const safeTab: GuestTab =
    activeTab === 'no' && !showNoTab
      ? 'yes'
      : activeTab === 'awaiting' && !showAwaitingTab
        ? 'yes'
        : activeTab;

  return (
    <section
      aria-labelledby={headingId}
      className="invite-glass-card rounded-3xl border p-5 sm:p-6 space-y-3.5"
      style={{
        borderColor: 'var(--theme-border)',
      }}
    >
      <div
        className="flex items-center justify-between gap-3 pb-2.5 border-b"
        style={{ borderColor: 'var(--theme-hairline)' }}
      >
        <h2
          id={headingId}
          className="text-base font-bold"
          style={{
            color: 'var(--theme-text-primary)',
            fontFamily: 'var(--font-invite-display), var(--font-invite-body), sans-serif',
          }}
        >
          {rsvps.totalHeadcount} Going
        </h2>

        {rsvps.yes.length > 0 ? (
          <div className="flex items-center -space-x-1.5 shrink-0" aria-hidden="true">
            {rsvps.yes.slice(0, 5).map((entry) => (
              <GuestAvatar
                key={entry.id}
                name={entry.guestName}
                size="xs"
                className="ring-1 ring-black/20"
              />
            ))}
            {rsvps.yes.length > 5 ? (
              <span
                className="inline-flex h-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold"
                style={{
                  backgroundColor: 'var(--theme-surface-bg)',
                  color: 'var(--theme-text-muted)',
                }}
              >
                +{rsvps.yes.length - 5}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {(showNoTab || showAwaitingTab) && (
        <div role="tablist" aria-label="Guest attendance lists" className="flex flex-wrap gap-1.5">
          <button
            id="guest-tab-yes"
            role="tab"
            type="button"
            aria-selected={safeTab === 'yes'}
            aria-controls="guest-panel-yes"
            onClick={() => setActiveTab('yes')}
            className="rounded-full px-3 py-1 text-xs font-medium border transition cursor-pointer"
            style={
              safeTab === 'yes'
                ? {
                    backgroundColor: 'var(--theme-accent)',
                    borderColor: 'var(--theme-accent)',
                    color: 'var(--theme-on-accent)',
                  }
                : {
                    backgroundColor: 'transparent',
                    borderColor: 'var(--theme-hairline)',
                    color: 'var(--theme-text-muted)',
                  }
            }
          >
            {rsvps.totalHeadcount} Going
          </button>

          {showNoTab ? (
            <button
              id="guest-tab-no"
              role="tab"
              type="button"
              aria-selected={safeTab === 'no'}
              aria-controls="guest-panel-no"
              onClick={() => setActiveTab('no')}
              className="rounded-full px-3 py-1 text-xs font-medium border transition cursor-pointer"
              style={
                safeTab === 'no'
                  ? {
                      backgroundColor: 'var(--theme-accent)',
                      borderColor: 'var(--theme-accent)',
                      color: 'var(--theme-on-accent)',
                    }
                  : {
                      backgroundColor: 'transparent',
                      borderColor: 'var(--theme-hairline)',
                      color: 'var(--theme-text-muted)',
                    }
              }
            >
              {rsvps.no.length} Not coming
            </button>
          ) : null}

          {showAwaitingTab ? (
            <button
              id="guest-tab-awaiting"
              role="tab"
              type="button"
              aria-selected={safeTab === 'awaiting'}
              aria-controls="guest-panel-awaiting"
              onClick={() => setActiveTab('awaiting')}
              className="rounded-full px-3 py-1 text-xs font-medium border transition cursor-pointer"
              style={
                safeTab === 'awaiting'
                  ? {
                      backgroundColor: 'var(--theme-accent)',
                      borderColor: 'var(--theme-accent)',
                      color: 'var(--theme-on-accent)',
                    }
                  : {
                      backgroundColor: 'transparent',
                      borderColor: 'var(--theme-hairline)',
                      color: 'var(--theme-text-muted)',
                    }
              }
            >
              {rsvps.awaitingNames.length} Waiting on
            </button>
          ) : null}
        </div>
      )}

      {safeTab === 'yes' ? (
        <div
          id="guest-panel-yes"
          role="tabpanel"
          aria-labelledby={showNoTab || showAwaitingTab ? 'guest-tab-yes' : undefined}
        >
          {rsvps.yes.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--theme-text-muted)' }}>
              Be the first to RSVP.
            </p>
          ) : (
            <ul className="divide-y" style={{ borderColor: 'var(--theme-hairline)' }}>
              {rsvps.yes.map((guest) => (
                <li
                  key={guest.id}
                  className="py-2.5 flex items-start justify-between gap-3"
                  style={{ borderColor: 'var(--theme-hairline)' }}
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <GuestAvatar name={guest.guestName} size="sm" className="mt-0.5" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className="text-sm font-medium break-words"
                          style={{ color: 'var(--theme-text-primary)' }}
                        >
                          {guest.guestName}
                        </span>
                        {normalizedHost && guest.guestName.trim().toLowerCase() === normalizedHost ? (
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                            style={{
                              backgroundColor: 'var(--theme-surface-bg)',
                              color: 'var(--theme-accent)',
                            }}
                          >
                            Host
                          </span>
                        ) : null}
                        {guest.plusOnes > 0 ? (
                          <span
                            className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                            style={{
                              backgroundColor: 'var(--theme-surface-bg)',
                              color: 'var(--theme-text-muted)',
                            }}
                          >
                            +{guest.plusOnes}
                          </span>
                        ) : null}
                      </div>
                      {guest.bringingNote ? (
                        <p
                          className="text-xs leading-relaxed break-words mt-0.5"
                          style={{ color: 'var(--theme-text-muted)' }}
                        >
                          {guest.bringingNote}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {safeTab === 'no' ? (
        <div id="guest-panel-no" role="tabpanel" aria-labelledby="guest-tab-no">
          <ul className="divide-y" style={{ borderColor: 'var(--theme-hairline)' }}>
            {rsvps.no.map((guest) => (
              <li
                key={guest.id}
                className="py-2.5 flex items-start gap-2.5"
                style={{ borderColor: 'var(--theme-hairline)' }}
              >
                <GuestAvatar name={guest.guestName} size="sm" className="mt-0.5 opacity-75" />
                <div className="min-w-0">
                  <p
                    className="text-sm font-medium break-words"
                    style={{ color: 'var(--theme-text-primary)' }}
                  >
                    {guest.guestName}
                  </p>
                  {guest.bringingNote ? (
                    <p
                      className="text-xs leading-relaxed break-words mt-0.5"
                      style={{ color: 'var(--theme-text-muted)' }}
                    >
                      {guest.bringingNote}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {safeTab === 'awaiting' ? (
        <div
          id="guest-panel-awaiting"
          role="tabpanel"
          aria-labelledby="guest-tab-awaiting"
          className="space-y-2"
        >
          <div className="flex flex-wrap gap-2">
            {rsvps.awaitingNames.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => onSelectAwaitingName(name)}
                className="rounded-full border px-3 py-1 text-xs font-medium transition hover:opacity-90 cursor-pointer"
                style={{
                  backgroundColor: 'var(--theme-surface-bg)',
                  borderColor: 'var(--theme-hairline)',
                  color: 'var(--theme-text-primary)',
                }}
              >
                {name}
              </button>
            ))}
          </div>
          <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
            Tap your name to jump straight to RSVP.
          </p>
        </div>
      ) : null}
    </section>
  );
}
