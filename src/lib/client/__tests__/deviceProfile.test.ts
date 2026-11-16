import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearDeviceProfile,
  clearGuestToken,
  formatRelativeCountdown,
  getAvatarAppearance,
  getCachedGuestRsvp,
  getDeviceProfile,
  getProfileAvatarSpec,
  getSavedGuestToken,
  PROFILE_AVATAR_ICONS,
  saveCachedGuestRsvp,
  saveDeviceProfile,
  saveGuestToken,
} from '@/lib/client/deviceProfile';
import type { RsvpRecord } from '@/types/invite';

describe('deviceProfile.ts', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('persists, merges, and clears cross-event device identity in localStorage', () => {
    expect(getDeviceProfile()).toBeNull();

    const first = saveDeviceProfile({ name: 'Ivan Witteborg' });
    expect(first?.name).toBe('Ivan Witteborg');
    expect(typeof first?.avatarHue).toBe('number');
    expect(getDeviceProfile()?.name).toBe('Ivan Witteborg');

    // Adding an email preserves the existing name
    const updated = saveDeviceProfile({ email: 'ivan@example.com' });
    expect(updated?.name).toBe('Ivan Witteborg');
    expect(updated?.email).toBe('ivan@example.com');

    clearDeviceProfile();
    expect(getDeviceProfile()).toBeNull();
  });

  it('stores and clears per-event guest tokens and cached RSVP records', () => {
    saveGuestToken('evt_alpha', 'tok_abc123');
    expect(getSavedGuestToken('evt_alpha')).toBe('tok_abc123');

    const sampleRsvp: RsvpRecord = {
      id: 'rsvp_1',
      eventId: 'evt_alpha',
      guestName: 'Ivan Witteborg',
      status: 'yes',
      plusOnes: 1,
      bringingNote: 'Warm cider',
      createdAt: '2026-11-15T12:00:00Z',
      updatedAt: '2026-11-15T12:00:00Z',
    };
    saveCachedGuestRsvp('evt_alpha', sampleRsvp);
    expect(getCachedGuestRsvp('evt_alpha')).toMatchObject({
      guestName: 'Ivan Witteborg',
      status: 'yes',
      plusOnes: 1,
    });

    clearGuestToken('evt_alpha');
    expect(getSavedGuestToken('evt_alpha')).toBeNull();

    saveCachedGuestRsvp('evt_alpha', null);
    expect(getCachedGuestRsvp('evt_alpha')).toBeNull();
  });

  it('computes deterministic avatar initials, random profile icons, and theme color slots', () => {
    const a = getAvatarAppearance('Ivan Witteborg');
    const b = getAvatarAppearance('Ivan Witteborg');
    expect(a.initials).toBe('IW');
    expect(a.background).toBe(b.background);
    expect(getAvatarAppearance('Clara').initials).toBe('CL');

    const names = ['Ivan', 'Clara', 'Alex', 'Sam', 'Jordan', 'Maya', 'Elena', 'Theo', 'Nora', 'Leo'];
    const specs = names.map((n) => getProfileAvatarSpec(n));
    for (const s of specs) {
      expect(s.slot).toBeGreaterThanOrEqual(1);
      expect(s.slot).toBeLessThanOrEqual(6);
      expect(s.iconIndex).toBeGreaterThanOrEqual(0);
      expect(s.iconIndex).toBeLessThan(PROFILE_AVATAR_ICONS);
    }
    expect(getProfileAvatarSpec('Alex')).toEqual(getProfileAvatarSpec('Alex'));
    expect(new Set(specs.map((s) => s.slot)).size).toBeGreaterThan(2);
    expect(new Set(specs.map((s) => s.iconIndex)).size).toBeGreaterThan(3);
  });

  it('formats relative future countdowns and active states accurately', () => {
    const baseMs = Date.UTC(2026, 11, 1, 12, 0, 0);
    const inDaysHours = new Date(baseMs + (19 * 24 + 18) * 60 * 60 * 1000).toISOString();
    expect(formatRelativeCountdown(inDaysHours, undefined, baseMs)).toBe('Starting in 19d 18h');

    const inHoursMins = new Date(baseMs + (3 * 60 + 25) * 60 * 1000).toISOString();
    expect(formatRelativeCountdown(inHoursMins, undefined, baseMs)).toBe('Starting in 3h 25m');

    const ongoingStart = new Date(baseMs - 30 * 60 * 1000).toISOString();
    const ongoingEnd = new Date(baseMs + 90 * 60 * 1000).toISOString();
    expect(formatRelativeCountdown(ongoingStart, ongoingEnd, baseMs)).toBe('Happening now');

    const endedStart = new Date(baseMs - 5 * 60 * 60 * 1000).toISOString();
    const endedEnd = new Date(baseMs - 2 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeCountdown(endedStart, endedEnd, baseMs)).toBeNull();
  });
});
