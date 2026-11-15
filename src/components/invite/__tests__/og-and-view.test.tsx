import fs from 'node:fs';
import path from 'node:path';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EventDetailResponse, EventMeta } from '@/types/invite';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const hasMergedDeps =
  fs.existsSync(path.resolve(process.cwd(), 'src/lib/themes/presets.ts')) &&
  fs.existsSync(path.resolve(process.cwd(), 'src/lib/storage/events.ts')) &&
  fs.existsSync(path.resolve(process.cwd(), 'src/components/effects/AmbientBackdrop.tsx')) &&
  fs.existsSync(path.resolve(process.cwd(), 'src/components/covers/CoverArt.tsx'));

const mockGetEventDetail = vi.fn();
if (hasMergedDeps) {
  vi.doMock('@/lib/storage/events', () => ({
    getEventDetail: (...args: unknown[]) => mockGetEventDetail(...args),
  }));
}

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

describe.skipIf(!hasMergedDeps)('InviteView & OpenGraphImage (post-merge integration)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('renders InviteView with cover art, popover calendar menu, maps link, virtual link, and host pill', async () => {
    const inviteViewSpecifier = '../InviteView';
    const { InviteView } = (await import(inviteViewSpecifier)) as typeof import('@/components/invite/InviteView');
    const detail = buildDetail({ isHost: true });
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
            viewerTimeLabel: 'Thu, Dec 24, 2026 · 4:00 PM – 7:00 PM PST (your time)',
            timeZoneName: 'EST',
            isMultiDay: false,
          }}
        />,
      );
      await new Promise((r) => setTimeout(r, 30));
    });

    expect(container.textContent).toContain('Christmas Eve Candlelight & Cocoa');
    expect(container.textContent).toContain('Hosted by Clara');
    expect(container.textContent).toContain('You are the Host · Edit Event');
    expect(container.textContent).toContain('4:00 PM – 7:00 PM PST (your time)');

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

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('generates PNG ImageResponse for both valid and missing events', async () => {
    const ogSpecifier = '../../../app/e/[id]/opengraph-image';
    const { default: OpenGraphImage } = (await import(ogSpecifier)) as typeof import('@/app/e/[id]/opengraph-image');
    mockGetEventDetail.mockResolvedValueOnce(buildDetail());
    const validRes = await OpenGraphImage({
      params: Promise.resolve({ id: 'evt_xmas1' }),
    });
    expect(validRes.status).toBe(200);
    expect(validRes.headers.get('content-type')).toContain('image/png');
    const validBytes = await validRes.arrayBuffer();
    expect(validBytes.byteLength).toBeGreaterThan(1000);

    mockGetEventDetail.mockResolvedValueOnce(null);
    const missingRes = await OpenGraphImage({
      params: Promise.resolve({ id: 'missing_id' }),
    });
    expect(missingRes.status).toBe(200);
    expect(missingRes.headers.get('content-type')).toContain('image/png');
    const missingBytes = await missingRes.arrayBuffer();
    expect(missingBytes.byteLength).toBeGreaterThan(1000);
  });
});
