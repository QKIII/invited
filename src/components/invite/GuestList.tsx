'use client';

import { useState } from 'react';
import { Check, Lock, Users, Utensils, X } from 'lucide-react';
import type { EventDetailResponse, EventMeta, RsvpRecord } from '@/types/invite';

type GuestTab = 'yes' | 'no' | 'awaiting';

interface GuestListProps {
  event: EventMeta;
  rsvps: EventDetailResponse['rsvps'];
  isHost: boolean;
  viewerRsvp?: RsvpRecord;
  onSelectAwaitingName: (name: string) => void;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function GuestList({
  event,
  rsvps,
  isHost,
  viewerRsvp,
  onSelectAwaitingName,
}: GuestListProps) {
  const [activeTab, setActiveTab] = useState<GuestTab>('yes');

  const isPrivateForViewer = event.hideGuestList && !isHost;

  const availableTabs: Array<{ id: GuestTab; label: string; count: number }> = [
    { id: 'yes', label: 'Coming', count: rsvps.totalHeadcount },
    { id: 'no', label: "Can't Make It", count: rsvps.no.length },
    ...(rsvps.awaitingNames.length > 0
      ? [{ id: 'awaiting' as const, label: 'Awaiting Reply', count: rsvps.awaitingNames.length }]
      : []),
  ];

  const resolvedTab: GuestTab =
    activeTab === 'awaiting' && rsvps.awaitingNames.length === 0 ? 'yes' : activeTab;

  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const delta = e.key === 'ArrowRight' ? 1 : -1;
      const nextIndex = (index + delta + availableTabs.length) % availableTabs.length;
      setActiveTab(availableTabs[nextIndex].id);
    }
  };

  return (
    <section
      aria-labelledby="guest-list-heading"
      className="invite-card rounded-2xl border p-5 sm:p-6 space-y-4"
      style={{
        backgroundColor: 'var(--theme-surface-bg)',
        borderColor: 'var(--theme-border)',
      }}
    >
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <h2
            id="guest-list-heading"
            className="text-xl font-semibold tracking-tight flex items-center gap-2"
            style={{ fontFamily: 'var(--theme-font-heading)' }}
          >
            <Users className="h-5 w-5" style={{ color: 'var(--theme-accent)' }} aria-hidden="true" />
            <span>Guest List</span>
          </h2>
          {event.hideGuestList && isHost && (
            <span
              className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium"
              style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-muted)' }}
            >
              <Lock className="h-3 w-3" aria-hidden="true" />
              Hidden from guests
            </span>
          )}
        </div>

        {!isPrivateForViewer && (
          <p className="text-sm font-medium" style={{ color: 'var(--theme-text-muted)' }}>
            <span className="font-semibold" style={{ color: 'var(--theme-text-primary)' }}>
              {rsvps.totalHeadcount} Going
            </span>
            {' · '}
            <span>{rsvps.no.length} Not Coming</span>
            {rsvps.awaitingNames.length > 0 && (
              <>
                {' · '}
                <span>{rsvps.awaitingNames.length} Awaiting Reply</span>
              </>
            )}
          </p>
        )}
      </div>

      {isPrivateForViewer ? (
        <div
          className="rounded-xl border p-4 flex items-start gap-3 text-sm"
          style={{
            backgroundColor: 'var(--theme-card-bg)',
            borderColor: 'var(--theme-border)',
          }}
        >
          <Lock
            className="h-4 w-4 mt-0.5 shrink-0"
            style={{ color: 'var(--theme-accent)' }}
            aria-hidden="true"
          />
          <div className="space-y-1">
            <p className="font-medium">
              Guest list is kept private by the host — {rsvps.totalHeadcount} attending so far.
            </p>
            {viewerRsvp && (
              <p style={{ color: 'var(--theme-text-muted)' }}>
                Your response ({viewerRsvp.status === 'yes' ? 'Coming' : "Can't make it"}) is
                saved.
              </p>
            )}
          </div>
        </div>
      ) : (
        <>
          <div
            role="tablist"
            aria-label="Guest list sections"
            className="flex flex-wrap gap-1.5 rounded-xl border p-1"
            style={{
              backgroundColor: 'var(--theme-card-bg)',
              borderColor: 'var(--theme-border)',
            }}
          >
            {availableTabs.map((tab, idx) => {
              const selected = resolvedTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`guest-tab-${tab.id}`}
                  role="tab"
                  type="button"
                  aria-selected={selected}
                  aria-controls={`guest-tabpanel-${tab.id}`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setActiveTab(tab.id)}
                  onKeyDown={(e) => handleTabKeyDown(e, idx)}
                  className={`flex-1 min-w-[105px] rounded-lg px-3 py-2 text-xs sm:text-sm font-medium min-h-[44px] transition-colors cursor-pointer ${
                    selected ? 'invite-on-accent font-semibold' : 'hover:opacity-80'
                  }`}
                  style={{
                    backgroundColor: selected ? 'var(--theme-accent)' : 'transparent',
                    color: selected ? undefined : 'var(--theme-text-muted)',
                  }}
                >
                  <span>{tab.label}</span>{' '}
                  <span className="opacity-85 tabular-nums">({tab.count})</span>
                </button>
              );
            })}
          </div>

          {resolvedTab === 'yes' && (
            <div
              id="guest-tabpanel-yes"
              role="tabpanel"
              aria-labelledby="guest-tab-yes"
              className="space-y-2.5"
            >
              {rsvps.yes.length === 0 ? (
                <p
                  className="rounded-xl border border-dashed p-5 text-center text-sm"
                  style={{
                    borderColor: 'var(--theme-border)',
                    color: 'var(--theme-text-muted)',
                  }}
                >
                  No responses yet — be the first to RSVP!
                </p>
              ) : (
                <ul className="space-y-2.5">
                  {rsvps.yes.map((guest) => {
                    const isViewer = viewerRsvp?.id === guest.id;
                    return (
                      <li
                        key={guest.id}
                        className="rounded-xl border p-3.5 flex items-start gap-3"
                        style={{
                          backgroundColor: 'var(--theme-card-bg)',
                          borderColor: isViewer
                            ? 'var(--theme-accent)'
                            : 'var(--theme-border)',
                        }}
                      >
                        <span
                          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                          style={{
                            backgroundColor:
                              'color-mix(in srgb, var(--theme-accent) 20%, var(--theme-surface-bg))',
                            color: 'var(--theme-text-primary)',
                          }}
                          aria-hidden="true"
                        >
                          {getInitials(guest.guestName)}
                        </span>

                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-sm sm:text-base truncate">
                              {guest.guestName}
                            </span>
                            <span
                              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                              style={{
                                backgroundColor:
                                  'color-mix(in srgb, var(--theme-accent) 16%, transparent)',
                              }}
                            >
                              <Check className="h-3 w-3" aria-hidden="true" />
                              Going
                            </span>
                            {guest.plusOnes > 0 && (
                              <span
                                className="rounded-full border px-2 py-0.5 text-xs font-semibold tabular-nums"
                                style={{ borderColor: 'var(--theme-border)' }}
                              >
                                +{guest.plusOnes}
                              </span>
                            )}
                            {isViewer && (
                              <span
                                className="text-xs font-medium"
                                style={{ color: 'var(--theme-accent)' }}
                              >
                                (You)
                              </span>
                            )}
                          </div>

                          {guest.bringingNote && (
                            <div
                              className="inline-flex items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs sm:text-sm"
                              style={{
                                borderColor: 'var(--theme-border)',
                                backgroundColor: 'var(--theme-surface-bg)',
                                color: 'var(--theme-text-primary)',
                              }}
                            >
                              <Utensils
                                className="h-3.5 w-3.5 mt-0.5 shrink-0"
                                style={{ color: 'var(--theme-accent)' }}
                                aria-hidden="true"
                              />
                              <span className="break-words">&ldquo;{guest.bringingNote}&rdquo;</span>
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {resolvedTab === 'no' && (
            <div
              id="guest-tabpanel-no"
              role="tabpanel"
              aria-labelledby="guest-tab-no"
              className="space-y-2.5"
            >
              {rsvps.no.length === 0 ? (
                <p
                  className="rounded-xl border border-dashed p-5 text-center text-sm"
                  style={{
                    borderColor: 'var(--theme-border)',
                    color: 'var(--theme-text-muted)',
                  }}
                >
                  Everyone who replied is coming so far!
                </p>
              ) : (
                <ul className="space-y-2.5">
                  {rsvps.no.map((guest) => (
                    <li
                      key={guest.id}
                      className="rounded-xl border p-3.5 flex items-start gap-3"
                      style={{
                        backgroundColor: 'var(--theme-card-bg)',
                        borderColor: 'var(--theme-border)',
                      }}
                    >
                      <span
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold opacity-75"
                        style={{
                          backgroundColor: 'var(--theme-surface-bg)',
                          color: 'var(--theme-text-muted)',
                        }}
                        aria-hidden="true"
                      >
                        {getInitials(guest.guestName)}
                      </span>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-sm sm:text-base">
                            {guest.guestName}
                          </span>
                          <span
                            className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
                            style={{
                              borderColor: 'var(--theme-border)',
                              color: 'var(--theme-text-muted)',
                            }}
                          >
                            <X className="h-3 w-3" aria-hidden="true" />
                            Can&apos;t make it
                          </span>
                        </div>
                        {guest.bringingNote && (
                          <p
                            className="text-xs sm:text-sm break-words"
                            style={{ color: 'var(--theme-text-muted)' }}
                          >
                            &ldquo;{guest.bringingNote}&rdquo;
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {resolvedTab === 'awaiting' && rsvps.awaitingNames.length > 0 && (
            <div
              id="guest-tabpanel-awaiting"
              role="tabpanel"
              aria-labelledby="guest-tab-awaiting"
              className="space-y-3"
            >
              <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                Invited guests who haven&apos;t replied yet. Tap your name to pre-fill your RSVP:
              </p>
              <div className="flex flex-wrap gap-2">
                {rsvps.awaitingNames.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => onSelectAwaitingName(name)}
                    className="rounded-full border px-3.5 py-2 text-sm font-medium min-h-[44px] transition-colors hover:opacity-85 cursor-pointer"
                    style={{
                      backgroundColor: 'var(--theme-card-bg)',
                      borderColor: 'var(--theme-border)',
                    }}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
