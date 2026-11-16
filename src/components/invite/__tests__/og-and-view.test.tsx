import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InviteView } from '@/components/invite/InviteView';
import { getRecentEvents } from '@/lib/client/recentEvents';
import { COVER_PRESETS, getThemePreset } from '@/lib/themes/presets';
import type { EventDetailResponse, EventMeta } from '@/types/invite';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function buildDetail(overrides: Partial<EventDetailResponse> = {}): EventDetailResponse {
  const event: EventMeta = {
    id: 'evt_xmas1',
    title: 'Christmas Eve Candlelight & Cocoa',
    descriptionHtml: '<p>Bring your favorite <strong>holiday cookies</strong>!</p>',
    startIso: '2026-12-24T19:00:00',
    endIso: '2026-12-24T22:00:00',
    timeZone: 'America/New_York',
    locationName: '42 Maple St',
    locationAddress: 'Brooklyn, NY',
    virtualUrl: 'https://meet.example.com/holiday',
    hostName: 'Clara',
    rsvpNotePrompt: 'What treat are you bringing?',
    invitedNames: ['Sam', 'Jordan'],
    hideGuestList: false,
    style: {
      themeId: 'cozy-christmas',
      fontId: 'editorial-serif',
      effectId: 'christmas-lights',
      coverPresetId: 'christmas-tree',
      coverLayout: 'square',
    },
    createdAt: '2026-11-15T12:00:00Z',
    updatedAt: '2026-11-15T12:00:00Z',
  };

  return {
    event,
    rsvps: {
      yes: [],
      no: [],
      totalHeadcount: 4,
      awaitingNames: ['Sam', 'Jordan'],
    },
    comments: [],
    subscriberCount: 2,
    isHost: false,
    ...overrides,
  };
}

describe('InviteView (post-merge integration)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('renders InviteView with cover art, popover calendar menu, maps link, virtual link, host pill, and records My Events', async () => {
    const OrigDateTimeFormat = Intl.DateTimeFormat;
    const DateTimeFormatMock = function (
      this: unknown,
      locales?: string | string[],
      options?: Intl.DateTimeFormatOptions,
    ) {
      const fmt = new OrigDateTimeFormat(locales, options);
      if (locales === undefined && options === undefined) {
        const origResolved = fmt.resolvedOptions.bind(fmt);
        fmt.resolvedOptions = () => ({
          ...origResolved(),
          timeZone: 'America/Los_Angeles',
        });
      }
      return fmt;
    } as unknown as typeof Intl.DateTimeFormat;
    DateTimeFormatMock.supportedLocalesOf = OrigDateTimeFormat.supportedLocalesOf;
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(DateTimeFormatMock);

    const detail = buildDetail({ isHost: true });
    const container = document.createElement('div');
    document.body.appendChild(container);
    let root: Root;

    await act(async () => {
      root = createRoot(container);
      root.render(
        <InviteView
          initialDetail={detail}
          initialEditKey="secret_edit_key_123"
          initialFormattedDate={{
            dateLabel: 'Thu, Dec 24, 2026',
            timeLabel: '7:00 PM – 10:00 PM EST',
            fullLabel: 'Thu, Dec 24, 2026 · 7:00 PM – 10:00 PM EST',
            viewerTimeLabel: 'Thu, Dec 24, 2026 · 4:00 PM – 7:00 PM PST (your time)',
            timeZoneName: 'EST',
            isMultiDay: false,
          }}
        />,
      );
    });

    await vi.waitFor(
      async () => {
        await act(async () => {
          await new Promise((r) => setTimeout(r, 20));
        });
        expect(
          container.querySelector('a[href^="https://calendar.google.com/calendar/render"]'),
        ).not.toBeNull();
      },
      { timeout: 5000 },
    );

    expect(container.textContent).toContain('Christmas Eve Candlelight & Cocoa');
    expect(container.textContent).toContain('Hosted by Clara');
    expect(container.textContent).toContain('My Invites');
    expect(container.textContent).toContain('Edit invite');
    expect(container.textContent).toContain('4:00 PM – 7:00 PM PST (your time)');
    expect(container.textContent).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
    expect(container.querySelector('[data-testid="sticky-rsvp-footer"]')).not.toBeNull();
    expect(container.querySelector('iframe[src^="https://maps.google.com/maps?"]')).not.toBeNull();

    const dateTile = container.querySelector('[data-testid="calendar-date-tile"]');
    expect(dateTile?.textContent).toBe('DEC24');

    const editLink = container.querySelector('a[href^="/e/evt_xmas1/edit"]');
    expect(editLink?.getAttribute('href')).toBe(
      '/e/evt_xmas1/edit?key=secret_edit_key_123',
    );

    const calMenu = container.querySelector('#calendar-menu');
    expect(calMenu?.getAttribute('popover')).toBe('auto');
    const calBtn = container.querySelector('button[popovertarget="calendar-menu"]');
    expect(calBtn).not.toBeNull();

    expect(
      container.querySelector('a[href="/api/events/evt_xmas1/ics"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('a[href^="https://calendar.google.com/calendar/render"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('a[href^="https://outlook.live.com/calendar/0/action/compose"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('a[href^="https://www.google.com/maps/search/"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('a[href="https://meet.example.com/holiday"]'),
    ).not.toBeNull();
    expect(container.textContent?.toLowerCase()).not.toContain('maybe');

    const recent = getRecentEvents();
    expect(recent).toHaveLength(1);
    expect(recent[0]).toMatchObject({
      id: 'evt_xmas1',
      role: 'host',
      editKey: 'secret_edit_key_123',
    });

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('collapses duplicate locationAddress when identical to locationName', async () => {
    const base = buildDetail();
    const detail = buildDetail({
      event: {
        ...base.event,
        locationName: '42 Maple St',
        locationAddress: '42 Maple St',
        virtualUrl: undefined,
      },
    });
    const container = document.createElement('div');
    document.body.appendChild(container);
    let root: Root;

    await act(async () => {
      root = createRoot(container);
      root.render(
        <InviteView
          initialDetail={detail}
          initialFormattedDate={{
            dateLabel: 'Thu, Dec 24, 2026',
            timeLabel: '7:00 PM – 10:00 PM EST',
            fullLabel: 'Thu, Dec 24, 2026 · 7:00 PM – 10:00 PM EST',
            timeZoneName: 'EST',
            isMultiDay: false,
          }}
        />,
      );
    });

    await vi.waitFor(
      async () => {
        await act(async () => {
          await new Promise((r) => setTimeout(r, 20));
        });
        expect(
          container.querySelector('a[href^="https://calendar.google.com/calendar/render"]'),
        ).not.toBeNull();
      },
      { timeout: 3000 },
    );

    const heroLoc = container.querySelector('[data-testid="hero-location"]');
    expect(heroLoc?.textContent?.match(/42 Maple St/g) ?? []).toHaveLength(1);
    expect(COVER_PRESETS.some((c) => c.id === 'snowy-pines')).toBe(true);
    expect(getThemePreset('winter-snowfall').pageBg).toBe('#082556');
    expect(getThemePreset('winter-snowfall').cardBg).toBe('#ffffff');

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
