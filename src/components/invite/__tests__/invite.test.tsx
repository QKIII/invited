import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventWall } from '@/components/invite/EventWall';
import { GuestList } from '@/components/invite/GuestList';
import { getGuestTokenStorageKey, RsvpPanel } from '@/components/invite/RsvpPanel';
import { saveDeviceProfile } from '@/lib/client/deviceProfile';
import { SafeRichHtml } from '@/components/invite/SafeRichHtml';
import { SubscribeControl } from '@/components/invite/SubscribeControl';
import {
  buildExternalCalendarUrls,
  buildMapsSearchUrl,
  isSafeExternalHttpUrl,
} from '@/components/invite/calendarLinks';
import { ALLOWED_ATTRIBUTES, ALLOWED_ELEMENTS, safeSetHTML, stripHtmlToText } from '@/lib/sanitize';
import type { CommentRecord, EventDetailResponse, EventMeta, RsvpRecord } from '@/types/invite';

// Tell React 19 testing environment that act() is supported
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function createSampleEvent(overrides: Partial<EventMeta> = {}): EventMeta {
  return {
    id: 'evt_test123',
    title: 'Cozy Christmas Potluck & Cocoa',
    descriptionHtml: '<p>Join us for <strong>warm cider</strong> and games!</p>',
    startIso: '2026-12-20T18:00:00',
    endIso: '2026-12-20T21:00:00',
    timeZone: 'America/New_York',
    locationName: '42 Maple St',
    locationAddress: 'Brooklyn, NY',
    hostName: 'Maya',
    rsvpNotePrompt: 'What dish or drink are you bringing?',
    invitedNames: ['Alex', 'Jordan', 'Taylor'],
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
    ...overrides,
  };
}

function renderIntoDom(element: React.ReactElement): {
  container: HTMLDivElement;
  unmount: () => void;
} {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: Root;
  act(() => {
    root = createRoot(container);
    root.render(element);
  });
  return {
    container,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe('sanitize.ts', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete (Element.prototype as { setHTML?: unknown }).setHTML;
  });

  it('sanitizes XSS vectors and enforces safe anchor rel via DOMPurify fallback', async () => {
    const el = document.createElement('div');
    await safeSetHTML(
      el,
      `<p>Bring <strong>cookies</strong></p>
       <script>window.__xss = true;</script>
       <img src="x" onerror="alert(1)" />
       <a href="javascript:alert(2)" data-evil="1" aria-label="trap">bad</a>
       <a href="https://example.com" target="_blank">good</a>`,
    );

    expect(el.innerHTML).toContain('<strong>cookies</strong>');
    expect(el.querySelector('script')).toBeNull();
    expect(el.querySelector('img')).toBeNull();

    const links = el.querySelectorAll('a');
    expect(links).toHaveLength(2);
    expect(links[0].getAttribute('href')).toBeNull();
    expect(links[0].getAttribute('data-evil')).toBeNull();
    expect(links[0].getAttribute('aria-label')).toBeNull();

    expect(links[1].getAttribute('href')).toBe('https://example.com');
    expect(links[1].getAttribute('rel')).toBe('noopener noreferrer nofollow');
  });

  it('uses native Element.prototype.setHTML when available', async () => {
    const mockSetHTML = vi.fn(function (this: HTMLElement, html: string) {
      this.innerHTML = html;
    });
    Object.defineProperty(Element.prototype, 'setHTML', {
      value: mockSetHTML,
      configurable: true,
    });

    const el = document.createElement('div');
    await safeSetHTML(el, '<p>Hello <a href="javascript:alert(1)">link</a></p>');

    expect(mockSetHTML).toHaveBeenCalledWith(
      '<p>Hello <a href="javascript:alert(1)">link</a></p>',
      {
        sanitizer: {
          elements: ALLOWED_ELEMENTS,
          attributes: ALLOWED_ATTRIBUTES,
        },
      },
    );
    expect(el.querySelector('a')?.getAttribute('href')).toBeNull();
  });

  it('strips rich HTML cleanly to plain text for SSR/metadata', () => {
    const text = stripHtmlToText('<p>Line one</p><p>Line &amp; <strong>two</strong></p>');
    expect(text).toBe('Line one\nLine & two');
  });

  it('SafeRichHtml sanitizes HTML into DOM via safeSetHTML without raw injection', async () => {
    const { container, unmount } = renderIntoDom(
      <SafeRichHtml
        html='<p>Warm <strong>apple cider</strong></p><script>window.__pwn = 1</script>'
        className="invite-prose"
      />,
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    const prose = container.querySelector('.invite-prose:not([hidden])');
    expect(prose).not.toBeNull();
    expect(prose?.innerHTML).toContain('<strong>apple cider</strong>');
    expect(container.querySelector('script')).toBeNull();
    unmount();
  });
});

