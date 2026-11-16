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

describe('v6 Studio Direct Card UX, Live Theme Bottom Sheet, Initials Avatars & Drafts', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('opens directly onto the live invite card, tracks draft state, and opens the non-blurring live theme sheet', async () => {
    const { container, unmount } = renderIntoDom(<InviteStudio mode="create" />);

    expect(container.querySelector('[data-testid="prompt-entry-card"]')).toBeNull();
    expect(container.querySelector('#event-start-date')).not.toBeNull();
    expect(container.querySelector('[data-testid="edit-theme-button"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="change-cover-button"]')).not.toBeNull();
    expect(container.textContent).not.toContain('Start over from a short note');
    expect(container.textContent).not.toMatch(EMOJI_RE);

    // Typing a title shows the Draft pill
    const titleInput = container.querySelector<HTMLTextAreaElement>('textarea[data-title-input]')!;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
      setter.call(titleInput, 'Rooftop Y2K Party');
      titleInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(container.querySelector('[data-testid="create-draft-badge"]')?.textContent).toContain('Draft');

    // Open cover style tab inside non-blurring Theme & Style sheet
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
    expect(dialog.getAttribute('data-live-sheet')).toBe('true');
    expect(dialog.className).toContain('sheet-from-bottom');
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

    const themeTab = dialog.querySelector<HTMLButtonElement>('[data-testid="studio-tab-theme"]')!;
    await act(async () => {
      themeTab.click();
    });
    expect(dialog.querySelector('[data-theme-option="y2k-chrome"]')).not.toBeNull();

    const bgTab = dialog.querySelector<HTMLButtonElement>(
      '[data-testid="studio-tab-background"]',
    )!;
    await act(async () => {
      bgTab.click();
    });
    expect(dialog.querySelectorAll('[data-effect-kind="animated"]')).toHaveLength(17);
    expect(dialog.querySelectorAll('[data-effect-kind="static"]')).toHaveLength(3);
    expect(dialog.querySelector('[data-effect-option="liquid-chrome"]')).not.toBeNull();
    expect(dialog.querySelector('[data-effect-option="cyber-grid"]')).not.toBeNull();
    expect(dialog.querySelector('[data-effect-option="static-glow"]')).not.toBeNull();
    expect(dialog.querySelector('[data-effect-option="static-grain"]')).not.toBeNull();

    const styleTab = dialog.querySelector<HTMLButtonElement>('[data-testid="studio-tab-style"]')!;
    await act(async () => {
      styleTab.click();
    });
    expect(dialog.querySelectorAll('[data-card-style-option]')).toHaveLength(4);
    expect(dialog.textContent).not.toMatch(EMOJI_RE);

    unmount();
  });

  it('renders initials GuestAvatars with theme color slots and progressive RichTextEditor formatting bar', async () => {
    const avatarRender = renderIntoDom(<GuestAvatar name="Clara" size="md" />);
    const avatarEl = avatarRender.container.querySelector('.invite-avatar');
    expect(avatarEl).not.toBeNull();
    expect(avatarEl?.querySelector('svg')).toBeNull();
    expect(avatarEl?.textContent).toBe('CL');
    expect(avatarEl?.getAttribute('data-avatar-slot')).toMatch(/^[1-6]$/);
    avatarRender.unmount();

    const fullAvatar = renderIntoDom(<GuestAvatar name="Ivan Witteborg" size="sm" />);
    expect(fullAvatar.container.querySelector('.invite-avatar')?.textContent).toBe('IW');
    fullAvatar.unmount();

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
