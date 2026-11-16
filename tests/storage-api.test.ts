// @vitest-environment node
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const blobMock = vi.hoisted(() => ({
  store: new Map<string, { body: Buffer; contentType: string }>(),
  put: vi.fn(
    async (
      pathname: string,
      body: string | Buffer,
      options: { access: string; contentType?: string },
    ) => {
      const buf = Buffer.isBuffer(body) ? body : Buffer.from(body, 'utf8');
      blobMock.store.set(pathname, {
        body: buf,
        contentType: options.contentType || 'application/octet-stream',
      });
      return {
        url: `https://blob.example/${pathname}`,
        downloadUrl: `https://blob.example/${pathname}?download=1`,
        pathname,
        contentType: options.contentType || 'application/octet-stream',
        contentDisposition: 'inline',
        etag: 'etag-1',
      };
    },
  ),
  get: vi.fn(async (pathname: string) => {
    const item = blobMock.store.get(pathname);
    if (!item) return null;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(item.body));
        controller.close();
      },
    });
    return {
      statusCode: 200 as const,
      stream,
      headers: new Headers(),
      blob: {
        url: `https://blob.example/${pathname}`,
        downloadUrl: `https://blob.example/${pathname}?download=1`,
        pathname,
        contentType: item.contentType,
        contentDisposition: 'inline',
        cacheControl: 'no-cache',
        uploadedAt: new Date(),
        etag: 'etag-1',
        size: item.body.length,
      },
    };
  }),
  list: vi.fn(async (opts?: { prefix?: string }) => {
    const prefix = opts?.prefix ?? '';
    const blobs = [...blobMock.store.entries()]
      .filter(([pathname]) => pathname.startsWith(prefix))
      .map(([pathname, item]) => ({
        url: `https://blob.example/${pathname}`,
        downloadUrl: `https://blob.example/${pathname}?download=1`,
        pathname,
        size: item.body.length,
        uploadedAt: new Date(),
        etag: 'etag-1',
      }));
    return { blobs, hasMore: false };
  }),
  del: vi.fn(async (target: string | string[]) => {
    const paths = Array.isArray(target) ? target : [target];
    for (const p of paths) {
      blobMock.store.delete(p);
    }
  }),
}));

vi.mock('@vercel/blob', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vercel/blob')>();
  return {
    ...actual,
    put: blobMock.put,
    get: blobMock.get,
    list: blobMock.list,
    del: blobMock.del,
  };
});

const webPushMock = vi.hoisted(() => ({
  setVapidDetails: vi.fn(),
  sendNotification: vi.fn(),
}));

vi.mock('web-push', async (importOriginal) => {
  const actual = await importOriginal<typeof import('web-push')>();
  return {
    ...actual,
    setVapidDetails: webPushMock.setVapidDetails,
    sendNotification: webPushMock.sendNotification,
  };
});
import { POST as createCommentRoute } from '@/app/api/events/[id]/comments/route';
import { DELETE as deleteCommentRoute } from '@/app/api/events/[id]/comments/[commentId]/route';
import {
  GET as getEventCoverRoute,
  POST as postEventCoverRoute,
} from '@/app/api/events/[id]/cover/route';
import { GET as getIcsRoute } from '@/app/api/events/[id]/ics/route';
import {
  DELETE as deleteEventRoute,
  GET as getEventRoute,
  PATCH as patchEventRoute,
} from '@/app/api/events/[id]/route';
import { DELETE as deleteRsvpRoute } from '@/app/api/events/[id]/rsvps/[rsvpId]/route';
import { POST as postRsvpRoute } from '@/app/api/events/[id]/rsvps/route';
import {
  DELETE as deleteSubscribeRoute,
  POST as postSubscribeRoute,
} from '@/app/api/events/[id]/subscribe/route';
import { POST as createEventRoute } from '@/app/api/events/route';
import { GET as getVapidKeyRoute } from '@/app/api/push/vapid-public-key/route';
import {
  GET as getTempCoverRoute,
  POST as postTempCoverRoute,
} from '@/app/api/uploads/cover/route';
import { buildCalendarLinks, buildIcsContent } from '@/lib/calendar/ics';
import {
  generateId,
  generateSecretKey,
  hashSecret,
  verifySecret,
} from '@/lib/crypto/tokens';
import {
  getVapidPublicKey,
  notifyEventSubscribers,
} from '@/lib/notifications/push';
import { sanitizePlainText, sanitizeRichHtml } from '@/lib/sanitizeServer';
import {
  deletePrefix as storageDeletePrefix,
  getBinary as storageGetBinary,
  getJson as storageGetJson,
  listPrefix as storageListPrefix,
  putBinary as storagePutBinary,
  putJson as storagePutJson,
} from '@/lib/storage/adapter';
import { getEventDetail, upsertRsvp } from '@/lib/storage/events';