describe('calendarLinks.ts', () => {
  it('builds Google Calendar and Outlook.com links via Temporal', async () => {
    const event = createSampleEvent();
    const { googleUrl, outlookUrl } = await buildExternalCalendarUrls(
      event,
      'https://invited.app/e/evt_test123',
    );
    expect(googleUrl).toContain('https://calendar.google.com/calendar/render');
    expect(googleUrl).toContain('20261220T230000Z');
    expect(googleUrl).toContain('20261221T020000Z');
    expect(outlookUrl).toContain('https://outlook.live.com/calendar/0/action/compose');
    expect(outlookUrl).toContain('2026-12-20T23%3A00%3A00Z');
  });

  it('validates safe external URLs and builds Maps URL', () => {
    expect(isSafeExternalHttpUrl('https://meet.google.com/abc')).toBe(true);
    expect(isSafeExternalHttpUrl('javascript:alert(1)')).toBe(false);
    expect(buildMapsSearchUrl('42 Maple St', 'Brooklyn, NY')).toContain(
      'https://www.google.com/maps/search/?api=1&query=',
    );
  });
});

describe('RsvpPanel', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders strictly binary Yes / No radio choices with zero middle option', async () => {
    const event = createSampleEvent();
    const onRsvpSuccess = vi.fn();

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        rsvp: {
          id: 'rsvp_1',
          eventId: event.id,
          guestName: 'Alex',
          status: 'yes',
          plusOnes: 1,
          bringingNote: 'Apple pie',
          createdAt: '2026-11-15T12:00:00Z',
          updatedAt: '2026-11-15T12:00:00Z',
        } satisfies RsvpRecord,
        guestToken: 'tok_secret_123',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    function StatefulRsvpHarness() {
      const [name, setName] = useState('');
      const [editing, setEditing] = useState(true);
      return (
        <RsvpPanel
          event={event}
          awaitingNames={event.invitedNames}
          guestToken={null}
          guestName={name}
          onGuestNameChange={setName}
          isEditing={editing}
          onEditingChange={setEditing}
          onRsvpSuccess={onRsvpSuccess}
          onOpenSubscribe={vi.fn()}
        />
      );
    }

    const { container, unmount } = renderIntoDom(<StatefulRsvpHarness />);

    const radios = container.querySelectorAll<HTMLInputElement>('input[type="radio"][name="rsvpStatus"]');
    expect(radios).toHaveLength(2);
    expect(Array.from(radios).map((r) => r.value)).toEqual(['yes', 'no']);
    expect(container.textContent?.toLowerCase()).not.toContain('maybe');

    // Select 'yes'
    await act(async () => {
      radios[0].click();
    });

    // Plus-ones counter should appear
    const plusBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Increase plus-ones"]',
    );
    expect(plusBtn).not.toBeNull();
    await act(async () => {
      plusBtn!.click();
    });

    // Fill name & bringing note
    const nameInput = container.querySelector<HTMLInputElement>('#rsvp-guest-name')!;
    const noteInput = container.querySelector<HTMLTextAreaElement>('#rsvp-bringing-note')!;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      setter.call(nameInput, 'Alex');
      nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
      setter.call(noteInput, 'Apple pie');
      noteInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // Auto-check wall checkbox when note is entered
    const wallCheckbox = container.querySelector<HTMLInputElement>('input[type="checkbox"]');
    expect(wallCheckbox?.checked).toBe(true);

    // Submit form
    const form = container.querySelector('form')!;
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.status).toBe('yes');
    expect(body.plusOnes).toBe(1);
    expect(body.bringingNote).toBe('Apple pie');
    expect(body.postToWall).toBe(true);
    expect(window.localStorage.getItem(getGuestTokenStorageKey(event.id))).toBe('tok_secret_123');
    expect(onRsvpSuccess).toHaveBeenCalledTimes(1);

    unmount();
  });

  it('shows returning-guest sticky bar with Edit RSVP button', () => {
    const event = createSampleEvent();
    const viewerRsvp: RsvpRecord = {
      id: 'rsvp_1',
      eventId: event.id,
      guestName: 'Alex',
      status: 'yes',
      plusOnes: 2,
      bringingNote: 'Hot cocoa',
      createdAt: '2026-11-15T12:00:00Z',
      updatedAt: '2026-11-15T12:00:00Z',
    };
    const onEditingChange = vi.fn();

    const { container, unmount } = renderIntoDom(
      <RsvpPanel
        event={event}
        awaitingNames={[]}
        viewerRsvp={viewerRsvp}
        guestToken="tok_1"
        guestName="Alex"
        onGuestNameChange={vi.fn()}
        isEditing={false}
        onEditingChange={onEditingChange}
        onRsvpSuccess={vi.fn()}
        onOpenSubscribe={vi.fn()}
      />,
    );

    const footer = container.querySelector('[data-testid="sticky-rsvp-footer"]');
    expect(footer?.textContent).toContain("You're going!");
    expect(footer?.textContent).toContain('Hot cocoa');
    const updateBtn = container.querySelector<HTMLButtonElement>('[data-testid="edit-rsvp-button"]');
    expect(updateBtn).not.toBeNull();

    act(() => {
      updateBtn!.click();
    });
    expect(onEditingChange).toHaveBeenCalledWith(true);
    unmount();
  });

  it('auto-recognizes device profile via sticky bar -> modal sheet with One-Click binary RSVP', async () => {
    saveDeviceProfile({ name: 'Ivan', email: 'ivan@example.com' });
    const event = createSampleEvent({ id: 'evt_brand_new' });
    const onRsvpSuccess = vi.fn();

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        rsvp: {
          id: 'rsvp_oneclick',
          eventId: event.id,
          guestName: 'Ivan',
          status: 'yes',
          plusOnes: 0,
          createdAt: '2026-11-15T12:00:00Z',
          updatedAt: '2026-11-15T12:00:00Z',
        },
        guestToken: 'tok_oneclick_999',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    function RecognizedHarness() {
      const [name, setName] = useState('');
      const [editing, setEditing] = useState(false);
      return (
        <RsvpPanel
          event={event}
          awaitingNames={[]}
          guestToken={null}
          guestName={name}
          onGuestNameChange={setName}
          isEditing={editing}
          onEditingChange={setEditing}
          onRsvpSuccess={onRsvpSuccess}
          onOpenSubscribe={vi.fn()}
        />
      );
    }

    const { container, unmount } = renderIntoDom(<RecognizedHarness />);

    const stickyYes = container.querySelector<HTMLButtonElement>('[data-testid="sticky-rsvp-yes"]');
    expect(stickyYes).not.toBeNull();
    expect(container.textContent).toContain("Can't make it");
    expect(container.textContent?.toLowerCase()).not.toContain('maybe');

    await act(async () => {
      stickyYes!.click();
    });

    expect(container.textContent).toContain('Welcome back, Ivan!');

    const form = container.querySelector('form')!;
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/events/evt_brand_new/rsvps',
      expect.objectContaining({ method: 'POST' }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.guestName).toBe('Ivan');
    expect(body.status).toBe('yes');
    expect(onRsvpSuccess).toHaveBeenCalledTimes(1);

    unmount();
  });
});

