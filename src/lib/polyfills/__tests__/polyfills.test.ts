import { afterEach, describe, expect, it, vi } from 'vitest';
import { ensureTemporal, formatEventDateTime } from '@/lib/polyfills/temporal';
import { initModernUiPolyfills, setupDialogLightDismiss } from '@/lib/polyfills/ui';

describe('temporal polyfill & formatting', () => {
  it('ensures global Temporal is available', async () => {
    const t = await ensureTemporal();
    expect(t).toBeDefined();
    expect(typeof t.ZonedDateTime.from).toBe('function');
    expect(globalThis.Temporal).toBe(t);
  });

  it('formats same-day event with optional viewer timezone difference', async () => {
    const formatted = await formatEventDateTime(
      '2026-12-20T19:00:00',
      '2026-12-20T22:00:00',
      'America/New_York',
      'America/Los_Angeles',
    );
    expect(formatted.isMultiDay).toBe(false);
    expect(formatted.dateLabel).toContain('Dec 20, 2026');
    expect(formatted.timeLabel).toContain('7:00 PM');
    expect(formatted.timeLabel).toContain('10:00 PM');
    expect(formatted.timeLabel).toContain('EST');
    expect(formatted.viewerTimeLabel).toContain('4:00 PM');
    expect(formatted.viewerTimeLabel).toContain('PST');
    expect(formatted.viewerTimeLabel).toContain('your time');
  });

  it('omits viewerTimeLabel when viewerTz matches event timezone', async () => {
    const formatted = await formatEventDateTime(
      '2026-12-20T19:00:00',
      undefined,
      'America/New_York',
      'America/New_York',
    );
    expect(formatted.viewerTimeLabel).toBeUndefined();
    expect(formatted.isMultiDay).toBe(false);
  });

  it('formats multi-day instant ISO events accurately', async () => {
    const formatted = await formatEventDateTime(
      '2026-12-31T23:00:00Z',
      '2027-01-01T04:00:00Z',
      'UTC',
    );
    expect(formatted.isMultiDay).toBe(true);
    expect(formatted.dateLabel).toContain('2026');
    expect(formatted.dateLabel).toContain('2027');
  });
});

describe('ui polyfills & dialog light-dismiss', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes modern UI polyfills without throwing in jsdom', async () => {
    const result = await initModernUiPolyfills();
    expect(typeof result.setupDialogLightDismiss).toBe('function');
    expect('popover' in HTMLElement.prototype).toBe(true);
    expect('commandForElement' in HTMLButtonElement.prototype).toBe(true);
  });

  it('closes open dialog on backdrop click outside bounding rect when closedBy is unsupported', () => {
    const dialog = document.createElement('dialog');
    Object.defineProperty(dialog, 'open', { value: true, configurable: true });
    dialog.close = vi.fn();
    dialog.getBoundingClientRect = () =>
      ({
        left: 100,
        top: 100,
        right: 500,
        bottom: 400,
        width: 400,
        height: 300,
        x: 100,
        y: 100,
        toJSON: () => ({}),
      }) as DOMRect;

    const cleanup = setupDialogLightDismiss(dialog);

    // Click inside bounds should not close
    dialog.dispatchEvent(
      new MouseEvent('pointerdown', { bubbles: true, clientX: 200, clientY: 200 }),
    );
    dialog.dispatchEvent(
      new MouseEvent('click', { bubbles: true, clientX: 200, clientY: 200 }),
    );
    expect(dialog.close).not.toHaveBeenCalled();

    // Drag starting inside and releasing outside should not close
    dialog.dispatchEvent(
      new MouseEvent('pointerdown', { bubbles: true, clientX: 200, clientY: 200 }),
    );
    dialog.dispatchEvent(
      new MouseEvent('click', { bubbles: true, clientX: 20, clientY: 20 }),
    );
    expect(dialog.close).not.toHaveBeenCalled();

    // Backdrop pointerdown & click outside bounds should close
    dialog.dispatchEvent(
      new MouseEvent('pointerdown', { bubbles: true, clientX: 20, clientY: 20 }),
    );
    dialog.dispatchEvent(
      new MouseEvent('click', { bubbles: true, clientX: 20, clientY: 20 }),
    );
    expect(dialog.close).toHaveBeenCalledTimes(1);

    cleanup();
  });
});
