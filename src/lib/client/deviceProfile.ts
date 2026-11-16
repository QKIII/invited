import type { RsvpRecord } from '@/types/invite';

export interface DeviceProfile {
  name: string;
  email?: string;
  avatarHue: number;
  updatedAt: string;
}

const DEVICE_PROFILE_KEY = 'invited_device_profile_v1';
const GUEST_TOKENS_MAP_KEY = 'invited_guest_tokens_v1';
const GUEST_RSVPS_CACHE_KEY = 'invited_guest_rsvps_v1';
const LEGACY_GUEST_TOKEN_PREFIX = 'invited_guest_tokens:';

const profileListeners = new Set<() => void>();
let cachedProfileRaw: string | null = null;
let cachedProfile: DeviceProfile | null = null;
let storageListenerAttached = false;

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

function notifyProfileListeners(): void {
  cachedProfileRaw = null;
  for (const listener of profileListeners) {
    listener();
  }
}

export const PROFILE_AVATAR_ICONS = 16;

function fnv1aHash(input: string, seed: number): number {
  let hash = seed >>> 0;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

/**
 * Deterministic 0..359 hue hash from a display name so each guest keeps a consistent avatar color.
 */
export function computeAvatarHue(name: string): number {
  const clean = name.trim().toLowerCase();
  if (!clean) return 210;
  let hash = 0;
  for (let i = 0; i < clean.length; i += 1) {
    hash = (hash * 31 + clean.charCodeAt(i)) >>> 0;
  }
  return hash % 360;
}

/**
 * Extracts up to 2 uppercase initials from a name.
 */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/**
 * Computes soft Luma-style pastel-to-rich radial gradient styling for a circular guest avatar.
 */
export function getAvatarAppearance(name: string): {
  background: string;
  color: string;
  initials: string;
} {
  const hue = computeAvatarHue(name);
  const altHue = (hue + 38) % 360;
  return {
    background: `linear-gradient(135deg, hsl(${hue} 78% 72%), hsl(${altHue} 72% 58%))`,
    color: '#0f172a',
    initials: getInitials(name),
  };
}

/**
 * Deterministically assigns one of 16 profile icon designs and 1 of 6 theme color slots per name.
 */
export function getProfileAvatarSpec(name: string): {
  slot: 1 | 2 | 3 | 4 | 5 | 6;
  iconIndex: number;
  initials: string;
} {
  const clean = name.trim().toLowerCase() || 'guest';
  const slotHash = fnv1aHash(clean, 0x811c9dc5);
  const iconHash = fnv1aHash(`${clean}:icon`, 0x9e3779b1);
  const slot = ((slotHash % 6) + 1) as 1 | 2 | 3 | 4 | 5 | 6;
  const iconIndex = iconHash % PROFILE_AVATAR_ICONS;
  return {
    slot,
    iconIndex,
    initials: getInitials(name),
  };
}

export function subscribeDeviceProfile(listener: () => void): () => void {
  profileListeners.add(listener);
  if (isBrowser() && !storageListenerAttached) {
    storageListenerAttached = true;
    window.addEventListener('storage', (event) => {
      if (event.key === DEVICE_PROFILE_KEY || event.key === null) {
        notifyProfileListeners();
      }
    });
  }
  return () => {
    profileListeners.delete(listener);
  };
}

export function getDeviceProfileServerSnapshot(): DeviceProfile | null {
  return null;
}

export function getDeviceProfile(): DeviceProfile | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(DEVICE_PROFILE_KEY) ?? '';
    if (cachedProfileRaw === raw) {
      return cachedProfile;
    }
    if (!raw) {
      cachedProfileRaw = raw;
      cachedProfile = null;
      return null;
    }
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof (parsed as DeviceProfile).name === 'string'
    ) {
      const name = (parsed as DeviceProfile).name.trim();
      if (!name) {
        cachedProfileRaw = raw;
        cachedProfile = null;
        return null;
      }
      const email =
        typeof (parsed as DeviceProfile).email === 'string' &&
        (parsed as DeviceProfile).email?.trim()
          ? (parsed as DeviceProfile).email?.trim()
          : undefined;
      const avatarHue =
        typeof (parsed as DeviceProfile).avatarHue === 'number'
          ? (parsed as DeviceProfile).avatarHue
          : computeAvatarHue(name);
      const updatedAt =
        typeof (parsed as DeviceProfile).updatedAt === 'string'
          ? (parsed as DeviceProfile).updatedAt
          : new Date().toISOString();

      cachedProfileRaw = raw;
      cachedProfile = {
        name,
        ...(email ? { email } : {}),
        avatarHue,
        updatedAt,
      };
      return cachedProfile;
    }
  } catch {
    // Ignore storage read/parse errors
  }
  return null;
}

