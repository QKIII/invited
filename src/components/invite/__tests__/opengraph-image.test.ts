// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EventDetailResponse, EventMeta } from '@/types/invite';

const mockGetEventDetail = vi.fn();
vi.mock('@/lib/storage/events', () => ({
  getEventDetail: (...args: unknown[]) => mockGetEventDetail(...args),
}));

import OpenGraphImage from '@/app/e/[id]/opengraph-image';

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
