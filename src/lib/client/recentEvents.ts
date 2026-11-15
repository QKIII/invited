import type { ParsedEventDraft } from '@/lib/nlp/parseEventPrompt';

export interface RecentEventEntry {
  id: string;
  title: string;
  startIso?: string;
  timeZone?: string;
  locationName?: string;
  themeId?: string;
  guestUrl: string;
  editUrl?: string;
  editKey?: string;
  role: 'host' | 'guest';
  updatedAt: string;
}

const RECENT_EVENTS_KEY = 'invited_recent_events';
const HOST_KEYS_MAP_KEY = 'invited_host_keys';
const STUDIO_DRAFT_KEY = 'invited_studio_draft';
const MAX_RECENT_EVENTS = 50;

const EMPTY_RECENT_EVENTS: RecentEventEntry[] = [];
const listeners = new Set<() => void>();

let cachedCompositeRaw: string | null = null;
let cachedRecentEvents: RecentEventEntry[] = EMPTY_RECENT_EVENTS;
let storageListenerAttached = false;

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

function notifyRecentEventsListeners(): void {
  cachedCompositeRaw = null;
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeRecentEvents(listener: () => void): () => void {
  listeners.add(listener);
  if (isBrowser() && !storageListenerAttached) {
    storageListenerAttached = true;
    window.addEventListener('storage', (event) => {
      if (
        event.key === RECENT_EVENTS_KEY ||
        event.key === HOST_KEYS_MAP_KEY ||
        event.key === null
      ) {
        notifyRecentEventsListeners();
      }
    });
  }
  return () => {
    listeners.delete(listener);
  };
}

export function getRecentEventsServerSnapshot(): RecentEventEntry[] {
  return EMPTY_RECENT_EVENTS;
}

function readHostKeysMap(): Record<string, string> {
  if (!isBrowser()) return {};
  try {
    const raw = window.localStorage.getItem(HOST_KEYS_MAP_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const result: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === 'string' && v.trim()) {
          result[k] = v;
        }
      }
      return result;
    }
  } catch {
    // Ignore storage read/parse errors
  }
  return {};
}

function writeHostKeysMap(map: Record<string, string>): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(HOST_KEYS_MAP_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage quota/access errors
  }
}

function writeRecentEvents(entries: RecentEventEntry[]): RecentEventEntry[] {
  const sorted = [...entries]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, MAX_RECENT_EVENTS);
  if (isBrowser()) {
    try {
      window.localStorage.setItem(RECENT_EVENTS_KEY, JSON.stringify(sorted));
    } catch {
      // Ignore storage quota/access errors
    }
  }
  notifyRecentEventsListeners();
  return sorted;
}

