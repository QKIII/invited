// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EventDetailResponse, EventMeta } from '@/types/invite';

const mockGetEventDetail = vi.fn();
const mockGetEventCover = vi.fn().mockResolvedValue(null);
vi.mock('@/lib/storage/events', () => ({
  getEventDetail: (...args: unknown[]) => mockGetEventDetail(...args),
  getEventCover: (...args: unknown[]) => mockGetEventCover(...args),
}));

import { resolveCoverImageUrl } from '@/components/covers/CoverArt';
import OpenGraphImage from '@/app/e/[id]/opengraph-image';
import { generateMetadata } from '@/app/e/[id]/page';

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

describe('OpenGraphImage (Node runtime integration)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('generates PNG ImageResponse for both valid and missing events', async () => {
    mockGetEventDetail.mockResolvedValueOnce(
      buildDetail({
        event: {
          ...buildDetail().event,
          style: {
            themeId: 'winter-snowfall',
            fontId: 'modern-sans',
            effectId: 'snowfall',
            coverPresetId: 'handdrawn-pelican-holiday',
            coverLayout: 'banner',
            colorMode: 'light',
          },
        },
      }),
    );
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

  it('emits cover image and "You\'re invited to <title>" in rich link metadata across presets, custom covers, and hidden-cover layouts', async () => {
    const pelicanDetail = buildDetail({
      event: {
        ...buildDetail().event,
        title: 'Christmas Breakfast with Spicy Pelicans and Sweet Penguins',
        style: {
          themeId: 'winter-snowfall',
          fontId: 'modern-sans',
          effectId: 'snowfall',
          coverPresetId: 'handdrawn-pelican-holiday',
          coverLayout: 'banner',
          colorMode: 'light',
        },
      },
    });
    mockGetEventDetail.mockResolvedValueOnce(pelicanDetail);

    const meta = await generateMetadata({
      params: Promise.resolve({ id: 'evt_xmas1' }),
      searchParams: Promise.resolve({}),
    });

    const expectedTitle =
      "You're invited to Christmas Breakfast with Spicy Pelicans and Sweet Penguins";
    expect(meta.title).toBe(expectedTitle);
    expect(meta.openGraph?.title).toBe(expectedTitle);
    expect(meta.twitter?.title).toBe(expectedTitle);
    expect(meta.openGraph?.images).toEqual([
      {
        url: 'https://invited-lyart.vercel.app/covers/handdrawn-pelican-holiday.jpg',
        width: 960,
        height: 540,
        type: 'image/jpeg',
        alt: expectedTitle,
      },
    ]);
    expect(meta.twitter?.images).toEqual([
      'https://invited-lyart.vercel.app/covers/handdrawn-pelican-holiday.jpg',
    ]);

    const customDetail = buildDetail({
      event: {
        ...buildDetail().event,
        style: {
          ...buildDetail().event.style,
          customCoverUrl: '/api/events/evt_xmas1/cover?file=cover-123.png',
        },
      },
    });
    mockGetEventDetail.mockResolvedValueOnce(customDetail);

    const customMeta = await generateMetadata({
      params: Promise.resolve({ id: 'evt_xmas1' }),
      searchParams: Promise.resolve({}),
    });
    expect(customMeta.openGraph?.images).toEqual([
      {
        url: 'https://invited-lyart.vercel.app/api/events/evt_xmas1/cover?file=cover-123.png',
        alt: "You're invited to Christmas Eve Candlelight & Cocoa",
      },
    ]);
    expect(customMeta.twitter?.images).toEqual([
      'https://invited-lyart.vercel.app/api/events/evt_xmas1/cover?file=cover-123.png',
    ]);

    const noneLayoutDetail = buildDetail({
      event: {
        ...buildDetail().event,
        style: {
          themeId: 'winter-snowfall',
          fontId: 'modern-sans',
          effectId: 'snowfall',
          coverPresetId: 'handdrawn-pelican-holiday',
          coverLayout: 'none',
          colorMode: 'light',
        },
      },
    });
    mockGetEventDetail.mockResolvedValueOnce(noneLayoutDetail);
    expect(resolveCoverImageUrl(noneLayoutDetail.event.style)).toBe(
      '/covers/handdrawn-pelican-holiday.jpg',
    );
    const noneLayoutMeta = await generateMetadata({
      params: Promise.resolve({ id: 'evt_xmas1' }),
      searchParams: Promise.resolve({}),
    });
    expect(noneLayoutMeta.twitter?.images).toEqual([
      'https://invited-lyart.vercel.app/covers/handdrawn-pelican-holiday.jpg',
    ]);
  });
});
