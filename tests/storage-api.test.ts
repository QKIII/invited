// @vitest-environment node
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const blobMock = vi.hoisted(() => ({
  seq: 0,
  store: new Map<string, { body: Buffer; contentType: string; etag: string }>(),
  put: vi.fn(
    async (
      pathname: string,
      body: string | Buffer,
      options: {
        access: string;
        contentType?: string;
        allowOverwrite?: boolean;
        ifMatch?: string;
      },
    ) => {
      const existing = blobMock.store.get(pathname);
      if (existing && options.allowOverwrite === false) {
        throw new Error('Blob already exists');
      }
      if (options.ifMatch && (!existing || existing.etag !== options.ifMatch)) {
        throw Object.assign(new Error('Precondition failed'), {
          name: 'BlobPreconditionFailedError',
        });
      }
      const etag = `etag-${++blobMock.seq}`;
      const buf = Buffer.isBuffer(body) ? body : Buffer.from(body, 'utf8');
      blobMock.store.set(pathname, {
        body: buf,
        contentType: options.contentType || 'application/octet-stream',
        etag,
      });
      return {
        url: `https://blob.example/${pathname}`,
        downloadUrl: `https://blob.example/${pathname}?download=1`,
        pathname,
        contentType: options.contentType || 'application/octet-stream',
        contentDisposition: 'inline',
        etag,
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
        etag: item.etag,
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
        etag: item.etag,
      }));
    return { blobs, hasMore: false };
  }),
  head: vi.fn(async (pathnameOrUrl: string) => {
    const key = pathnameOrUrl.replace(/^https:\/\/blob\.example\//, '');
    const item = blobMock.store.get(key);
    if (!item) {
      throw Object.assign(new Error('Blob not found'), {
        name: 'BlobNotFoundError',
      });
    }
    return {
      url: `https://blob.example/${key}`,
      downloadUrl: `https://blob.example/${key}?download=1`,
      pathname: key,
      size: item.body.length,
      contentType: item.contentType,
      contentDisposition: 'inline',
      cacheControl: 'no-cache',
      uploadedAt: new Date(),
      etag: item.etag,
    };
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
    head: blobMock.head,
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
import { GET as getUnsubscribeRoute } from '@/app/api/events/[id]/unsubscribe/route';
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
import {
  createComment,
  createEvent,
  getEventDetail,
  toggleReaction,
  upsertRsvp,
} from '@/lib/storage/events';

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
    expect(await vapidRes.json()).toEqual({ publicKey: null, emailConfigured: false });
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
      headers: { 'accept-encoding': 'identity' },
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

  it('executes v2 event lifecycle on Vercel Blob with zero list() calls and immutable cover headers', async () => {
    process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_test_token';
    blobMock.seq = 0;
    blobMock.store.clear();
    blobMock.put.mockClear();
    blobMock.get.mockClear();
    blobMock.list.mockClear();
    blobMock.del.mockClear();

    try {
      const created = await createEvent({
        title: 'Winter Solstice Supper',
        startIso: '2026-12-21T18:30:00',
        timeZone: 'America/New_York',
      });
      const id = created.event.id;
      expect((created.event as unknown as Record<string, unknown>).storageVersion).toBeUndefined();

      // Concurrent RSVPs serialize cleanly via ifMatch optimistic concurrency
      const [r1, r2] = await Promise.all([
        upsertRsvp(id, { guestName: 'Alice', status: 'yes', plusOnes: 1 }),
        upsertRsvp(id, { guestName: 'Bob', status: 'no' }),
      ]);
      expect(r1.rsvp.guestName).toBe('Alice');
      expect(r2.rsvp.guestName).toBe('Bob');

      const comment = await createComment(id, {
        authorName: 'Alice',
        body: 'Bringing mulled cider!',
        guestToken: r1.guestToken,
      });
      const reacted = await toggleReaction(id, comment.id, '🎉');
      expect(reacted.reactions['🎉']).toBe(1);

      const fullDetail = await getEventDetail(id, { guestToken: r1.guestToken });
      expect(fullDetail!.rsvps.yes).toHaveLength(1);
      expect(fullDetail!.rsvps.no).toHaveLength(1);
      expect(fullDetail!.rsvps.totalHeadcount).toBe(2);
      expect(fullDetail!.comments).toHaveLength(1);
      expect(fullDetail!.comments[0].rsvpStatus).toBe('yes');
      expect(fullDetail!.comments[0].reactions['🎉']).toBe(1);
      expect(fullDetail!.viewerRsvp?.guestName).toBe('Alice');

      const summaryDetail = await getEventDetail(id, { summaryOnly: true });
      expect(summaryDetail!.rsvps.totalHeadcount).toBe(2);
      expect(summaryDetail!.comments).toEqual([]);

      // Zero list() Advanced Operations on v2 reads and mutations
      expect(blobMock.list).not.toHaveBeenCalled();

      // Versioned cover upload uses immutable cache headers and useCache: true
      const coverForm = new FormData();
      coverForm.set('file', new File([TINY_PNG], 'solstice.png', { type: 'image/png' }));
      const uploadedCover = await postEventCoverRoute(
        new Request(`http://localhost/api/events/${id}/cover`, {
          method: 'POST',
          headers: { 'x-edit-key': created.editKey },
          body: coverForm,
        }),
        { params: Promise.resolve({ id }) },
      );
      expect(uploadedCover.status).toBe(201);
      const uploadedJson = (await uploadedCover.json()) as { url: string };

      blobMock.get.mockClear();
      const cachedCoverRes = await getEventCoverRoute(
        new Request(`http://localhost${uploadedJson.url}`),
        { params: Promise.resolve({ id }) },
      );
      expect(cachedCoverRes.status).toBe(200);
      expect(cachedCoverRes.headers.get('cache-control')).toBe(
        'public, max-age=31536000, s-maxage=31536000, immutable',
      );
      expect(blobMock.get).toHaveBeenCalledWith(
        expect.stringMatching(new RegExp(`^events/${id}/media/cover-`)),
        expect.objectContaining({ access: 'private', useCache: true }),
      );
    } finally {
      delete process.env.BLOB_READ_WRITE_TOKEN;
    }
  });

  it('sends confirmation and batched update emails via Resend when RESEND_API_KEY is set and supports one-click unsubscribe', async () => {
    const prevKey = process.env.RESEND_API_KEY;
    const prevFrom = process.env.INVITED_FROM_EMAIL;
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'email_123' }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchSpy);
    process.env.RESEND_API_KEY = 're_test_key_123';
    process.env.INVITED_FROM_EMAIL = 'invited <hello@example.com>';

    try {
      const createRes = await createEventRoute(
        jsonRequest('http://localhost/api/events', 'POST', {
          title: 'Pelican Winter Brunch',
          startIso: '2026-12-05T09:30:00',
          timeZone: 'America/New_York',
          hostName: 'Ivan',
          style: {
            themeId: 'y2k-chrome',
            fontId: 'y2k-display',
            effectId: 'liquid-chrome',
            coverPresetId: 'vector-starburst-night',
            coverLayout: 'banner',
            cardStyle: 'y2k',
          },
        }),
      );
      const { id, editKey, event } = await createRes.json();
      expect(event.style.cardStyle).toBe('y2k');
      expect(event.style.effectId).toBe('liquid-chrome');

      // Subscribing by email sends immediate confirmation email with List-Unsubscribe header
      const subRes = await postSubscribeRoute(
        jsonRequest(`http://localhost/api/events/${id}/subscribe`, 'POST', {
          kind: 'email',
          email: 'guest@example.com',
        }),
        { params: Promise.resolve({ id }) },
      );
      expect(subRes.status).toBe(201);
      const subJson = await subRes.json();
      expect(subJson.emailSent).toBe(true);
      expect(subJson.emailConfigured).toBe(true);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const confirmReq = JSON.parse(fetchSpy.mock.calls[0][1].body as string);
      expect(confirmReq.from).toBe('invited <hello@example.com>');
      expect(confirmReq.to).toEqual(['guest@example.com']);
      expect(confirmReq.headers['List-Unsubscribe']).toContain('/api/events/');

      // Host update triggers batched update email via Resend batch endpoint
      fetchSpy.mockClear();
      const patchRes = await patchEventRoute(
        jsonRequest(
          `http://localhost/api/events/${id}`,
          'PATCH',
          { locationName: '99 Pine St' },
          { 'x-edit-key': editKey },
        ),
        { params: Promise.resolve({ id }) },
      );
      expect(patchRes.status).toBe(200);
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.resend.com/emails/batch',
        expect.objectContaining({ method: 'POST' }),
      );

      // Host wall announcement triggers batched update email
      fetchSpy.mockClear();
      const hostCommentRes = await createCommentRoute(
        jsonRequest(`http://localhost/api/events/${id}/comments`, 'POST', {
          authorName: 'Ivan',
          body: 'Parking is open around back!',
          editKey,
        }),
        { params: Promise.resolve({ id }) },
      );
      expect(hostCommentRes.status).toBe(201);
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.resend.com/emails/batch',
        expect.objectContaining({ method: 'POST' }),
      );

      // 1-click GET unsubscribe removes the email subscriber cleanly
      const unsubRes = await getUnsubscribeRoute(
        new Request(
          `http://localhost/api/events/${id}/unsubscribe?subId=${encodeURIComponent(subJson.id)}`,
        ),
        { params: Promise.resolve({ id }) },
      );
      expect(unsubRes.status).toBe(200);
      expect(await unsubRes.text()).toContain('unsubscribed');
      const afterDetail = await getEventDetail(id);
      expect(afterDetail!.subscriberCount).toBe(0);
    } finally {
      vi.unstubAllGlobals();
      if (prevKey === undefined) delete process.env.RESEND_API_KEY;
      else process.env.RESEND_API_KEY = prevKey;
      if (prevFrom === undefined) delete process.env.INVITED_FROM_EMAIL;
      else process.env.INVITED_FROM_EMAIL = prevFrom;
    }
  });

  it('recovers via head() when compressed >1KB Blob get() returns a mismatched weak ETag', async () => {
    blobMock.store.clear();
    blobMock.head.mockClear();
    blobMock.get.mockClear();
    process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_test_token';
    const origGetImpl = blobMock.get.getMockImplementation()!;

    try {
      const createRes = await createEventRoute(
        jsonRequest('http://localhost/api/events', 'POST', {
          title: 'Christmas Breakfast',
          startIso: '2026-12-05T14:30:00Z',
          timeZone: 'America/New_York',
          hostName: 'Ivan',
        }),
      );
      expect(createRes.status).toBe(201);
      const { id } = (await createRes.json()) as { id: string };

      const longNote = 'Bringing breakfast casserole, muffins, fresh fruit, and coffee for everyone! '.repeat(3);
      for (const name of ['Guest One', 'Guest Two', 'Guest Three', 'Guest Four']) {
        const res = await postRsvpRoute(
          jsonRequest(`http://localhost/api/events/${id}/rsvps`, 'POST', {
            guestName: name,
            status: 'yes',
            plusOnes: 0,
            bringingNote: longNote,
            postToWall: false,
          }),
          { params: Promise.resolve({ id }) },
        );
        expect(res.status).toBe(200);
      }

      const rsvpBlob = blobMock.store.get(`events/${id}/rsvps.json`);
      expect(rsvpBlob!.body.length).toBeGreaterThan(1024);

      // Simulate CDN HTTP compression altering get()'s response ETag header while head() holds the canonical origin ETag
      blobMock.get.mockImplementation(async (pathname: string) => {
        const res = await origGetImpl(pathname);
        if (res && pathname.endsWith('/rsvps.json')) {
          return {
            ...res,
            blob: { ...res.blob, etag: `W/"${res.blob.etag}-br"` },
          };
        }
        return res;
      });
      blobMock.head.mockClear();

      const fifthRes = await postRsvpRoute(
        jsonRequest(`http://localhost/api/events/${id}/rsvps`, 'POST', {
          guestName: 'Guest Five',
          status: 'yes',
          plusOnes: 0,
          postToWall: false,
        }),
        { params: Promise.resolve({ id }) },
      );
      expect(fifthRes.status).toBe(200);
      expect(blobMock.head).toHaveBeenCalledWith(`events/${id}/rsvps.json`);

      const getRes = await getEventRoute(
        new Request(`http://localhost/api/events/${id}`),
        { params: Promise.resolve({ id }) },
      );
      expect(getRes.status).toBe(200);
      const detail = (await getRes.json()) as {
        rsvps: { yes: Array<{ guestName: string }>; totalHeadcount: number };
      };
      expect(detail.rsvps.yes).toHaveLength(5);
      expect(detail.rsvps.totalHeadcount).toBe(5);
    } finally {
      blobMock.get.mockImplementation(origGetImpl);
      delete process.env.BLOB_READ_WRITE_TOKEN;
    }
  });

  it('handles inline RSVP email tiers, privacy of viewerSubscription, smart host diffs, filtered comment alerts, RSVP delete cleanup, and zero Blob list() calls', async () => {
    const prevKey = process.env.RESEND_API_KEY;
    const prevFrom = process.env.INVITED_FROM_EMAIL;
    const prevReplyTo = process.env.INVITED_REPLY_TO;
    const prevAppUrl = process.env.NEXT_PUBLIC_APP_URL;

    process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_test_token';
    process.env.RESEND_API_KEY = 're_test_key_tiers';
    delete process.env.INVITED_FROM_EMAIL;
    process.env.INVITED_REPLY_TO = 'host-reply@example.com';
    process.env.NEXT_PUBLIC_APP_URL = 'https://invited.ivanw.me';

    blobMock.seq = 0;
    blobMock.store.clear();
    blobMock.put.mockClear();
    blobMock.get.mockClear();
    blobMock.head.mockClear();
    blobMock.list.mockClear();
    blobMock.del.mockClear();

    const fetchSpy = vi.fn().mockImplementation(async () => {
      return new Response(JSON.stringify({ id: 'resend_ok' }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchSpy);

    try {
      const createRes = await createEventRoute(
        jsonRequest('http://localhost/api/events', 'POST', {
          title: 'Solstice Supper',
          descriptionHtml: '<p>Bring a cozy sweater.</p>',
          startIso: '2026-12-21T18:00:00',
          timeZone: 'America/New_York',
          locationName: '42 Maple St',
          hostName: 'Clara',
          style: {
            themeId: 'candlelit-dinner',
            fontId: 'editorial-serif',
            effectId: 'warm-bokeh',
            coverPresetId: 'candlelit-table',
            coverLayout: 'banner',
          },
        }),
      );
      expect(createRes.status).toBe(201);
      const { id, editKey } = (await createRes.json()) as { id: string; editKey: string };

      // 1. RSVP with inline emailUpdates for each tier ('changes', 'host_posts', 'all_posts')
      // Guest A -> 'changes'
      const rsvpARes = await postRsvpRoute(
        jsonRequest(`http://localhost/api/events/${id}/rsvps`, 'POST', {
          guestName: 'Alice',
          status: 'yes',
          plusOnes: 0,
          bringingNote: 'Apple cider',
          postToWall: true, // Dish note via RSVP must NOT trigger wall-post emails
          emailUpdates: {
            enabled: true,
            email: 'alice@example.com',
            notifyLevel: 'changes',
          },
        }),
        { params: Promise.resolve({ id }) },
      );
      expect(rsvpARes.status).toBe(200);
      const rsvpAJson = await rsvpARes.json();
      expect(rsvpAJson.emailSent).toBe(true);
      expect(rsvpAJson.detail.viewerSubscription).toEqual({
        email: 'alice@example.com',
        notifyLevel: 'changes',
      });
      // Only 1 confirmation email sent — RSVP postToWall dish note did NOT trigger wall-post emails
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const confirmPayload = JSON.parse(String(fetchSpy.mock.calls[0][1].body));
      expect(confirmPayload.from).toBe('invited <updates@invites.ivanw.me>');
      expect(confirmPayload.reply_to).toBe('host-reply@example.com');
      expect(confirmPayload.subject).toBe("You're in: Solstice Supper");
      expect(confirmPayload.text).toContain('Event updates only');

      // Saving the same email again (even changing notifyLevel) does NOT re-send confirmation email
      fetchSpy.mockClear();
      const rsvpAUpdateSameEmail = await postRsvpRoute(
        jsonRequest(
          `http://localhost/api/events/${id}/rsvps`,
          'POST',
          {
            guestName: 'Alice',
            status: 'yes',
            plusOnes: 1,
            emailUpdates: {
              enabled: true,
              email: 'alice@example.com',
              notifyLevel: 'changes',
            },
          },
          { 'x-guest-token': rsvpAJson.guestToken },
        ),
        { params: Promise.resolve({ id }) },
      );
      expect(rsvpAUpdateSameEmail.status).toBe(200);
      const rsvpAUpdateJson = await rsvpAUpdateSameEmail.json();
      expect(rsvpAUpdateJson.emailSent).toBe(false);
      expect(fetchSpy).not.toHaveBeenCalled();

      // Changing to a NEW email address sends confirmation once for the new email
      const rsvpANewEmail = await postRsvpRoute(
        jsonRequest(
          `http://localhost/api/events/${id}/rsvps`,
          'POST',
          {
            guestName: 'Alice',
            status: 'yes',
            plusOnes: 1,
            emailUpdates: {
              enabled: true,
              email: 'alice.new@example.com',
              notifyLevel: 'changes',
            },
          },
          { 'x-guest-token': rsvpAJson.guestToken },
        ),
        { params: Promise.resolve({ id }) },
      );
      expect(rsvpANewEmail.status).toBe(200);
      expect((await rsvpANewEmail.json()).emailSent).toBe(true);
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Guest B -> 'host_posts', Guest C -> 'all_posts', Guest D -> 'all_posts'
      fetchSpy.mockClear();
      const rsvpBRes = await postRsvpRoute(
        jsonRequest(`http://localhost/api/events/${id}/rsvps`, 'POST', {
          guestName: 'Bob',
          status: 'yes',
          plusOnes: 0,
          emailUpdates: {
            enabled: true,
            email: 'bob@example.com',
            notifyLevel: 'host_posts',
          },
        }),
        { params: Promise.resolve({ id }) },
      );
      const rsvpBJson = await rsvpBRes.json();

      const rsvpCRes = await postRsvpRoute(
        jsonRequest(`http://localhost/api/events/${id}/rsvps`, 'POST', {
          guestName: 'Charlie',
          status: 'no',
          plusOnes: 0,
          emailUpdates: {
            enabled: true,
            email: 'charlie@example.com',
            notifyLevel: 'all_posts',
          },
        }),
        { params: Promise.resolve({ id }) },
      );
      const rsvpCJson = await rsvpCRes.json();

      const rsvpDRes = await postRsvpRoute(
        jsonRequest(`http://localhost/api/events/${id}/rsvps`, 'POST', {
          guestName: 'Dana',
          status: 'yes',
          plusOnes: 0,
          emailUpdates: {
            enabled: true,
            email: 'dana@example.com',
            notifyLevel: 'all_posts',
          },
        }),
        { params: Promise.resolve({ id }) },
      );
      expect(rsvpDRes.status).toBe(200);
      expect(fetchSpy).toHaveBeenCalledTimes(3);

      // 2. viewerSubscription privacy: ONLY matching x-guest-token sees it; never public or host editKey alone
      const publicGet = await getEventRoute(
        new Request(`http://localhost/api/events/${id}`),
        { params: Promise.resolve({ id }) },
      );
      const publicJson = await publicGet.json();
      expect(publicJson.viewerSubscription).toBeUndefined();
      expect(JSON.stringify(publicJson)).not.toContain('alice.new@example.com');
      expect(JSON.stringify(publicJson)).not.toContain('bob@example.com');

      const hostOnlyGet = await getEventRoute(
        new Request(`http://localhost/api/events/${id}`, {
          headers: { 'x-edit-key': editKey },
        }),
        { params: Promise.resolve({ id }) },
      );
      const hostOnlyJson = await hostOnlyGet.json();
      expect(hostOnlyJson.isHost).toBe(true);
      expect(hostOnlyJson.viewerSubscription).toBeUndefined();
      expect(JSON.stringify(hostOnlyJson)).not.toContain('alice.new@example.com');

      const guestBGet = await getEventRoute(
        new Request(`http://localhost/api/events/${id}`, {
          headers: { 'x-guest-token': rsvpBJson.guestToken },
        }),
        { params: Promise.resolve({ id }) },
      );
      const guestBJson = await guestBGet.json();
      expect(guestBJson.viewerSubscription).toEqual({
        email: 'bob@example.com',
        notifyLevel: 'host_posts',
      });
      expect(JSON.stringify(guestBJson)).not.toContain('alice.new@example.com');

      // 3. Comments filtering:
      // 3a) Host comment emails 'host_posts' (bob) + 'all_posts' (charlie, dana), NOT 'changes' (alice.new)
      fetchSpy.mockClear();
      const hostCommentRes = await createCommentRoute(
        jsonRequest(`http://localhost/api/events/${id}/comments`, 'POST', {
          authorName: 'Clara',
          body: 'Bring slippers if you want!',
          editKey,
        }),
        { params: Promise.resolve({ id }) },
      );
      expect(hostCommentRes.status).toBe(201);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy.mock.calls[0][0]).toBe('https://api.resend.com/emails/batch');
      const hostBatch = JSON.parse(String(fetchSpy.mock.calls[0][1].body)) as Array<{
        to: string[];
      }>;
      const hostRecipients = hostBatch.flatMap((m) => m.to).sort();
      expect(hostRecipients).toEqual(['bob@example.com', 'charlie@example.com', 'dana@example.com']);

      // 3b) Standalone guest wall comment by Charlie ('all_posts') emails ONLY 'all_posts' excluding Charlie's own guestTokenHash (so ONLY Dana!)
      fetchSpy.mockClear();
      const guestCommentRes = await createCommentRoute(
        jsonRequest(
          `http://localhost/api/events/${id}/comments`,
          'POST',
          {
            authorName: 'Charlie',
            body: 'Wish I could make it — have fun!',
          },
          { 'x-guest-token': rsvpCJson.guestToken },
        ),
        { params: Promise.resolve({ id }) },
      );
      expect(guestCommentRes.status).toBe(201);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const guestBatch = JSON.parse(String(fetchSpy.mock.calls[0][1].body)) as Array<{
        to: string[];
      }>;
      expect(guestBatch.flatMap((m) => m.to)).toEqual(['dana@example.com']);

      // 4. PATCH smart diffs & notifyGuests overrides
      // 4a) Style-only PATCH skips Resend
      fetchSpy.mockClear();
      const styleOnlyPatch = await patchEventRoute(
        jsonRequest(
          `http://localhost/api/events/${id}`,
          'PATCH',
          {
            style: {
              themeId: 'y2k-chrome',
              fontId: 'y2k-display',
              effectId: 'liquid-chrome',
              coverPresetId: 'vector-starburst-night',
              coverLayout: 'banner',
            },
          },
          { 'x-edit-key': editKey },
        ),
        { params: Promise.resolve({ id }) },
      );
      expect(styleOnlyPatch.status).toBe(200);
      expect(fetchSpy).not.toHaveBeenCalled();

      // 4b) Material PATCH sends "What changed" bullets to ALL active email tiers
      const materialPatch = await patchEventRoute(
        jsonRequest(
          `http://localhost/api/events/${id}`,
          'PATCH',
          {
            title: 'Solstice Feast',
            startIso: '2026-12-22T19:00:00',
            locationName: '99 Pine St',
            descriptionHtml: '<p>Bring a cozy sweater and dessert.</p>',
          },
          { 'x-edit-key': editKey },
        ),
        { params: Promise.resolve({ id }) },
      );
      expect(materialPatch.status).toBe(200);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const diffBatch = JSON.parse(String(fetchSpy.mock.calls[0][1].body)) as Array<{
        to: string[];
        html: string;
        text: string;
      }>;
      expect(diffBatch.flatMap((m) => m.to).sort()).toEqual([
        'alice.new@example.com',
        'bob@example.com',
        'charlie@example.com',
        'dana@example.com',
      ]);
      expect(diffBatch[0].html).toContain('What changed');
      expect(diffBatch[0].text).toContain('Title changed to "Solstice Feast"');
      expect(diffBatch[0].text).toContain('Date & time updated to');
      expect(diffBatch[0].text).toContain('Location updated to 99 Pine St');
      expect(diffBatch[0].text).toContain('Event description was updated');

      // 4c) Explicit notifyGuests: false suppresses Resend even on material change
      fetchSpy.mockClear();
      const silentMaterialPatch = await patchEventRoute(
        jsonRequest(
          `http://localhost/api/events/${id}`,
          'PATCH',
          {
            title: 'Solstice Feast (Silent Tweaked)',
            notifyGuests: false,
          },
          { 'x-edit-key': editKey },
        ),
        { params: Promise.resolve({ id }) },
      );
      expect(silentMaterialPatch.status).toBe(200);
      expect(fetchSpy).not.toHaveBeenCalled();

      // 4d) Explicit notifyGuests: true sends email even on style-only change
      const forcedStylePatch = await patchEventRoute(
        jsonRequest(
          `http://localhost/api/events/${id}`,
          'PATCH',
          {
            style: {
              themeId: 'cozy-christmas',
              fontId: 'editorial-serif',
              effectId: 'christmas-lights',
              coverPresetId: 'christmas-tree',
              coverLayout: 'square',
            },
            notifyGuests: true,
          },
          { 'x-edit-key': editKey },
        ),
        { params: Promise.resolve({ id }) },
      );
      expect(forcedStylePatch.status).toBe(200);
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // 5. Unchecking emailUpdates (enabled: false) removes subscription
      const disableEmailRes = await postRsvpRoute(
        jsonRequest(
          `http://localhost/api/events/${id}/rsvps`,
          'POST',
          {
            guestName: 'Alice',
            status: 'yes',
            plusOnes: 1,
            emailUpdates: { enabled: false },
          },
          { 'x-guest-token': rsvpAJson.guestToken },
        ),
        { params: Promise.resolve({ id }) },
      );
      expect(disableEmailRes.status).toBe(200);
      const disableJson = await disableEmailRes.json();
      expect(disableJson.detail.viewerSubscription).toBeUndefined();
      expect(disableJson.detail.subscriberCount).toBe(3);

      // 6. DELETE /api/events/[id]/rsvps/[rsvpId] removes the guest's email subscription
      const delBobRes = await deleteRsvpRoute(
        new Request(`http://localhost/api/events/${id}/rsvps/${rsvpBJson.rsvp.id}`, {
          method: 'DELETE',
          headers: { 'x-guest-token': rsvpBJson.guestToken },
        }),
        { params: Promise.resolve({ id, rsvpId: rsvpBJson.rsvp.id }) },
      );
      expect(delBobRes.status).toBe(200);
      const delBobJson = await delBobRes.json();
      expect(delBobJson.deleted).toBe(true);
      expect(delBobJson.detail.subscriberCount).toBe(2);

      const bobAfterDelete = await getEventDetail(id, { guestToken: rsvpBJson.guestToken });
      expect(bobAfterDelete!.viewerSubscription).toBeUndefined();
      expect(bobAfterDelete!.viewerRsvp).toBeUndefined();

      // 7. Zero Vercel Blob list() calls across all v2 reads, RSVPs, comments, and notifications!
      expect(blobMock.list).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
      delete process.env.BLOB_READ_WRITE_TOKEN;
      if (prevKey === undefined) delete process.env.RESEND_API_KEY;
      else process.env.RESEND_API_KEY = prevKey;
      if (prevFrom === undefined) delete process.env.INVITED_FROM_EMAIL;
      else process.env.INVITED_FROM_EMAIL = prevFrom;
      if (prevReplyTo === undefined) delete process.env.INVITED_REPLY_TO;
      else process.env.INVITED_REPLY_TO = prevReplyTo;
      if (prevAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
      else process.env.NEXT_PUBLIC_APP_URL = prevAppUrl;
    }
  });
});