export function getRecentEvents(): RecentEventEntry[] {
  if (!isBrowser()) return EMPTY_RECENT_EVENTS;
  try {
    const rawEvents = window.localStorage.getItem(RECENT_EVENTS_KEY) ?? '';
    const rawKeys = window.localStorage.getItem(HOST_KEYS_MAP_KEY) ?? '';
    const composite = `${rawEvents}::${rawKeys}`;
    if (cachedCompositeRaw === composite) {
      return cachedRecentEvents;
    }

    if (!rawEvents) {
      cachedCompositeRaw = composite;
      cachedRecentEvents = EMPTY_RECENT_EVENTS;
      return cachedRecentEvents;
    }

    const parsed: unknown = JSON.parse(rawEvents);
    if (!Array.isArray(parsed)) {
      cachedCompositeRaw = composite;
      cachedRecentEvents = EMPTY_RECENT_EVENTS;
      return cachedRecentEvents;
    }

    const hostMap = readHostKeysMap();
    const mapped = parsed
      .filter(
        (item): item is RecentEventEntry =>
          Boolean(item) &&
          typeof item === 'object' &&
          typeof (item as RecentEventEntry).id === 'string' &&
          typeof (item as RecentEventEntry).title === 'string',
      )
      .map((entry) => {
        const key = entry.editKey || hostMap[entry.id];
        return {
          ...entry,
          guestUrl: entry.guestUrl || `/e/${entry.id}`,
          editKey: key,
          editUrl: key
            ? `/e/${entry.id}/edit?key=${encodeURIComponent(key)}`
            : entry.editUrl,
          role: (key
            ? 'host'
            : entry.role === 'host'
              ? 'host'
              : 'guest') as 'host' | 'guest',
        };
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

    cachedCompositeRaw = composite;
    cachedRecentEvents = mapped;
    return cachedRecentEvents;
  } catch {
    return EMPTY_RECENT_EVENTS;
  }
}

export function saveHostKey(eventId: string, editKey: string): void {
  if (!isBrowser() || !eventId || !editKey.trim()) return;
  const trimmedKey = editKey.trim();
  const map = readHostKeysMap();
  map[eventId] = trimmedKey;
  writeHostKeysMap(map);

  const existing = getRecentEvents();
  const match = existing.find((item) => item.id === eventId);
  if (match) {
    const updated = existing.map((item) =>
      item.id === eventId
        ? {
            ...item,
            editKey: trimmedKey,
            editUrl: `/e/${eventId}/edit?key=${encodeURIComponent(trimmedKey)}`,
            role: 'host' as const,
            updatedAt: new Date().toISOString(),
          }
        : item,
    );
    writeRecentEvents(updated);
  } else {
    notifyRecentEventsListeners();
  }
}

export function getSavedHostKey(eventId: string): string | null {
  if (!isBrowser() || !eventId) return null;
  const map = readHostKeysMap();
  if (map[eventId]) {
    return map[eventId];
  }
  const match = getRecentEvents().find((item) => item.id === eventId);
  return match?.editKey ?? null;
}

export function rememberHostEvent(params: {
  id: string;
  title: string;
  startIso?: string;
  timeZone?: string;
  locationName?: string;
  themeId?: string;
  editKey: string;
}): RecentEventEntry[] {
  const trimmedKey = params.editKey.trim();
  if (trimmedKey) {
    const map = readHostKeysMap();
    map[params.id] = trimmedKey;
    writeHostKeysMap(map);
  }

  const now = new Date().toISOString();
  const existing = getRecentEvents().filter((item) => item.id !== params.id);
  const nextEntry: RecentEventEntry = {
    id: params.id,
    title: params.title.trim() || 'Untitled Event',
    startIso: params.startIso,
    timeZone: params.timeZone,
    locationName: params.locationName,
    themeId: params.themeId,
    guestUrl: `/e/${params.id}`,
    editUrl: trimmedKey
      ? `/e/${params.id}/edit?key=${encodeURIComponent(trimmedKey)}`
      : undefined,
    editKey: trimmedKey || undefined,
    role: 'host',
    updatedAt: now,
  };

  return writeRecentEvents([nextEntry, ...existing]);
}

export function rememberVisitedEvent(params: {
  id: string;
  title: string;
  startIso?: string;
  timeZone?: string;
  locationName?: string;
  themeId?: string;
}): RecentEventEntry[] {
  const existing = getRecentEvents();
  const prev = existing.find((item) => item.id === params.id);
  const hostMap = readHostKeysMap();
  const existingKey = prev?.editKey || hostMap[params.id];

  const now = new Date().toISOString();
  const nextEntry: RecentEventEntry = {
    id: params.id,
    title: params.title.trim() || prev?.title || 'Untitled Event',
    startIso: params.startIso ?? prev?.startIso,
    timeZone: params.timeZone ?? prev?.timeZone,
    locationName: params.locationName ?? prev?.locationName,
    themeId: params.themeId ?? prev?.themeId,
    guestUrl: `/e/${params.id}`,
    editKey: existingKey,
    editUrl: existingKey
      ? `/e/${params.id}/edit?key=${encodeURIComponent(existingKey)}`
      : prev?.editUrl,
    role: existingKey ? 'host' : 'guest',
    updatedAt: now,
  };

  return writeRecentEvents([
    nextEntry,
    ...existing.filter((item) => item.id !== params.id),
  ]);
}

export function removeRecentEvent(eventId: string): RecentEventEntry[] {
  const map = readHostKeysMap();
  if (eventId in map) {
    delete map[eventId];
    writeHostKeysMap(map);
  }
  const filtered = getRecentEvents().filter((item) => item.id !== eventId);
  return writeRecentEvents(filtered);
}

export function extractEditKeyFromInput(rawInput: string): string {
  const trimmed = rawInput.trim();
  if (!trimmed) return '';

  if (
    trimmed.includes('://') ||
    trimmed.includes('?') ||
    trimmed.includes('key=')
  ) {
    try {
      const parsedUrl = trimmed.includes('://')
        ? new URL(trimmed)
        : new URL(
            trimmed.startsWith('/')
              ? `https://invited.local${trimmed}`
              : `https://invited.local/?${trimmed.replace(/^\?/, '')}`,
          );
      const keyParam = parsedUrl.searchParams.get('key');
      if (keyParam) {
        return keyParam.trim();
      }
    } catch {
      const match = trimmed.match(/[?&]key=([^&#\s]+)/);
      if (match?.[1]) {
        try {
          return decodeURIComponent(match[1]).trim();
        } catch {
          return match[1].trim();
        }
      }
    }
  }

  return trimmed;
}

export function saveStudioDraft(draft: ParsedEventDraft): void {
  if (!isBrowser()) return;
  try {
    window.sessionStorage.setItem(STUDIO_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Ignore storage quota/access errors
  }
}

export function consumeStudioDraft(): ParsedEventDraft | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.sessionStorage.getItem(STUDIO_DRAFT_KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(STUDIO_DRAFT_KEY);
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === 'object' &&
      'title' in parsed &&
      'style' in parsed
    ) {
      return parsed as ParsedEventDraft;
    }
  } catch {
    // Ignore storage read/parse errors
  }
  return null;
}