describe('GuestList', () => {
  it('shows headcount summary, bringing notes, awaiting pre-fill, and private mode', () => {
    const event = createSampleEvent();
    const rsvps: EventDetailResponse['rsvps'] = {
      yes: [
        {
          id: 'r1',
          eventId: event.id,
          guestName: 'Sam',
          status: 'yes',
          plusOnes: 1,
          bringingNote: 'Spiced cider',
          createdAt: '2026-11-15T12:00:00Z',
          updatedAt: '2026-11-15T12:00:00Z',
        },
      ],
      no: [
        {
          id: 'r2',
          eventId: event.id,
          guestName: 'Pat',
          status: 'no',
          plusOnes: 0,
          bringingNote: 'Out of town',
          createdAt: '2026-11-15T12:00:00Z',
          updatedAt: '2026-11-15T12:00:00Z',
        },
      ],
      totalHeadcount: 2,
      awaitingNames: ['Jordan', 'Taylor'],
    };

    const onSelectAwaitingName = vi.fn();
    const { container, unmount } = renderIntoDom(
      <GuestList
        event={event}
        rsvps={rsvps}
        isHost={false}
        onSelectAwaitingName={onSelectAwaitingName}
      />,
    );

    expect(container.textContent).toContain('2 Going');
    expect(container.textContent).toContain('1 Not coming');
    expect(container.textContent).toContain('2 Waiting on');
    expect(container.textContent).toContain('Spiced cider');
    expect(container.textContent).toContain('+1');
    expect(container.textContent).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);

    // Switch to Awaiting Reply tab
    const awaitingTab = container.querySelector<HTMLButtonElement>('#guest-tab-awaiting')!;
    act(() => {
      awaitingTab.click();
    });

    const jordanChip = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Jordan',
    )!;
    act(() => {
      jordanChip.click();
    });
    expect(onSelectAwaitingName).toHaveBeenCalledWith('Jordan');

    unmount();

    // Private guest list test
    const privateEvent = createSampleEvent({ hideGuestList: true });
    const priv = renderIntoDom(
      <GuestList
        event={privateEvent}
        rsvps={rsvps}
        isHost={false}
        onSelectAwaitingName={vi.fn()}
      />,
    );
    expect(priv.container.textContent).toContain(
      'Guest list is kept private by the host — 2 attending so far.',
    );
    expect(priv.container.textContent).not.toContain('Spiced cider');
    priv.unmount();
  });
});