let tempDir: string;
const prevBlobToken = process.env.BLOB_READ_WRITE_TOKEN;
const prevDataDir = process.env.INVITED_DATA_DIR;

// Minimal valid 1x1 PNG binary
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

function jsonRequest(
  url: string,
  method: string,
  body?: unknown,
  headers?: Record<string, string>,
): Request {
  return new Request(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(headers ?? {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe('storage, crypto, sanitizer, calendar & API routes', () => {
  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'invited-storage-test-'));
    process.env.INVITED_DATA_DIR = tempDir;
    delete process.env.BLOB_READ_WRITE_TOKEN;
  });

  beforeEach(() => {
    process.env.INVITED_DATA_DIR = tempDir;
    delete process.env.BLOB_READ_WRITE_TOKEN;
  });

  afterAll(async () => {
    if (prevDataDir === undefined) {
      delete process.env.INVITED_DATA_DIR;
    } else {
      process.env.INVITED_DATA_DIR = prevDataDir;
    }
    if (prevBlobToken === undefined) {
      delete process.env.BLOB_READ_WRITE_TOKEN;
    } else {
      process.env.BLOB_READ_WRITE_TOKEN = prevBlobToken;
    }
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('generates URL-safe IDs and performs timing-safe secret verification', () => {
    const id = generateId(12);
    expect(id).toMatch(/^[0-9A-Za-z]{12}$/);

    const secret = generateSecretKey();
    const expectedHash = hashSecret(secret);
    expect(expectedHash).toMatch(/^[0-9a-f]{64}$/);

    expect(verifySecret(secret, expectedHash)).toBe(true);
    expect(verifySecret(`${secret}x`, expectedHash)).toBe(false);
    expect(verifySecret('', expectedHash)).toBe(false);
    expect(verifySecret(null, expectedHash)).toBe(false);
    expect(verifySecret(undefined, expectedHash)).toBe(false);
    expect(verifySecret(secret, 'short')).toBe(false);
  });

  it('sanitizes rich HTML deterministically while preserving safe prose tags and link attributes', () => {
    const dirty = [
      '<h2>Holiday Potluck</h2>',
      '<p>Bring your favorite <strong>warm dish</strong>!</p>',
      '<script>alert("xss")</script>',
      '<style>body{display:none}</style>',
      '<iframe src="https://evil.example"></iframe>',
      '<object data="evil.swf"></object>',
      '<embed src="evil.swf" />',
      '<img src="x" onerror="alert(1)" />',
      '<p onclick="steal()">Click <a href="https://example.com/menu" target="_blank">menu</a> or <a href="javascript:alert(1)">bad</a> or <a href="&#106;avascript:alert(2)">encoded</a> or <a href="data:text/html,<script>1</script>">data</a></p>',
      '<ul><li>Cider</li><li>Cookies</li></ul>',
    ].join('');

    const clean = sanitizeRichHtml(dirty);
    expect(clean).toContain('<h2>Holiday Potluck</h2>');
    expect(clean).toContain('<strong>warm dish</strong>');
    expect(clean).toContain('<ul><li>Cider</li><li>Cookies</li></ul>');
    expect(clean).toContain(
      '<a href="https://example.com/menu" target="_blank" rel="noopener noreferrer nofollow">menu</a>',
    );
    expect(clean).not.toContain('<script');
    expect(clean).not.toContain('alert("xss")');
    expect(clean).not.toContain('<style');
    expect(clean).not.toContain('<iframe');
    expect(clean).not.toContain('<object');
    expect(clean).not.toContain('<embed');
    expect(clean).not.toContain('onerror');
    expect(clean).not.toContain('onclick');
    expect(clean).not.toContain('javascript:');
    expect(clean).not.toContain('data:text/html');

    // Nested script bypass attempt, vbscript, comments, and unclosed tags
    const trickHtml =
      '<!-- secret --><scr<script>alert(1)</script>ipt><p><a href="vbscript:msgbox(1)">vb</a> <strong>bold';
    const trickClean = sanitizeRichHtml(trickHtml);
    expect(trickClean).not.toContain('<script');
    expect(trickClean).not.toContain('vbscript:');
    expect(trickClean).not.toContain('secret');
    expect(trickClean).toContain('<strong>bold</strong>');

    expect(
      sanitizePlainText('  Hello\u0000\u0007  World \n\n\n\n Next  ', 50),
    ).toBe('Hello  World \n\n Next');
    expect(
      sanitizePlainText('  Alice\nBob  ', 5, { singleLine: true }),
    ).toBe('Alice');
  });

  it('creates an event, enforces editKey auth (403 on wrong key), and supports PATCH + DELETE', async () => {
    const createRes = await createEventRoute(
      jsonRequest('http://localhost/api/events', 'POST', {
        title: 'Winter Solstice Dinner',
        descriptionHtml:
          '<p>Join us for <strong>candles</strong><script>alert(1)</script></p>',
        startIso: '2026-12-21T19:00:00',
        timeZone: 'America/New_York',
        locationName: '42 Maple St',
        hostName: 'Clara',
        invitedNames: ['Alice', 'Bob', 'Charlie'],
        style: {
          themeId: 'candlelit-dinner',
          fontId: 'editorial-serif',
          effectId: 'warm-bokeh',
          coverPresetId: 'candlelit-table',
          coverLayout: 'banner',
          ctaStyle: 'gradient',
          customAccentHex: '#e11d48',
          customCtaEndHex: '#7c3aed',
        },
      }),
    );

    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.id).toBeTruthy();
    expect(created.editKey).toBeTruthy();
    expect(created.event.style.ctaStyle).toBe('gradient');
    expect(created.event.style.customAccentHex).toBe('#e11d48');
    expect(created.event.style.customCtaEndHex).toBe('#7c3aed');
    expect(created.guestUrl).toBe(`/e/${created.id}`);
    expect(created.editUrl).toContain(`/e/${created.id}/edit?key=`);
    expect(created.event.descriptionHtml).not.toContain('<script>');
    expect(created.event.editKeyHash).toBeUndefined();

    // Unauthenticated GET works without leaking hashes
    const publicGet = await getEventRoute(
      new Request(`http://localhost/api/events/${created.id}`),
      { params: Promise.resolve({ id: created.id }) },
    );
    expect(publicGet.status).toBe(200);
    const publicBody = await publicGet.json();
    expect(publicBody.isHost).toBe(false);
    expect(publicBody.event.editKeyHash).toBeUndefined();

    // Invalid editKey rejected with 403
    const badPatch = await patchEventRoute(
      jsonRequest(
        `http://localhost/api/events/${created.id}`,
        'PATCH',
        { title: 'Hacked Title' },
        { 'x-edit-key': 'wrong-key' },
      ),
      { params: Promise.resolve({ id: created.id }) },
    );
    expect(badPatch.status).toBe(403);

    // Valid editKey updates event
    const goodPatch = await patchEventRoute(
      jsonRequest(
        `http://localhost/api/events/${created.id}`,
        'PATCH',
        { title: 'Winter Solstice Feast', locationName: '44 Maple St' },
        { 'x-edit-key': created.editKey },
      ),
      { params: Promise.resolve({ id: created.id }) },
    );
    expect(goodPatch.status).toBe(200);
    const updatedEvent = await goodPatch.json();
    expect(updatedEvent.title).toBe('Winter Solstice Feast');
    expect(updatedEvent.locationName).toBe('44 Maple St');

    // Invalid delete rejected with 403
    const badDelete = await deleteEventRoute(
      new Request(`http://localhost/api/events/${created.id}?key=bad`, {
        method: 'DELETE',
      }),
      { params: Promise.resolve({ id: created.id }) },
    );
    expect(badDelete.status).toBe(403);

    // Valid delete removes event
    const goodDelete = await deleteEventRoute(
      new Request(
        `http://localhost/api/events/${created.id}?key=${encodeURIComponent(created.editKey)}`,
        { method: 'DELETE' },
      ),
      { params: Promise.resolve({ id: created.id }) },
    );
    expect(goodDelete.status).toBe(200);

    const afterDelete = await getEventDetail(created.id);
    expect(afterDelete).toBeNull();
  });

  it('handles 5 concurrent parallel RSVPs with zero lost writes and enforces strict binary yes/no', async () => {
    const createRes = await createEventRoute(
      jsonRequest('http://localhost/api/events', 'POST', {
        title: 'Cozy Christmas Party',
        startIso: '2026-12-24T19:00:00',
        timeZone: 'America/New_York',
        invitedNames: ['Emma', 'Liam', 'Olivia', 'Noah', 'Mia', 'Lucas'],
      }),
    );
    const { id, editKey } = await createRes.json();

    // Reject 'maybe' with 400
    const maybeRes = await postRsvpRoute(
      jsonRequest(`http://localhost/api/events/${id}/rsvps`, 'POST', {
        guestName: 'Emma',
        status: 'maybe',
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(maybeRes.status).toBe(400);

    // Also test direct storage function throws ValidationError on 'maybe'
    await expect(
      upsertRsvp(id, { guestName: 'Emma', status: 'maybe' }),
    ).rejects.toThrow(/yes.*no/i);

    // 5 concurrent parallel RSVPs
    const guests = [
      {
        guestName: 'emma',
        status: 'yes',
        plusOnes: 2,
        bringingNote: 'Hot cocoa bar',
        postToWall: true,
      },
      {
        guestName: 'Liam',
        status: 'yes',
        plusOnes: 1,
        bringingNote: 'Gingerbread cookies',
      },
      {
        guestName: 'Olivia',
        status: 'no',
        plusOnes: 5, // should be forced to 0 for 'no'
        bringingNote: 'Out of town, have fun!',
      },
      {
        guestName: 'Noah',
        status: 'yes',
        plusOnes: 0,
        bringingNote: 'Board games',
      },
      {
        guestName: 'Mia',
        status: 'yes',
        plusOnes: 3,
      },
    ];

    const responses = await Promise.all(
      guests.map((g) =>
        postRsvpRoute(
          jsonRequest(`http://localhost/api/events/${id}/rsvps`, 'POST', g),
          { params: Promise.resolve({ id }) },
        ),
      ),
    );

    for (const res of responses) {
      expect(res.status).toBe(200);
    }

    const rsvpBodies = await Promise.all(responses.map((r) => r.json()));
    const detail = await getEventDetail(id, {
      guestToken: rsvpBodies[0].guestToken,
    });

    expect(detail).not.toBeNull();
    expect(detail!.rsvps.yes).toHaveLength(4);
    expect(detail!.rsvps.no).toHaveLength(1);
    // Forced plusOnes = 0 when status === 'no'
    expect(detail!.rsvps.no[0].plusOnes).toBe(0);
    // Headcount: (1+2) + (1+1) + (1+0) + (1+3) = 10
    expect(detail!.rsvps.totalHeadcount).toBe(10);
    // Case-insensitive awaiting filter: Emma, Liam, Olivia, Noah, Mia responded -> only Lucas remains
    expect(detail!.rsvps.awaitingNames).toEqual(['Lucas']);
    // Viewer RSVP populated without leaking guestTokenHash
    expect(detail!.viewerRsvp?.guestName).toBe('emma');
    expect(
      (detail!.viewerRsvp as unknown as Record<string, unknown>)?.guestTokenHash,
    ).toBeUndefined();
    // Emma's note posted to wall
    expect(detail!.comments).toHaveLength(1);
    expect(detail!.comments[0].body).toBe('Hot cocoa bar');
    expect(detail!.comments[0].rsvpStatus).toBe('yes');

    // Guest can update their own RSVP using guestToken
    const updateRes = await postRsvpRoute(
      jsonRequest(`http://localhost/api/events/${id}/rsvps`, 'POST', {
        guestName: 'Emma',
        status: 'yes',
        plusOnes: 0,
        bringingNote: 'Apple cider instead',
        guestToken: rsvpBodies[0].guestToken,
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(updateRes.status).toBe(200);
    const updatedJson = await updateRes.json();
    expect(updatedJson.detail.rsvps.yes).toHaveLength(4);
    expect(updatedJson.detail.rsvps.totalHeadcount).toBe(8);

    // Guest cannot delete another guest's RSVP (403)
    const unauthorizedDel = await deleteRsvpRoute(
      new Request(
        `http://localhost/api/events/${id}/rsvps/${rsvpBodies[1].rsvp.id}`,
        {
          method: 'DELETE',
          headers: { 'x-guest-token': rsvpBodies[0].guestToken },
        },
      ),
      { params: Promise.resolve({ id, rsvpId: rsvpBodies[1].rsvp.id }) },
    );
    expect(unauthorizedDel.status).toBe(403);

    // Host can hide guest list from non-hosts while preserving totalHeadcount
    await patchEventRoute(
      jsonRequest(
        `http://localhost/api/events/${id}`,
        'PATCH',
        { hideGuestList: true },
        { 'x-edit-key': editKey },
      ),
      { params: Promise.resolve({ id }) },
    );

    const hiddenGuestDetail = await getEventDetail(id, {
      guestToken: rsvpBodies[0].guestToken,
    });
    expect(hiddenGuestDetail!.rsvps.yes).toEqual([]);
    expect(hiddenGuestDetail!.rsvps.no).toEqual([]);
    expect(hiddenGuestDetail!.rsvps.awaitingNames).toEqual([]);
    expect(hiddenGuestDetail!.rsvps.totalHeadcount).toBe(8);
    expect(hiddenGuestDetail!.viewerRsvp?.guestName).toBe('Emma');

    const hostDetail = await getEventDetail(id, { editKey });
    expect(hostDetail!.isHost).toBe(true);
    expect(hostDetail!.rsvps.yes).toHaveLength(4);
  });

  it('supports wall comments, emoji reaction toggling, and host comment deletion', async () => {
    const createRes = await createEventRoute(
      jsonRequest('http://localhost/api/events', 'POST', {
        title: 'Friendsgiving',
        startIso: '2026-11-26T17:00:00',
        timeZone: 'America/Chicago',
      }),
    );
    const { id, editKey } = await createRes.json();

    const commentRes = await createCommentRoute(
      jsonRequest(`http://localhost/api/events/${id}/comments`, 'POST', {
        authorName: 'Jordan',
        body: 'Can I bring mashed potatoes?',
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(commentRes.status).toBe(201);
    const { comment } = await commentRes.json();
    expect(comment.isHost).toBe(false);

    // Add reaction
    const react1 = await createCommentRoute(
      jsonRequest(`http://localhost/api/events/${id}/comments`, 'POST', {
        action: 'react',
        commentId: comment.id,
        emoji: '🎉',
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(react1.status).toBe(200);
    expect((await react1.json()).comment.reactions['🎉']).toBe(1);

    // Toggle off reaction
    const react2 = await createCommentRoute(
      jsonRequest(`http://localhost/api/events/${id}/comments`, 'POST', {
        action: 'react',
        commentId: comment.id,
        emoji: '🎉',
        delta: -1,
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(react2.status).toBe(200);
    expect((await react2.json()).comment.reactions['🎉']).toBeUndefined();

    // Disallow arbitrary emoji
    const badReact = await createCommentRoute(
      jsonRequest(`http://localhost/api/events/${id}/comments`, 'POST', {
        action: 'react',
        commentId: comment.id,
        emoji: '💩',
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(badReact.status).toBe(400);

    // Non-host delete rejected with 403
    const badDel = await deleteCommentRoute(
      new Request(`http://localhost/api/events/${id}/comments/${comment.id}`, {
        method: 'DELETE',
        headers: { 'x-edit-key': 'nope' },
      }),
      { params: Promise.resolve({ id, commentId: comment.id }) },
    );
    expect(badDel.status).toBe(403);

    // Host delete succeeds
    const goodDel = await deleteCommentRoute(
      new Request(`http://localhost/api/events/${id}/comments/${comment.id}`, {
        method: 'DELETE',
        headers: { 'x-edit-key': editKey },
      }),
      { params: Promise.resolve({ id, commentId: comment.id }) },
    );
    expect(goodDel.status).toBe(200);
  });

  it('keeps subscriber emails and push endpoints private and never leaks them in getEventDetail', async () => {
    const createRes = await createEventRoute(
      jsonRequest('http://localhost/api/events', 'POST', {
        title: 'Nativity Candlelight Service',
        startIso: '2026-12-24T18:30:00',
        timeZone: 'America/New_York',
      }),
    );
    const { id, editKey } = await createRes.json();

    const emailSubRes = await postSubscribeRoute(
      jsonRequest(`http://localhost/api/events/${id}/subscribe`, 'POST', {
        kind: 'email',
        email: 'SecretGuest@Example.com',
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(emailSubRes.status).toBe(201);

    const pushSubRes = await postSubscribeRoute(
      jsonRequest(`http://localhost/api/events/${id}/subscribe`, 'POST', {
        kind: 'webpush',
        subscription: {
          endpoint: 'https://push.example.com/sub/secret-endpoint-123',
          keys: {
            p256dh: 'public-key-secret',
            auth: 'auth-secret-token',
          },
        },
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(pushSubRes.status).toBe(201);

    // Neither public nor host detail API exposes subscriber contact data
    const publicDetail = await getEventDetail(id);
    const hostDetail = await getEventDetail(id, { editKey });
    const serialized = JSON.stringify({ publicDetail, hostDetail });

    expect(publicDetail!.subscriberCount).toBe(2);
    expect(serialized).not.toContain('secretguest@example.com');
    expect(serialized).not.toContain('secret-endpoint-123');
    expect(serialized).not.toContain('public-key-secret');
    expect(serialized).not.toContain('auth-secret-token');

    // Unsubscribe email
    const unsubRes = await deleteSubscribeRoute(
      jsonRequest(`http://localhost/api/events/${id}/subscribe`, 'DELETE', {
        email: 'secretguest@example.com',
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(unsubRes.status).toBe(200);

    const afterUnsub = await getEventDetail(id);
    expect(afterUnsub!.subscriberCount).toBe(1);

    // Push notifications safely skip when VAPID is unconfigured
    expect(getVapidPublicKey()).toBeNull();
    const pushRes = await notifyEventSubscribers(id, {
      title: 'Test',
      body: 'Update',
      url: `/e/${id}`,
    });
    expect(pushRes.skipped).toBe(true);

    const vapidRes = await getVapidKeyRoute();
    expect(vapidRes.status).toBe(200);
    expect(await vapidRes.json()).toEqual({ publicKey: null });
  });

  it('generates RFC 5545 compliant .ics calendars and calendar links', async () => {
    const createRes = await createEventRoute(
      jsonRequest('http://localhost/api/events', 'POST', {
        title: '4th of July BBQ, Fireworks & Drinks; Backyard',
        descriptionHtml: '<p>Bring sunscreen &amp; chairs!</p>',
        startIso: '2026-07-04T17:00:00',
        timeZone: 'America/New_York',
        locationName: 'Riverside Park, Pavilion B',
      }),
    );
    const { id, event } = await createRes.json();

    const eventUrl = `https://invited.example/e/${id}`;
    const ics = buildIcsContent(event, eventUrl);

    expect(ics).toContain('BEGIN:VCALENDAR\r\n');
    expect(ics).toContain('VERSION:2.0\r\n');
    expect(ics).toContain('PRODID:-//invited//EN\r\n');
    expect(ics).toContain('BEGIN:VEVENT\r\n');
    expect(ics).toContain(`UID:${id}@invited\r\n`);
    // EDT is UTC-4 in July: 17:00 EDT == 21:00Z, +2h default end == 23:00Z
    expect(ics).toContain('DTSTART:20260704T210000Z\r\n');
    expect(ics).toContain('DTEND:20260704T230000Z\r\n');
    expect(ics).toContain('SUMMARY:4th of July BBQ\\, Fireworks & Drinks\\; Backyard');
    expect(ics).toContain('LOCATION:Riverside Park\\, Pavilion B');
    expect(ics).toContain('TRIGGER:-P1D');
    expect(ics).toContain('TRIGGER:-PT1H');
    expect(ics).toContain('END:VCALENDAR\r\n');

    const links = buildCalendarLinks(event, eventUrl);
    expect(links.icsPath).toBe(`/api/events/${id}/ics`);
    expect(links.googleUrl).toContain('calendar.google.com');
    expect(links.outlookUrl).toContain('outlook.live.com');

    const icsRouteRes = await getIcsRoute(
      new Request(`http://localhost/api/events/${id}/ics`),
      { params: Promise.resolve({ id }) },
    );
    expect(icsRouteRes.status).toBe(200);
    expect(icsRouteRes.headers.get('content-type')).toContain('text/calendar');
    expect(icsRouteRes.headers.get('content-disposition')).toBe(
      'attachment; filename="event.ics"',
    );
  });

  it('validates and serves uploaded cover images safely for both pre-create uploads and events', async () => {
    // Reject spoofed SVG claiming to be PNG
    const badForm = new FormData();
    badForm.set(
      'file',
      new File(['<svg onload="alert(1)"></svg>'], 'bad.png', {
        type: 'image/png',
      }),
    );
    const badUpload = await postTempCoverRoute(
      new Request('http://localhost/api/uploads/cover', {
        method: 'POST',
        body: badForm,
      }),
    );
    expect(badUpload.status).toBe(400);

    // Valid pre-create PNG upload
    const goodForm = new FormData();
    goodForm.set('file', new File([TINY_PNG], 'cover.png', { type: 'image/png' }));
    const goodUpload = await postTempCoverRoute(
      new Request('http://localhost/api/uploads/cover', {
        method: 'POST',
        body: goodForm,
      }),
    );
    expect(goodUpload.status).toBe(201);
    const uploadData = await goodUpload.json();
    expect(uploadData.url).toMatch(/^\/api\/uploads\/cover\?path=/);

    const fetchTempCover = await getTempCoverRoute(
      new Request(`http://localhost${uploadData.url}`),
    );
    expect(fetchTempCover.status).toBe(200);
    expect(fetchTempCover.headers.get('content-type')).toBe('image/png');
    expect(fetchTempCover.headers.get('cache-control')).toBe(
      'public, max-age=3600',
    );
    const fetchedBuf = Buffer.from(await fetchTempCover.arrayBuffer());
    expect(fetchedBuf.equals(TINY_PNG)).toBe(true);

    // Event-scoped cover upload enforces editKey
    const createRes = await createEventRoute(
      jsonRequest('http://localhost/api/events', 'POST', {
        title: 'Spring Garden Brunch',
        startIso: '2026-04-12T11:00:00',
        timeZone: 'America/Los_Angeles',
      }),
    );
    const { id, editKey } = await createRes.json();

    const eventForm = new FormData();
    eventForm.set('file', new File([TINY_PNG], 'garden.png', { type: 'image/png' }));

    const forbiddenCover = await postEventCoverRoute(
      new Request(`http://localhost/api/events/${id}/cover`, {
        method: 'POST',
        headers: { 'x-edit-key': 'wrong' },
        body: eventForm,
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(forbiddenCover.status).toBe(403);

    const eventForm2 = new FormData();
    eventForm2.set('file', new File([TINY_PNG], 'garden.png', { type: 'image/png' }));
    const allowedCover = await postEventCoverRoute(
      new Request(`http://localhost/api/events/${id}/cover`, {
        method: 'POST',
        headers: { 'x-edit-key': editKey },
        body: eventForm2,
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(allowedCover.status).toBe(201);

    const servedCover = await getEventCoverRoute(
      new Request(`http://localhost/api/events/${id}/cover`),
      { params: Promise.resolve({ id }) },
    );
    expect(servedCover.status).toBe(200);
    expect(servedCover.headers.get('content-type')).toBe('image/png');
  });

  it('uses @vercel/blob v2.9.0 private non-cached API when BLOB_READ_WRITE_TOKEN is set', async () => {
    process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_test_token';
    blobMock.store.clear();
    blobMock.put.mockClear();
    blobMock.get.mockClear();
    blobMock.list.mockClear();
    blobMock.del.mockClear();

    await storagePutJson('events/evt1/meta.json', { id: 'evt1', title: 'Hi' });
    expect(blobMock.put).toHaveBeenCalledWith(
      'events/evt1/meta.json',
      JSON.stringify({ id: 'evt1', title: 'Hi' }),
      expect.objectContaining({
        access: 'private',
        allowOverwrite: true,
        addRandomSuffix: false,
      }),
    );

    const readBack = await storageGetJson<{ id: string; title: string }>(
      'events/evt1/meta.json',
    );
    expect(blobMock.get).toHaveBeenCalledWith('events/evt1/meta.json', {
      access: 'private',
      useCache: false,
    });
    expect(readBack).toEqual({ id: 'evt1', title: 'Hi' });
    expect(await storageGetJson('events/evt1/missing.json')).toBeNull();

    await storagePutBinary('events/evt1/media/cover.png', TINY_PNG, 'image/png');
    const bin = await storageGetBinary('events/evt1/media/cover.png');
    expect(bin?.contentType).toBe('image/png');
    expect(bin?.data.equals(TINY_PNG)).toBe(true);

    const listed = await storageListPrefix('events/evt1/');
    expect(listed).toEqual([
      'events/evt1/media/cover.png',
      'events/evt1/meta.json',
    ]);

    await storageDeletePrefix('events/evt1/');
    expect(blobMock.del).toHaveBeenCalledWith([
      'events/evt1/media/cover.png',
      'events/evt1/meta.json',
    ]);
    expect(await storageListPrefix('events/evt1/')).toEqual([]);
  });

  it('sends web push notifications when VAPID keys are configured and cleans up 410 expired subscriptions', async () => {
    const prevPub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const prevPriv = process.env.VAPID_PRIVATE_KEY;

    try {
      const createRes = await createEventRoute(
        jsonRequest('http://localhost/api/events', 'POST', {
          title: 'NYE Countdown',
          startIso: '2026-12-31T21:00:00',
          timeZone: 'America/New_York',
        }),
      );
      const { id } = await createRes.json();

      await postSubscribeRoute(
        jsonRequest(`http://localhost/api/events/${id}/subscribe`, 'POST', {
          kind: 'webpush',
          subscription: {
            endpoint: 'https://push.example.com/active',
            keys: { p256dh: 'pk1', auth: 'ak1' },
          },
        }),
        { params: Promise.resolve({ id }) },
      );

      await postSubscribeRoute(
        jsonRequest(`http://localhost/api/events/${id}/subscribe`, 'POST', {
          kind: 'webpush',
          subscription: {
            endpoint: 'https://push.example.com/expired',
            keys: { p256dh: 'pk2', auth: 'ak2' },
          },
        }),
        { params: Promise.resolve({ id }) },
      );

      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'vapid-pub-test';
      process.env.VAPID_PRIVATE_KEY = 'vapid-priv-test';

      webPushMock.sendNotification.mockImplementation(
        async (sub: { endpoint: string }) => {
          if (sub.endpoint.endsWith('/expired')) {
            const err = new Error('Gone') as Error & { statusCode: number };
            err.statusCode = 410;
            throw err;
          }
          return { statusCode: 201, body: '', headers: {} };
        },
      );

      const res = await notifyEventSubscribers(id, {
        title: 'NYE Update',
        body: 'Doors open at 9pm',
        url: `/e/${id}`,
      });

      expect(res.skipped).toBe(false);
      expect(res.sent).toBe(1);
      expect(res.removed).toBe(1);
      expect(webPushMock.setVapidDetails).toHaveBeenCalledWith(
        'mailto:hello@invited.app',
        'vapid-pub-test',
        'vapid-priv-test',
      );

      const detail = await getEventDetail(id);
      expect(detail!.subscriberCount).toBe(1);
    } finally {
      if (prevPub === undefined) delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      else process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = prevPub;
      if (prevPriv === undefined) delete process.env.VAPID_PRIVATE_KEY;
      else process.env.VAPID_PRIVATE_KEY = prevPriv;
    }
  });
});
