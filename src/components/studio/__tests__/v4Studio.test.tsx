import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { RichTextEditor } from '@/components/editor/RichTextEditor';
import { GuestAvatar } from '@/components/invite/GuestAvatar';
import { HostManagementPanel } from '@/components/studio/HostManagementPanel';
import { InviteStudio } from '@/components/studio/InviteStudio';
import { PublishSuccessDialog } from '@/components/studio/PublishSuccessDialog';
import { RecentEventsDialog } from '@/components/studio/RecentEventsDialog';
import type { EventDetailResponse, EventMeta } from '@/types/invite';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/u;

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

describe('v4 Studio Prompt-First UX, Cover Filters, Modals & Zero-Emoji UI', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('starts on "What\'s your event?" without a top theme carousel, pre-fills on submit, and filters 36 cover styles', async () => {
    const { container, unmount } = renderIntoDom(<InviteStudio mode="create" />);

    expect(container.querySelector('[data-testid="prompt-entry-card"]')).not.toBeNull();
    expect(container.textContent).toContain("What's your event?");
    expect(container.querySelector('#event-start-date')).toBeNull();
    expect(container.textContent).not.toMatch(EMOJI_RE);

    const promptBox = container.querySelector<HTMLTextAreaElement>(
      '[data-testid="event-prompt-input"]',
    )!;
    expect(promptBox.hasAttribute('autofocus')).toBe(false);
    const continueBtn = container.querySelector<HTMLButtonElement>(
      '[data-testid="prompt-continue-button"]',
    )!;

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
      setter.call(promptBox, 'Christmas dinner Dec 20 at 6pm at 42 Maple St');
      promptBox.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await act(async () => {
      continueBtn.click();
    });

    expect(container.querySelector('[data-testid="prompt-entry-card"]')).toBeNull();
    expect(container.textContent).not.toContain('Write prompt again');
    expect(container.querySelector('[data-testid="edit-theme-button"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="start-over-prompt-button"]')).not.toBeNull();
    expect(container.querySelector('#event-start-date')).not.toBeNull();
    expect(container.textContent).not.toMatch(EMOJI_RE);

    // Open cover style tab inside Edit theme sheet
    const changeCoverBtn = container.querySelector<HTMLButtonElement>(
      '[data-testid="change-cover-button"]',
    )!;
    await act(async () => {
      changeCoverBtn.click();
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 15));
    });

    const dialog = container.querySelector<HTMLDialogElement>('[data-testid="theme-studio-dialog"]')!;
    expect(dialog).not.toBeNull();
    expect(dialog.querySelectorAll('[data-cover-style-group]')).toHaveLength(40);

    for (const group of ['hand-drawn', 'vector', 'pencil', 'oil-paint', 'pattern'] as const) {
      const filterBtn = dialog.querySelector<HTMLButtonElement>(
        `[data-testid="cover-style-filter-${group}"]`,
      )!;
      await act(async () => {
        filterBtn.click();
      });
      expect(dialog.querySelectorAll(`[data-cover-style-group="${group}"]`)).toHaveLength(8);
    }

    const backdropTab = dialog.querySelector<HTMLButtonElement>(
      '[data-testid="studio-tab-backdrop"]',
    )!;
    await act(async () => {
      backdropTab.click();
    });
    expect(dialog.querySelectorAll('[data-effect-option]')).toHaveLength(16);
    expect(dialog.querySelector('[data-effect-option="prism-gradient"]')).not.toBeNull();
    expect(dialog.querySelector('[data-effect-option="rain-glass"]')).not.toBeNull();
    expect(dialog.textContent).not.toMatch(EMOJI_RE);

    unmount();
  });

  it('renders theme-colored icon GuestAvatars and progressive RichTextEditor formatting bar', async () => {
    const avatarRender = renderIntoDom(<GuestAvatar name="Clara" size="md" />);
    const avatarEl = avatarRender.container.querySelector('.invite-avatar');
    expect(avatarEl).not.toBeNull();
    expect(avatarEl?.querySelector('svg')).not.toBeNull();
    expect(avatarEl?.textContent).toBe('');
    expect(avatarEl?.getAttribute('data-avatar-slot')).toMatch(/^[1-6]$/);
    avatarRender.unmount();

    const rte = renderIntoDom(
      <RichTextEditor label="" value="" onChange={() => {}} placeholder="Write notes" />,
    );
    expect(rte.container.querySelector('[aria-label="Description formatting"]')).toBeNull();
    const toggleBtn = rte.container.querySelector<HTMLButtonElement>(
      'button[aria-label="Toggle formatting options"]',
    )!;
    await act(async () => {
      toggleBtn.click();
    });
    expect(rte.container.querySelector('[aria-label="Description formatting"]')).not.toBeNull();
    rte.unmount();
  });

  it('renders RecentEventsDialog, PublishSuccessDialog, and HostManagementPanel with human copy and zero emojis', () => {
    const sampleEvent: EventMeta = {
      id: 'evt_v4_check',
      title: 'Sunday Supper',
      descriptionHtml: '<p>Dinner at 6.</p>',
      startIso: '2026-12-06T18:00:00',
      timeZone: 'America/New_York',
      locationName: '14 Elm St',
      hostName: 'Clara',
      rsvpNotePrompt: 'Bringing anything?',
      invitedNames: ['Sam'],
      hideGuestList: false,
      style: {
        themeId: 'candlelit-dinner',
        fontId: 'editorial-serif',
        effectId: 'warm-bokeh',
        coverPresetId: 'candlelit-table',
        coverLayout: 'banner',
      },
      createdAt: '2026-11-16T08:00:00Z',
      updatedAt: '2026-11-16T08:00:00Z',
    };

    const detail: EventDetailResponse = {
      event: sampleEvent,
      rsvps: {
        yes: [
          {
            id: 'r1',
            eventId: sampleEvent.id,
            guestName: 'Alex',
            status: 'yes',
            plusOnes: 1,
            bringingNote: 'Salad',
            createdAt: '2026-11-16T08:00:00Z',
            updatedAt: '2026-11-16T08:00:00Z',
          },
        ],
        no: [],
        totalHeadcount: 2,
        awaitingNames: ['Sam'],
      },
      comments: [
        {
          id: 'c1',
          eventId: sampleEvent.id,
          authorName: 'Alex',
          body: 'See you then!',
          isHost: false,
          rsvpStatus: 'yes',
          reactions: {},
          createdAt: '2026-11-16T08:00:00Z',
        },
      ],
      subscriberCount: 1,
      isHost: true,
    };

    const r = renderIntoDom(<RecentEventsDialog open={false} onClose={() => {}} />);
    expect(r.container.textContent).toContain('My Invites');
    expect(r.container.textContent).not.toMatch(EMOJI_RE);
    r.unmount();

    const p = renderIntoDom(
      <PublishSuccessDialog
        published={{ id: 'evt_v4_check', editKey: 'key_123', title: 'Sunday Supper' }}
        onClose={() => {}}
      />,
    );
    expect(p.container.textContent).toContain('Your invite is ready');
    expect(p.container.textContent).toContain('Link for guests');
    expect(p.container.textContent).not.toMatch(EMOJI_RE);
    p.unmount();

    const h = renderIntoDom(
      <HostManagementPanel detail={detail} editKey="key_123" onRefresh={async () => {}} />,
    );
    expect(h.container.textContent).toContain('Invite links');
    expect(h.container.textContent).toContain('Going');
    expect(h.container.textContent).not.toMatch(EMOJI_RE);
    h.unmount();
  });
});