describe('EventWall & SubscribeControl', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('guards against IME composition on Cmd+Enter, supports reactions and host delete', async () => {
    const comments: CommentRecord[] = [
      {
        id: 'c1',
        eventId: 'evt_test123',
        authorName: 'Maya',
        body: 'Doors open at 6pm!',
        isHost: true,
        reactions: { '🎉': 2 },
        createdAt: new Date().toISOString(),
      },
    ];

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        comment: { ...comments[0], reactions: { '🎉': 3 } },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const onCommentsChange = vi.fn();
    const { container, unmount } = renderIntoDom(
      <EventWall
        eventId="evt_test123"
        comments={comments}
        isHost={true}
        editKey="secret_host_key"
        guestToken={null}
        onCommentsChange={onCommentsChange}
        onRefreshDetail={vi.fn()}
      />,
    );

    expect(container.textContent).toContain('Host');
    expect(container.textContent).toContain('Doors open at 6pm!');

    // Reaction button click (renders custom SVG icons without Unicode emojis)
    const partyReactBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.getAttribute('aria-label')?.startsWith('Celebrate'),
    )!;
    expect(partyReactBtn).toBeDefined();
    expect(partyReactBtn.getAttribute('data-reaction')).toBe('🎉');
    expect(container.textContent).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
    await act(async () => {
      partyReactBtn.click();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/events/evt_test123/comments',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ action: 'react', commentId: 'c1', emoji: '🎉', delta: 1 }),
      }),
    );

    // Clicking again toggles off with delta: -1
    await act(async () => {
      partyReactBtn.click();
    });
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/events/evt_test123/comments',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ action: 'react', commentId: 'c1', emoji: '🎉', delta: -1 }),
      }),
    );

    // Host delete button should be visible
    const deleteBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Delete comment by Maya"]',
    );
    expect(deleteBtn).not.toBeNull();

    // IME composing Enter check should NOT submit
    const textarea = container.querySelector<HTMLTextAreaElement>('#wall-comment-body')!;
    const callsBefore = fetchMock.mock.calls.length;
    await act(async () => {
      const ev = new KeyboardEvent('keydown', {
        key: 'Enter',
        metaKey: true,
        bubbles: true,
      });
      Object.defineProperty(ev, 'isComposing', { value: true });
      textarea.dispatchEvent(ev);
    });
    expect(fetchMock.mock.calls.length).toBe(callsBefore);

    unmount();
  });

  it('renders SubscribeControl with closedby="any" dialog and .ics reminder link', () => {
    const { container, unmount } = renderIntoDom(
      <SubscribeControl
        eventId="evt_test123"
        eventTitle="Cozy Christmas"
        subscriberCount={3}
        variant="inline"
      />,
    );

    expect(container.textContent).toContain('Get reminders');
    expect(container.textContent).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
    const dialog = container.querySelector('dialog');
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute('closedby')).toBe('any');
    const icsLink = container.querySelector<HTMLAnchorElement>(
      'a[href="/api/events/evt_test123/ics"]',
    );
    expect(icsLink).not.toBeNull();
    unmount();
  });
});