export function saveDeviceProfile(patch: {
  name?: string;
  email?: string;
}): DeviceProfile | null {
  if (!isBrowser()) return null;
  const current = getDeviceProfile();
  const nextName = (patch.name ?? current?.name ?? '').trim().slice(0, 100);
  if (!nextName) return null;

  const rawEmail = patch.email !== undefined ? patch.email : current?.email;
  const nextEmail =
    typeof rawEmail === 'string' && rawEmail.trim() ? rawEmail.trim() : undefined;

  const nextProfile: DeviceProfile = {
    name: nextName,
    ...(nextEmail ? { email: nextEmail } : {}),
    avatarHue: computeAvatarHue(nextName),
    updatedAt: new Date().toISOString(),
  };

  try {
    window.localStorage.setItem(DEVICE_PROFILE_KEY, JSON.stringify(nextProfile));
  } catch {
    // Ignore storage quota / private mode issues
  }
  notifyProfileListeners();
  return nextProfile;
}

export function clearDeviceProfile(): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(DEVICE_PROFILE_KEY);
  } catch {
    // Ignore storage errors
  }
  notifyProfileListeners();
}

export function getGuestTokenStorageKey(eventId: string): string {
  return `${LEGACY_GUEST_TOKEN_PREFIX}${eventId}`;
}

function readJsonRecord<T>(storageKey: string): Record<string, T> {
  if (!isBrowser()) return {};
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, T>;
    }
  } catch {
    // Ignore parse errors
  }
  return {};
}

function writeJsonRecord<T>(storageKey: string, map: Record<string, T>): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(map));
  } catch {
    // Ignore storage errors
  }
}

export function getSavedGuestToken(eventId: string): string | null {
  if (!isBrowser() || !eventId) return null;
  try {
    const legacy = window.localStorage.getItem(getGuestTokenStorageKey(eventId));
    if (legacy && legacy.trim()) {
      return legacy.trim();
    }
    const map = readJsonRecord<string>(GUEST_TOKENS_MAP_KEY);
    const mapped = map[eventId];
    return typeof mapped === 'string' && mapped.trim() ? mapped.trim() : null;
  } catch {
    return null;
  }
}

export function saveGuestToken(eventId: string, token: string): void {
  if (!isBrowser() || !eventId || !token.trim()) return;
  const trimmed = token.trim();
  try {
    window.localStorage.setItem(getGuestTokenStorageKey(eventId), trimmed);
    const map = readJsonRecord<string>(GUEST_TOKENS_MAP_KEY);
    map[eventId] = trimmed;
    writeJsonRecord(GUEST_TOKENS_MAP_KEY, map);
  } catch {
    // Ignore storage errors
  }
}

export function clearGuestToken(eventId: string): void {
  if (!isBrowser() || !eventId) return;
  try {
    window.localStorage.removeItem(getGuestTokenStorageKey(eventId));
    const map = readJsonRecord<string>(GUEST_TOKENS_MAP_KEY);
    if (eventId in map) {
      delete map[eventId];
      writeJsonRecord(GUEST_TOKENS_MAP_KEY, map);
    }
  } catch {
    // Ignore storage errors
  }
}

export function getCachedGuestRsvp(eventId: string): RsvpRecord | null {
  if (!isBrowser() || !eventId) return null;
  const map = readJsonRecord<RsvpRecord>(GUEST_RSVPS_CACHE_KEY);
  const candidate = map[eventId];
  if (
    candidate &&
    typeof candidate === 'object' &&
    typeof candidate.id === 'string' &&
    typeof candidate.guestName === 'string' &&
    (candidate.status === 'yes' || candidate.status === 'no')
  ) {
    return candidate;
  }
  return null;
}

export function saveCachedGuestRsvp(
  eventId: string,
  rsvp: RsvpRecord | null,
): void {
  if (!isBrowser() || !eventId) return;
  const map = readJsonRecord<RsvpRecord>(GUEST_RSVPS_CACHE_KEY);
  if (rsvp) {
    map[eventId] = rsvp;
  } else {
    delete map[eventId];
  }
  writeJsonRecord(GUEST_RSVPS_CACHE_KEY, map);
}

/**
 * Formats a Luma-style relative countdown badge for upcoming or active events.
 */
export function formatRelativeCountdown(
  startIso: string,
  endIso?: string,
  nowMs: number = Date.now(),
): string | null {
  const startMs = Date.parse(startIso.replace(/\[[^\]]+\]$/, ''));
  if (Number.isNaN(startMs)) return null;

  const diffMs = startMs - nowMs;
  if (diffMs > 0) {
    const totalMinutes = Math.max(1, Math.round(diffMs / 60_000));
    const totalHours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;

    if (days >= 1) {
      return hours > 0 ? `Starting in ${days}d ${hours}h` : `Starting in ${days}d`;
    }
    if (totalHours >= 1) {
      return mins > 0 ? `Starting in ${totalHours}h ${mins}m` : `Starting in ${totalHours}h`;
    }
    return `Starting in ${totalMinutes}m`;
  }

  if (endIso) {
    const endMs = Date.parse(endIso.replace(/\[[^\]]+\]$/, ''));
    if (!Number.isNaN(endMs) && nowMs <= endMs) {
      return 'Happening now';
    }
  } else if (nowMs - startMs <= 3 * 60 * 60 * 1000) {
    return 'Happening now';
  }

  return null;
}
