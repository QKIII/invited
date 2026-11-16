import {
  generateId,
  generateSecretKey,
  hashSecret,
  verifySecret,
} from '@/lib/crypto/tokens';
import { sanitizePlainText, sanitizeRichHtml } from '@/lib/sanitizeServer';
import {
  deletePath,
  deletePrefix,
  getBinary,
  getJson,
  listPrefix,
  putBinary,
  putJson,
  updateJsonAtomically,
} from '@/lib/storage/adapter';
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '@/lib/storage/errors';
import { validateCoverImage } from '@/lib/storage/media';
import type {
  ActiveEmailNotifyLevel,
  AmbientEffectId,
  CardSurfaceStyle,
  CommentRecord,
  CoverLayout,
  CtaStyleMode,
  EventDetailResponse,
  EventMeta,
  FontPairingId,
  InviteStyleConfig,
  RsvpRecord,
  RsvpStatus,
  StoredEventMeta,
  StoredRsvpRecord,
  ViewerSubscription,
} from '@/types/invite';

export const ALLOWED_REACTION_EMOJIS = [
  '🎉',
  '❤️',
  '🍽️',
  '🥂',
  '🔥',
  '👏',
] as const;

const VALID_FONT_IDS = new Set<FontPairingId>([
  'editorial-serif',
  'modern-sans',
  'expressive-display',
  'sacred-classic',
  'playful-rounded',
  'studio-mono',
  'y2k-display',
]);

const VALID_EFFECT_IDS = new Set<AmbientEffectId>([
  'aurora',
  'prism-gradient',
  'liquid-chrome',
  'cyber-grid',
  'lava-lamp',
  'water-caustics',
  'twilight-clouds',
  'stained-glass',
  'disco-prism',
  'snowfall',
  'rain-glass',
  'christmas-lights',
  'starlight-radiance',
  'halloween-bats',
  'autumn-leaves',
  'fireworks',
  'confetti',
  'botanical-petals',
  'lullaby-stars',
  'floating-hearts',
  'champagne-sparkle',
  'warm-bokeh',
  'fireflies',
  'shooting-stars',
  'paper-lanterns',
  'static-glow',
  'static-grain',
  'static-linen',
  'static-watercolor',
  'none',
]);

const VALID_COVER_LAYOUTS = new Set<CoverLayout>(['square', 'banner', 'none']);
const VALID_CARD_STYLES = new Set<CardSurfaceStyle>(['glass', 'clear', 'solid', 'y2k']);

const SAFE_ID_RE = /^[a-zA-Z0-9_-]{1,80}$/;
const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Normalizes an arbitrary value into a valid active email notification level.
 */
export function normalizeNotifyLevel(value: unknown): ActiveEmailNotifyLevel {
  if (value === 'changes' || value === 'host_posts' || value === 'all_posts') {
    return value;
  }
  return 'host_posts';
}

/**
 * Validates and normalizes an email address string (lowercase, trimmed).
 */
export function normalizeValidEmail(value: unknown): string {
  const rawEmail = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!rawEmail || rawEmail.length > 254 || !EMAIL_RE.test(rawEmail)) {
    throw new ValidationError('Valid email address is required');
  }
  return rawEmail;
}

export interface PushSubscriptionPayload {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface SubscriberRecord {
  id: string;
  eventId: string;
  kind: 'webpush' | 'email';
  subscription?: PushSubscriptionPayload;
  email?: string;
  label?: string;
  notifyLevel?: ActiveEmailNotifyLevel;
  guestTokenHash?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateEventInput {
  title: string;
  descriptionHtml?: string;
  startIso: string;
  endIso?: string;
  timeZone?: string;
  locationName?: string;
  locationAddress?: string;
  virtualUrl?: string;
  hostName?: string;
  rsvpNotePrompt?: string;
  invitedNames?: string[];
  hideGuestList?: boolean;
  style?: Partial<InviteStyleConfig>;
}

export type UpdateEventPatch = Partial<
  Omit<CreateEventInput, 'endIso' | 'locationName' | 'locationAddress' | 'virtualUrl' | 'hostName' | 'rsvpNotePrompt'>
> & {
  endIso?: string | null;
  locationName?: string | null;
  locationAddress?: string | null;
  virtualUrl?: string | null;
  hostName?: string | null;
  rsvpNotePrompt?: string | null;
};

interface CoverMetaSidecar {
  contentType: string;
  filename: string;
  size: number;
  createdAt: string;
}

function assertValidId(value: string, label = 'ID'): string {
  if (!value || typeof value !== 'string' || !SAFE_ID_RE.test(value)) {
    throw new ValidationError(`Invalid ${label}`);
  }
  return value;
}

function eventMetaKey(id: string): string {
  return `events/${id}/meta.json`;
}

function rsvpsCollectionKey(id: string): string {
  return `events/${id}/rsvps.json`;
}

function commentsCollectionKey(id: string): string {
  return `events/${id}/comments.json`;
}

function subscribersCollectionKey(id: string): string {
  return `events/${id}/subscribers.json`;
}

function rsvpKey(id: string, rsvpId: string): string {
  return `events/${id}/rsvps/${rsvpId}.json`;
}

function commentKey(id: string, sortableTs: string, commentId: string): string {
  return `events/${id}/comments/${sortableTs}-${commentId}.json`;
}

function subscriberKey(id: string, subId: string): string {
  return `events/${id}/subscribers/${subId}.json`;
}

function mediaFileKey(id: string, filename: string): string {
  return `events/${id}/media/${filename}`;
}

function tempCoverKey(filename: string): string {
  return `uploads/covers/${filename}`;
}

function stripEventSecret(stored: StoredEventMeta): EventMeta {
  const {
    editKeyHash: _omit,
    storageVersion: _omitVersion,
    ...publicMeta
  } = stored;
  void _omit;
  void _omitVersion;
  return publicMeta;
}

function stripRsvpSecret(stored: StoredRsvpRecord): RsvpRecord {
  const { guestTokenHash: _omit, ...publicRsvp } = stored;
  void _omit;
  return publicRsvp;
}

function validateIsoDateTime(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ValidationError(`${fieldName} is required`);
  }
  const trimmed = value.trim();
  const isoPattern =
    /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?(?:\[[^\]]+\])?)?$/;
  if (!isoPattern.test(trimmed)) {
    throw new ValidationError(`${fieldName} must be a valid ISO date/time`);
  }
  const parsed = Date.parse(trimmed.replace(/\[[^\]]+\]$/, ''));
  if (Number.isNaN(parsed)) {
    throw new ValidationError(`${fieldName} is not a valid calendar date/time`);
  }
  return trimmed;
}

function validateTimeZone(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    return 'UTC';
  }
  const trimmed = value.trim();
  try {
    Intl.DateTimeFormat('en-US', { timeZone: trimmed });
    return trimmed;
  } catch {
    throw new ValidationError(`Invalid IANA time zone: ${trimmed}`);
  }
}

function validateOptionalHttpUrl(
  value: unknown,
  fieldName: string,
): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new ValidationError(`${fieldName} must be a string`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new ValidationError(`${fieldName} must use http:// or https://`);
    }
    return parsed.toString();
  } catch (err) {
    if (err instanceof ValidationError) throw err;
    throw new ValidationError(`${fieldName} is not a valid URL`);
  }
}

function validateOptionalCustomCoverUrl(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new ValidationError('customCoverUrl must be a string');
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  if (trimmed.startsWith('/api/')) {
    return trimmed;
  }
  return validateOptionalHttpUrl(trimmed, 'customCoverUrl');
}

function normalizeOptionalText(
  value: unknown,
  maxLen: number,
): string | undefined {
  if (value === undefined || value === null || typeof value !== 'string') {
    return undefined;
  }
  const cleaned = sanitizePlainText(value, maxLen, { singleLine: true });
  return cleaned || undefined;
}

function normalizeInvitedNames(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }
  const seen = new Set<string>();
  const names: string[] = [];
  for (const item of input) {
    if (typeof item !== 'string') continue;
    const cleaned = sanitizePlainText(item, 100, { singleLine: true });
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      names.push(cleaned);
    }
    if (names.length >= 500) break;
  }
  return names;
}

function normalizeStyle(
  incoming?: Partial<InviteStyleConfig>,
  existing?: InviteStyleConfig,
): InviteStyleConfig {
  const base: InviteStyleConfig = existing ?? {
    themeId: 'aurora-midnight',
    fontId: 'editorial-serif',
    effectId: 'aurora',
    coverPresetId: 'aurora-ridge',
    coverLayout: 'banner',
  };

  if (!incoming) {
    return { ...base };
  }

  const themeId =
    typeof incoming.themeId === 'string' && incoming.themeId.trim()
      ? sanitizePlainText(incoming.themeId, 64, { singleLine: true })
      : base.themeId;

  const fontId =
    incoming.fontId && VALID_FONT_IDS.has(incoming.fontId)
      ? incoming.fontId
      : base.fontId;

  const effectId =
    incoming.effectId && VALID_EFFECT_IDS.has(incoming.effectId)
      ? incoming.effectId
      : base.effectId;

  const coverPresetId =
    typeof incoming.coverPresetId === 'string' && incoming.coverPresetId.trim()
      ? sanitizePlainText(incoming.coverPresetId, 64, { singleLine: true })
      : base.coverPresetId;

  const coverLayout =
    incoming.coverLayout && VALID_COVER_LAYOUTS.has(incoming.coverLayout)
      ? incoming.coverLayout
      : base.coverLayout;

  const isFullStyleReplacement =
    existing !== undefined && typeof incoming.themeId === 'string';

  const customCoverUrl =
    incoming.customCoverUrl !== undefined
      ? validateOptionalCustomCoverUrl(incoming.customCoverUrl)
      : isFullStyleReplacement
        ? undefined
        : base.customCoverUrl;

  const customSurfaceHex =
    incoming.customSurfaceHex !== undefined
      ? validateOptionalHexColor(incoming.customSurfaceHex)
      : isFullStyleReplacement
        ? undefined
        : base.customSurfaceHex;

  const customAccentHex =
    incoming.customAccentHex !== undefined
      ? validateOptionalHexColor(incoming.customAccentHex)
      : isFullStyleReplacement
        ? undefined
        : base.customAccentHex;

  const customCtaEndHex =
    incoming.customCtaEndHex !== undefined
      ? validateOptionalHexColor(incoming.customCtaEndHex)
      : isFullStyleReplacement
        ? undefined
        : base.customCtaEndHex;

  const ctaStyle: CtaStyleMode | undefined =
    incoming.ctaStyle === 'gradient' || incoming.ctaStyle === 'solid'
      ? incoming.ctaStyle
      : isFullStyleReplacement
        ? undefined
        : base.ctaStyle;

  const colorMode =
    incoming.colorMode === 'dark' || incoming.colorMode === 'light'
      ? incoming.colorMode
      : isFullStyleReplacement
        ? undefined
        : base.colorMode;

  const cardStyle =
    incoming.cardStyle && VALID_CARD_STYLES.has(incoming.cardStyle)
      ? incoming.cardStyle
      : isFullStyleReplacement
        ? undefined
        : base.cardStyle;

  return {
    themeId,
    fontId,
    effectId,
    coverPresetId,
    coverLayout,
    ...(cardStyle ? { cardStyle } : {}),
    ...(customCoverUrl ? { customCoverUrl } : {}),
    ...(customSurfaceHex ? { customSurfaceHex } : {}),
    ...(customAccentHex ? { customAccentHex } : {}),
    ...(customCtaEndHex ? { customCtaEndHex } : {}),
    ...(ctaStyle ? { ctaStyle } : {}),
    ...(colorMode ? { colorMode } : {}),
  };
}

function validateOptionalHexColor(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  if (!HEX_COLOR_RE.test(trimmed)) {
    throw new ValidationError(`Invalid hex color: ${trimmed}`);
  }
  return trimmed;
}

async function loadStoredEventOrThrow(id: string): Promise<StoredEventMeta> {
  assertValidId(id, 'event ID');
  const stored = await getJson<StoredEventMeta>(eventMetaKey(id));
  if (!stored) {
    throw new NotFoundError('Event not found');
  }
  return stored;
}

function assertHostAuth(
  editKey: string | null | undefined,
  stored: StoredEventMeta,
): void {
  if (!verifySecret(editKey, stored.editKeyHash)) {
    throw new ForbiddenError('Invalid or missing host edit key');
  }
}

async function findCommentKeyById(
  id: string,
  commentId: string,
): Promise<string | null> {
  assertValidId(commentId, 'comment ID');
  const keys = await listPrefix(`events/${id}/comments/`);
  const suffix = `-${commentId}.json`;
  return keys.find((k) => k.endsWith(suffix)) ?? null;
}

/**
 * Creates a new event and returns its public metadata alongside the one-time secret `editKey`.
 */
export async function createEvent(
  input: CreateEventInput,
): Promise<{ event: EventMeta; editKey: string }> {
  const title = sanitizePlainText(input?.title ?? '', 160, {
    singleLine: true,
  });
  if (!title) {
    throw new ValidationError('Event title is required');
  }

  const startIso = validateIsoDateTime(input?.startIso, 'startIso');
  const endIso =
    input?.endIso !== undefined && input.endIso !== ''
      ? validateIsoDateTime(input.endIso, 'endIso')
      : undefined;
  const timeZone = validateTimeZone(input?.timeZone);
  const descriptionHtml = sanitizeRichHtml(input?.descriptionHtml ?? '');

  const locationName = normalizeOptionalText(input?.locationName, 160);
  const locationAddress = normalizeOptionalText(input?.locationAddress, 240);
  const virtualUrl = validateOptionalHttpUrl(input?.virtualUrl, 'virtualUrl');
  const hostName = normalizeOptionalText(input?.hostName, 100);
  const rsvpNotePrompt = normalizeOptionalText(input?.rsvpNotePrompt, 180);
  const invitedNames = normalizeInvitedNames(input?.invitedNames);
  const hideGuestList = Boolean(input?.hideGuestList);
  const style = normalizeStyle(input?.style);

  const id = generateId(12);
  const editKey = generateSecretKey();
  const editKeyHash = hashSecret(editKey);
  const now = new Date().toISOString();

  const stored: StoredEventMeta = {
    id,
    title,
    descriptionHtml,
    startIso,
    ...(endIso ? { endIso } : {}),
    timeZone,
    ...(locationName ? { locationName } : {}),
    ...(locationAddress ? { locationAddress } : {}),
    ...(virtualUrl ? { virtualUrl } : {}),
    ...(hostName ? { hostName } : {}),
    ...(rsvpNotePrompt ? { rsvpNotePrompt } : {}),
    invitedNames,
    hideGuestList,
    style,
    createdAt: now,
    updatedAt: now,
    editKeyHash,
    storageVersion: 2,
  };

  await putJson(eventMetaKey(id), stored);
  return { event: stripEventSecret(stored), editKey };
}

/**
 * Fetches full event details including RSVPs, comments, and subscriber count
 * while ensuring private hashes and subscriber contact details are never leaked.
 */
export async function getEventDetail(
  id: string,
  options?: { editKey?: string | null; guestToken?: string | null; summaryOnly?: boolean },
): Promise<EventDetailResponse | null> {
  if (!id || typeof id !== 'string' || !SAFE_ID_RE.test(id)) {
    return null;
  }

  const storedMeta = await getJson<StoredEventMeta>(eventMetaKey(id));
  if (!storedMeta) {
    return null;
  }

  let storedRsvps: StoredRsvpRecord[] = [];
  let comments: CommentRecord[] = [];
  let subscribers: SubscriberRecord[] = [];
  let subscriberCount = 0;

  if (storedMeta.storageVersion === 2) {
    if (options?.summaryOnly) {
      storedRsvps = [
        ...((await getJson<StoredRsvpRecord[]>(rsvpsCollectionKey(id))) ?? []),
      ];
    } else {
      const [rawRsvps, rawComments, rawSubscribers] = await Promise.all([
        getJson<StoredRsvpRecord[]>(rsvpsCollectionKey(id)),
        getJson<CommentRecord[]>(commentsCollectionKey(id)),
        getJson<SubscriberRecord[]>(subscribersCollectionKey(id)),
      ]);
      storedRsvps = [...(rawRsvps ?? [])];
      comments = [...(rawComments ?? [])];
      subscribers = [...(rawSubscribers ?? [])];
      subscriberCount = subscribers.length;
    }
  } else if (options?.summaryOnly) {
    const rsvpKeys = await listPrefix(`events/${id}/rsvps/`);
    const rawRsvps = await Promise.all(
      rsvpKeys.map((k) => getJson<StoredRsvpRecord>(k)),
    );
    storedRsvps = rawRsvps.filter((r): r is StoredRsvpRecord => r !== null);
  } else {
    const [rsvpKeys, commentKeys, subscriberKeys] = await Promise.all([
      listPrefix(`events/${id}/rsvps/`),
      listPrefix(`events/${id}/comments/`),
      listPrefix(`events/${id}/subscribers/`),
    ]);

    const [rawRsvps, rawComments, rawSubscribers] = await Promise.all([
      Promise.all(rsvpKeys.map((k) => getJson<StoredRsvpRecord>(k))),
      Promise.all(commentKeys.map((k) => getJson<CommentRecord>(k))),
      options?.guestToken && subscriberKeys.length > 0
        ? Promise.all(subscriberKeys.map((k) => getJson<SubscriberRecord>(k)))
        : Promise.resolve<Array<SubscriberRecord | null>>([]),
    ]);

    storedRsvps = rawRsvps.filter(
      (r): r is StoredRsvpRecord => r !== null,
    );
    comments = rawComments.filter((c): c is CommentRecord => c !== null);
    subscribers = rawSubscribers.filter(
      (s): s is SubscriberRecord => s !== null,
    );
    subscriberCount = subscriberKeys.length;
  }

  storedRsvps.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  comments.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const isHost = verifySecret(options?.editKey, storedMeta.editKeyHash);

  let viewerRsvp: RsvpRecord | undefined;
  let viewerSubscription: ViewerSubscription | undefined;
  if (options?.guestToken) {
    const matched = storedRsvps.find((r) =>
      verifySecret(options.guestToken, r.guestTokenHash),
    );
    if (matched) {
      viewerRsvp = stripRsvpSecret(matched);
    }

    const matchedSub = subscribers.find(
      (r) =>
        r.kind === 'email' &&
        Boolean(r.email) &&
        Boolean(r.guestTokenHash) &&
        verifySecret(options.guestToken, r.guestTokenHash!),
    );
    if (matchedSub && matchedSub.email) {
      viewerSubscription = {
        email: matchedSub.email,
        notifyLevel: matchedSub.notifyLevel ?? 'host_posts',
      };
    }
  }

  const yesAll: RsvpRecord[] = [];
  const noAll: RsvpRecord[] = [];
  const respondedLower = new Set<string>();
  let totalHeadcount = 0;

  for (const record of storedRsvps) {
    const clean = stripRsvpSecret(record);
    respondedLower.add(clean.guestName.trim().toLowerCase());
    if (clean.status === 'yes') {
      yesAll.push(clean);
      totalHeadcount += 1 + Math.max(0, clean.plusOnes || 0);
    } else {
      noAll.push(clean);
    }
  }

  const awaitingAll = storedMeta.invitedNames.filter(
    (name) => !respondedLower.has(name.trim().toLowerCase()),
  );

  const hideListForViewer = storedMeta.hideGuestList && !isHost;

  return {
    event: stripEventSecret(storedMeta),
    rsvps: {
      yes: hideListForViewer ? [] : yesAll,
      no: hideListForViewer ? [] : noAll,
      totalHeadcount,
      awaitingNames: hideListForViewer ? [] : awaitingAll,
    },
    comments,
    subscriberCount,
    ...(viewerRsvp ? { viewerRsvp } : {}),
    ...(viewerSubscription ? { viewerSubscription } : {}),
    isHost,
  };
}

/**
 * Updates mutable event fields after verifying the host capability key,
 * returning both the previous and updated public event metadata.
 */
export async function updateEventWithPrevious(
  id: string,
  editKey: string | null | undefined,
  patch: UpdateEventPatch,
): Promise<{ previous: EventMeta; updated: EventMeta }> {
  const existing = await loadStoredEventOrThrow(id);
  assertHostAuth(editKey, existing);
  const previous = stripEventSecret(existing);

  const nextTitle =
    patch.title !== undefined
      ? sanitizePlainText(patch.title, 160, { singleLine: true })
      : existing.title;
  if (!nextTitle) {
    throw new ValidationError('Event title cannot be empty');
  }

  const nextDescriptionHtml =
    patch.descriptionHtml !== undefined
      ? sanitizeRichHtml(patch.descriptionHtml)
      : existing.descriptionHtml;

  const nextStartIso =
    patch.startIso !== undefined
      ? validateIsoDateTime(patch.startIso, 'startIso')
      : existing.startIso;

  let nextEndIso = existing.endIso;
  if (patch.endIso !== undefined) {
    nextEndIso =
      patch.endIso === null || patch.endIso === ''
        ? undefined
        : validateIsoDateTime(patch.endIso, 'endIso');
  }

  const nextTimeZone =
    patch.timeZone !== undefined
      ? validateTimeZone(patch.timeZone)
      : existing.timeZone;

  const nextLocationName =
    patch.locationName !== undefined
      ? normalizeOptionalText(patch.locationName, 160)
      : existing.locationName;

  const nextLocationAddress =
    patch.locationAddress !== undefined
      ? normalizeOptionalText(patch.locationAddress, 240)
      : existing.locationAddress;

  const nextVirtualUrl =
    patch.virtualUrl !== undefined
      ? validateOptionalHttpUrl(patch.virtualUrl, 'virtualUrl')
      : existing.virtualUrl;

  const nextHostName =
    patch.hostName !== undefined
      ? normalizeOptionalText(patch.hostName, 100)
      : existing.hostName;

  const nextPrompt =
    patch.rsvpNotePrompt !== undefined
      ? normalizeOptionalText(patch.rsvpNotePrompt, 180)
      : existing.rsvpNotePrompt;

  const nextInvitedNames =
    patch.invitedNames !== undefined
      ? normalizeInvitedNames(patch.invitedNames)
      : existing.invitedNames;

  const nextHideGuestList =
    patch.hideGuestList !== undefined
      ? Boolean(patch.hideGuestList)
      : existing.hideGuestList;

  const nextStyle =
    patch.style !== undefined
      ? normalizeStyle(patch.style, existing.style)
      : existing.style;

  const updated: StoredEventMeta = {
    id: existing.id,
    title: nextTitle,
    descriptionHtml: nextDescriptionHtml,
    startIso: nextStartIso,
    ...(nextEndIso ? { endIso: nextEndIso } : {}),
    timeZone: nextTimeZone,
    ...(nextLocationName ? { locationName: nextLocationName } : {}),
    ...(nextLocationAddress ? { locationAddress: nextLocationAddress } : {}),
    ...(nextVirtualUrl ? { virtualUrl: nextVirtualUrl } : {}),
    ...(nextHostName ? { hostName: nextHostName } : {}),
    ...(nextPrompt ? { rsvpNotePrompt: nextPrompt } : {}),
    invitedNames: nextInvitedNames,
    hideGuestList: nextHideGuestList,
    style: nextStyle,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
    editKeyHash: existing.editKeyHash,
    ...(existing.storageVersion ? { storageVersion: existing.storageVersion } : {}),
  };

  await putJson(eventMetaKey(id), updated);
  return { previous, updated: stripEventSecret(updated) };
}

/**
 * Updates mutable event fields after verifying the host capability key.
 */
export async function updateEvent(
  id: string,
  editKey: string | null | undefined,
  patch: UpdateEventPatch,
): Promise<EventMeta> {
  const { updated } = await updateEventWithPrevious(id, editKey, patch);
  return updated;
}

/**
 * Deletes an event and all its sharded RSVPs, comments, subscribers, and media.
 */
export async function deleteEvent(
  id: string,
  editKey: string | null | undefined,
): Promise<void> {
  const existing = await loadStoredEventOrThrow(id);
  assertHostAuth(editKey, existing);
  await deletePrefix(`events/${id}/`);
}

/**
 * Creates or updates a strictly binary ('yes' | 'no') guest RSVP in a sharded file.
 */
export async function upsertRsvp(
  id: string,
  payload: {
    guestName: string;
    status: string;
    plusOnes?: number;
    bringingNote?: string;
    guestToken?: string | null;
    postToWall?: boolean;
  },
): Promise<{
  rsvp: RsvpRecord;
  guestToken: string;
  wallComment?: CommentRecord;
}> {
  const event = await loadStoredEventOrThrow(id);

  if (payload?.status !== 'yes' && payload?.status !== 'no') {
    throw new ValidationError("RSVP status must be strictly 'yes' or 'no'");
  }
  const status: RsvpStatus = payload.status;

  const guestName = sanitizePlainText(payload.guestName ?? '', 100, {
    singleLine: true,
  });
  if (!guestName) {
    throw new ValidationError('Guest name is required');
  }

  let plusOnes = 0;
  if (status === 'yes') {
    const parsed = Number(payload.plusOnes ?? 0);
    plusOnes = Number.isFinite(parsed)
      ? Math.max(0, Math.min(20, Math.trunc(parsed)))
      : 0;
  }

  const bringingNote =
    sanitizePlainText(payload.bringingNote ?? '', 500) || undefined;

  let storedRsvp!: StoredRsvpRecord;
  let guestToken!: string;

  if (event.storageVersion === 2) {
    await updateJsonAtomically<StoredRsvpRecord[]>(
      rsvpsCollectionKey(id),
      [],
      (current) => {
        const existingIndex = payload.guestToken
          ? current.findIndex((r) =>
              verifySecret(payload.guestToken, r.guestTokenHash),
            )
          : -1;
        const existingMatch =
          existingIndex >= 0 ? current[existingIndex] : null;
        const now = new Date().toISOString();
        const rsvpId = existingMatch ? existingMatch.id : generateId(12);
        guestToken =
          existingMatch && payload.guestToken
            ? payload.guestToken.trim()
            : generateSecretKey();
        const guestTokenHash = existingMatch
          ? existingMatch.guestTokenHash
          : hashSecret(guestToken);

        storedRsvp = {
          id: rsvpId,
          eventId: id,
          guestName,
          status,
          plusOnes,
          ...(bringingNote ? { bringingNote } : {}),
          createdAt: existingMatch ? existingMatch.createdAt : now,
          updatedAt: now,
          guestTokenHash,
        };

        const next = [...current];
        if (existingIndex >= 0) {
          next[existingIndex] = storedRsvp;
        } else {
          next.push(storedRsvp);
        }
        return next;
      },
    );
  } else {
    let existingMatch: StoredRsvpRecord | null = null;
    if (payload.guestToken) {
      const rsvpKeys = await listPrefix(`events/${id}/rsvps/`);
      const candidates = await Promise.all(
        rsvpKeys.map((k) => getJson<StoredRsvpRecord>(k)),
      );
      existingMatch =
        candidates.find(
          (r) =>
            r !== null && verifySecret(payload.guestToken, r.guestTokenHash),
        ) ?? null;
    }

    const now = new Date().toISOString();
    const rsvpId = existingMatch ? existingMatch.id : generateId(12);
    guestToken =
      existingMatch && payload.guestToken
        ? payload.guestToken.trim()
        : generateSecretKey();
    const guestTokenHash = existingMatch
      ? existingMatch.guestTokenHash
      : hashSecret(guestToken);

    storedRsvp = {
      id: rsvpId,
      eventId: id,
      guestName,
      status,
      plusOnes,
      ...(bringingNote ? { bringingNote } : {}),
      createdAt: existingMatch ? existingMatch.createdAt : now,
      updatedAt: now,
      guestTokenHash,
    };

    await putJson(rsvpKey(id, rsvpId), storedRsvp);
  }

  let wallComment: CommentRecord | undefined;
  if (payload.postToWall === true && bringingNote) {
    wallComment = await createComment(id, {
      authorName: guestName,
      body: bringingNote,
      rsvpStatus: status,
      guestToken,
    });
  }

  return {
    rsvp: stripRsvpSecret(storedRsvp),
    guestToken,
    ...(wallComment ? { wallComment } : {}),
  };
}

/**
 * Deletes an RSVP when authorized by either the host edit key or the guest's token.
 */
export async function deleteRsvp(
  id: string,
  rsvpId: string,
  auth: { editKey?: string | null; guestToken?: string | null },
): Promise<void> {
  const event = await loadStoredEventOrThrow(id);
  assertValidId(rsvpId, 'RSVP ID');

  const isHost = verifySecret(auth?.editKey, event.editKeyHash);

  if (event.storageVersion === 2) {
    await updateJsonAtomically<StoredRsvpRecord[]>(
      rsvpsCollectionKey(id),
      [],
      (current) => {
        const idx = current.findIndex((r) => r.id === rsvpId);
        if (idx === -1) {
          throw new NotFoundError('RSVP not found');
        }
        const isOwner = verifySecret(
          auth?.guestToken,
          current[idx].guestTokenHash,
        );
        if (!isHost && !isOwner) {
          throw new ForbiddenError('Not authorized to remove this RSVP');
        }
        return current.filter((_, i) => i !== idx);
      },
    );
    if (auth?.guestToken?.trim()) {
      await removeGuestEmailSubscription(id, {
        guestToken: auth.guestToken,
      }).catch(() => {});
    }
    return;
  }

  const key = rsvpKey(id, rsvpId);
  const existing = await getJson<StoredRsvpRecord>(key);
  if (!existing) {
    throw new NotFoundError('RSVP not found');
  }

  const isOwner = verifySecret(auth?.guestToken, existing.guestTokenHash);
  if (!isHost && !isOwner) {
    throw new ForbiddenError('Not authorized to remove this RSVP');
  }

  await deletePath(key);
  if (auth?.guestToken?.trim()) {
    await removeGuestEmailSubscription(id, {
      guestToken: auth.guestToken,
    }).catch(() => {});
  }
}

/**
 * Creates a wall comment stored in its consolidated collection (v2) or sortable shard (v1).
 */
export async function createComment(
  id: string,
  payload: {
    authorName: string;
    body: string;
    editKey?: string | null;
    guestToken?: string | null;
    rsvpStatus?: RsvpStatus;
  },
): Promise<CommentRecord> {
  const event = await loadStoredEventOrThrow(id);

  const authorName = sanitizePlainText(payload?.authorName ?? '', 80, {
    singleLine: true,
  });
  if (!authorName) {
    throw new ValidationError('Author name is required');
  }

  const body = sanitizePlainText(payload?.body ?? '', 1500);
  if (!body) {
    throw new ValidationError('Comment body is required');
  }

  const isHost = verifySecret(payload?.editKey, event.editKeyHash);
  let rsvpStatus: RsvpStatus | undefined =
    payload?.rsvpStatus === 'yes' || payload?.rsvpStatus === 'no'
      ? payload.rsvpStatus
      : undefined;

  if (!rsvpStatus && payload?.guestToken) {
    if (event.storageVersion === 2) {
      const rsvps =
        (await getJson<StoredRsvpRecord[]>(rsvpsCollectionKey(id))) ?? [];
      const matching = rsvps.find((r) =>
        verifySecret(payload.guestToken, r.guestTokenHash),
      );
      if (matching) {
        rsvpStatus = matching.status;
      }
    } else {
      const rsvpKeys = await listPrefix(`events/${id}/rsvps/`);
      const rsvps = await Promise.all(
        rsvpKeys.map((k) => getJson<StoredRsvpRecord>(k)),
      );
      const matching = rsvps.find(
        (r) => r !== null && verifySecret(payload.guestToken, r.guestTokenHash),
      );
      if (matching) {
        rsvpStatus = matching.status;
      }
    }
  }

  const commentId = generateId(10);
  const sortableTs = String(Date.now()).padStart(15, '0');
  const record: CommentRecord = {
    id: commentId,
    eventId: id,
    authorName,
    body,
    isHost,
    ...(rsvpStatus ? { rsvpStatus } : {}),
    reactions: {},
    createdAt: new Date().toISOString(),
  };

  if (event.storageVersion === 2) {
    await updateJsonAtomically<CommentRecord[]>(
      commentsCollectionKey(id),
      [],
      (current) => [...current, record],
    );
    return record;
  }

  await putJson(commentKey(id, sortableTs, commentId), record);
  return record;
}

/**
 * Increments or decrements an allowlisted emoji reaction on a wall comment.
 */
export async function toggleReaction(
  id: string,
  commentId: string,
  emoji: string,
  options?: { delta?: 1 | -1 },
): Promise<CommentRecord> {
  const event = await loadStoredEventOrThrow(id);
  assertValidId(commentId, 'comment ID');

  if (
    !ALLOWED_REACTION_EMOJIS.includes(
      emoji as (typeof ALLOWED_REACTION_EMOJIS)[number],
    )
  ) {
    throw new ValidationError('Unsupported reaction emoji');
  }

  const delta = options?.delta === -1 ? -1 : 1;

  if (event.storageVersion === 2) {
    let updatedComment!: CommentRecord;
    await updateJsonAtomically<CommentRecord[]>(
      commentsCollectionKey(id),
      [],
      (current) => {
        const idx = current.findIndex((c) => c.id === commentId);
        if (idx === -1) {
          throw new NotFoundError('Comment not found');
        }
        const existing = current[idx];
        const reactions: Record<string, number> = {
          ...(existing.reactions ?? {}),
        };
        const nextCount = (reactions[emoji] ?? 0) + delta;
        if (nextCount <= 0) {
          delete reactions[emoji];
        } else {
          reactions[emoji] = nextCount;
        }
        updatedComment = { ...existing, reactions };
        const next = [...current];
        next[idx] = updatedComment;
        return next;
      },
    );
    return updatedComment;
  }

  const key = await findCommentKeyById(id, commentId);
  if (!key) {
    throw new NotFoundError('Comment not found');
  }

  const existing = await getJson<CommentRecord>(key);
  if (!existing) {
    throw new NotFoundError('Comment not found');
  }

  const reactions: Record<string, number> = { ...(existing.reactions ?? {}) };
  const nextCount = (reactions[emoji] ?? 0) + delta;

  if (nextCount <= 0) {
    delete reactions[emoji];
  } else {
    reactions[emoji] = nextCount;
  }

  const updated: CommentRecord = {
    ...existing,
    reactions,
  };

  await putJson(key, updated);
  return updated;
}

/**
 * Deletes a wall comment after verifying the host edit key.
 */
export async function deleteComment(
  id: string,
  commentId: string,
  editKey: string | null | undefined,
): Promise<void> {
  const event = await loadStoredEventOrThrow(id);
  assertHostAuth(editKey, event);
  assertValidId(commentId, 'comment ID');

  if (event.storageVersion === 2) {
    await updateJsonAtomically<CommentRecord[]>(
      commentsCollectionKey(id),
      [],
      (current) => {
        const next = current.filter((c) => c.id !== commentId);
        if (next.length === current.length) {
          throw new NotFoundError('Comment not found');
        }
        return next;
      },
    );
    return;
  }

  const key = await findCommentKeyById(id, commentId);
  if (!key) {
    throw new NotFoundError('Comment not found');
  }

  await deletePath(key);
}

/**
 * Registers a private Web Push or email subscriber for an event (with endpoint/email deduplication).
 */
export async function addSubscriber(
  id: string,
  payload:
    | {
        kind: 'webpush';
        subscription: PushSubscriptionPayload;
        label?: string;
      }
    | {
        kind: 'email';
        email: string;
        label?: string;
        notifyLevel?: ActiveEmailNotifyLevel;
        guestToken?: string | null;
      },
): Promise<{
  id: string;
  eventId: string;
  kind: 'webpush' | 'email';
  createdAt: string;
  notifyLevel?: ActiveEmailNotifyLevel;
  isNewOrChangedEmail: boolean;
}> {
  const event = await loadStoredEventOrThrow(id);
  const label = normalizeOptionalText(payload?.label, 80);

  let validatedPush: { endpointUrl: string; sub: PushSubscriptionPayload } | null =
    null;
  let validatedEmail: string | null = null;
  let emailGuestTokenHash: string | undefined;
  let requestedNotifyLevel: ActiveEmailNotifyLevel | undefined;

  if (payload?.kind === 'webpush') {
    const sub = payload.subscription;
    if (
      !sub ||
      typeof sub.endpoint !== 'string' ||
      !sub.endpoint.trim() ||
      !sub.keys ||
      typeof sub.keys.p256dh !== 'string' ||
      !sub.keys.p256dh.trim() ||
      typeof sub.keys.auth !== 'string' ||
      !sub.keys.auth.trim()
    ) {
      throw new ValidationError('Invalid Web Push subscription payload');
    }

    let endpointUrl: string;
    try {
      const parsed = new URL(sub.endpoint.trim());
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        throw new Error('Unsupported scheme');
      }
      endpointUrl = parsed.toString();
    } catch {
      throw new ValidationError('Invalid Web Push endpoint URL');
    }
    validatedPush = { endpointUrl, sub };
  } else if (payload?.kind === 'email') {
    validatedEmail = normalizeValidEmail(payload.email);
    const trimmedToken =
      typeof payload.guestToken === 'string' ? payload.guestToken.trim() : '';
    emailGuestTokenHash = trimmedToken ? hashSecret(trimmedToken) : undefined;
    requestedNotifyLevel =
      payload.notifyLevel !== undefined
        ? normalizeNotifyLevel(payload.notifyLevel)
        : undefined;
  } else {
    throw new ValidationError("Subscriber kind must be 'webpush' or 'email'");
  }

  const buildRecord = (
    existingRecords: SubscriberRecord[],
  ): {
    record: SubscriberRecord;
    isNewOrChangedEmail: boolean;
  } => {
    if (validatedPush) {
      const { endpointUrl, sub } = validatedPush;
      const duplicate = existingRecords.find(
        (r) =>
          r.kind === 'webpush' && r.subscription?.endpoint === endpointUrl,
      );
      const subId = duplicate ? duplicate.id : generateId(12);
      const createdAt = duplicate
        ? duplicate.createdAt
        : new Date().toISOString();
      return {
        record: {
          id: subId,
          eventId: id,
          kind: 'webpush',
          subscription: {
            endpoint: endpointUrl,
            expirationTime: sub.expirationTime ?? null,
            keys: {
              p256dh: sub.keys.p256dh.trim(),
              auth: sub.keys.auth.trim(),
            },
          },
          ...(label ? { label } : {}),
          createdAt,
        },
        isNewOrChangedEmail: false,
      };
    }

    const rawEmail = validatedEmail!;
    const byToken = emailGuestTokenHash
      ? existingRecords.find(
          (r) => r.kind === 'email' && r.guestTokenHash === emailGuestTokenHash,
        )
      : undefined;
    const byEmail = existingRecords.find(
      (r) => r.kind === 'email' && r.email === rawEmail,
    );
    const duplicate = byToken ?? byEmail;
    const isNewOrChangedEmail = !duplicate || duplicate.email !== rawEmail;
    const subId = duplicate ? duplicate.id : generateId(12);
    const now = new Date().toISOString();
    const createdAt = duplicate ? duplicate.createdAt : now;
    const notifyLevel =
      requestedNotifyLevel ?? duplicate?.notifyLevel ?? 'host_posts';
    const nextGuestTokenHash = emailGuestTokenHash ?? duplicate?.guestTokenHash;
    const nextLabel = label ?? duplicate?.label;

    return {
      record: {
        id: subId,
        eventId: id,
        kind: 'email',
        email: rawEmail,
        notifyLevel,
        ...(nextGuestTokenHash ? { guestTokenHash: nextGuestTokenHash } : {}),
        ...(nextLabel ? { label: nextLabel } : {}),
        createdAt,
        updatedAt: now,
      },
      isNewOrChangedEmail,
    };
  };

  if (event.storageVersion === 2) {
    let saved!: SubscriberRecord;
    let isNewOrChangedEmail = false;
    await updateJsonAtomically<SubscriberRecord[]>(
      subscribersCollectionKey(id),
      [],
      (current) => {
        const built = buildRecord(current);
        saved = built.record;
        isNewOrChangedEmail = built.isNewOrChangedEmail;
        const next: SubscriberRecord[] = [];
        let replaced = false;
        for (const r of current) {
          if (r.id === saved.id) {
            next.push(saved);
            replaced = true;
          } else if (
            saved.kind === 'email' &&
            r.kind === 'email' &&
            (r.email === saved.email ||
              (saved.guestTokenHash &&
                r.guestTokenHash === saved.guestTokenHash))
          ) {
            continue;
          } else {
            next.push(r);
          }
        }
        if (!replaced) {
          next.push(saved);
        }
        return next;
      },
    );
    return {
      id: saved.id,
      eventId: id,
      kind: saved.kind,
      createdAt: saved.createdAt,
      ...(saved.kind === 'email' ? { notifyLevel: saved.notifyLevel } : {}),
      isNewOrChangedEmail,
    };
  }

  const existingKeys = await listPrefix(`events/${id}/subscribers/`);
  const existingRecords = (
    await Promise.all(existingKeys.map((k) => getJson<SubscriberRecord>(k)))
  ).filter((r): r is SubscriberRecord => r !== null);

  const { record, isNewOrChangedEmail } = buildRecord(existingRecords);
  const redundant = existingRecords.filter(
    (r) =>
      r.id !== record.id &&
      record.kind === 'email' &&
      r.kind === 'email' &&
      (r.email === record.email ||
        (record.guestTokenHash && r.guestTokenHash === record.guestTokenHash)),
  );
  await Promise.all([
    putJson(subscriberKey(id, record.id), record),
    ...redundant.map((r) => deletePath(subscriberKey(id, r.id))),
  ]);

  return {
    id: record.id,
    eventId: id,
    kind: record.kind,
    createdAt: record.createdAt,
    ...(record.kind === 'email' ? { notifyLevel: record.notifyLevel } : {}),
    isNewOrChangedEmail,
  };
}

/**
 * Atomically removes any `email` subscriber matching the guest token or lowercase email address.
 */
export async function removeGuestEmailSubscription(
  id: string,
  auth: { guestToken?: string | null; email?: string | null },
): Promise<boolean> {
  const guestToken = auth?.guestToken?.trim() || undefined;
  const email = auth?.email?.trim().toLowerCase() || undefined;
  if (!guestToken && !email) {
    return false;
  }

  const event = await loadStoredEventOrThrow(id);

  const matches = (rec: SubscriberRecord | null): boolean => {
    if (!rec || rec.kind !== 'email') {
      return false;
    }
    if (
      guestToken &&
      rec.guestTokenHash &&
      verifySecret(guestToken, rec.guestTokenHash)
    ) {
      return true;
    }
    if (email && rec.email === email) {
      return true;
    }
    return false;
  };

  if (event.storageVersion === 2) {
    let removed = false;
    await updateJsonAtomically<SubscriberRecord[]>(
      subscribersCollectionKey(id),
      [],
      (current) => {
        const next = current.filter((rec) => !matches(rec));
        removed = next.length < current.length;
        return removed ? next : current;
      },
    );
    return removed;
  }

  const keys = await listPrefix(`events/${id}/subscribers/`);
  const records = await Promise.all(
    keys.map(async (k) => ({ key: k, rec: await getJson<SubscriberRecord>(k) })),
  );
  const matching = records.filter(({ rec }) => matches(rec));
  await Promise.all(matching.map((m) => deletePath(m.key)));
  return matching.length > 0;
}

/**
 * Removes a subscriber record by ID.
 */
export async function removeSubscriber(id: string, subId: string): Promise<void> {
  assertValidId(id, 'event ID');
  assertValidId(subId, 'subscriber ID');

  const storedMeta = await getJson<StoredEventMeta>(eventMetaKey(id));
  if (storedMeta?.storageVersion === 2) {
    await updateJsonAtomically<SubscriberRecord[]>(
      subscribersCollectionKey(id),
      [],
      (current) => {
        const next = current.filter((r) => r.id !== subId);
        return next.length === current.length ? current : next;
      },
    );
    return;
  }

  await deletePath(subscriberKey(id, subId));
}

/**
 * Removes a subscriber matching an ID, Web Push endpoint, or email address.
 */
export async function removeSubscriberByTarget(
  id: string,
  target: { subId?: string; endpoint?: string; email?: string },
): Promise<boolean> {
  const event = await loadStoredEventOrThrow(id);

  if (target.subId) {
    assertValidId(target.subId, 'subscriber ID');
    if (event.storageVersion === 2) {
      await updateJsonAtomically<SubscriberRecord[]>(
        subscribersCollectionKey(id),
        [],
        (current) => {
          const next = current.filter((r) => r.id !== target.subId);
          return next.length === current.length ? current : next;
        },
      );
      return true;
    }
    await deletePath(subscriberKey(id, target.subId));
    return true;
  }

  const endpoint = target.endpoint?.trim();
  const email = target.email?.trim().toLowerCase();
  if (!endpoint && !email) {
    throw new ValidationError(
      'Provide subId, endpoint, or email to unsubscribe',
    );
  }

  const matchesTarget = (rec: SubscriberRecord | null): boolean => {
    if (!rec) return false;
    if (endpoint && rec.kind === 'webpush' && rec.subscription?.endpoint === endpoint) {
      return true;
    }
    if (email && rec.kind === 'email' && rec.email === email) {
      return true;
    }
    return false;
  };

  if (event.storageVersion === 2) {
    let removed = false;
    await updateJsonAtomically<SubscriberRecord[]>(
      subscribersCollectionKey(id),
      [],
      (current) => {
        const next = current.filter((rec) => !matchesTarget(rec));
        removed = next.length < current.length;
        return removed ? next : current;
      },
    );
    return removed;
  }

  const keys = await listPrefix(`events/${id}/subscribers/`);
  const records = await Promise.all(
    keys.map(async (k) => ({ key: k, rec: await getJson<SubscriberRecord>(k) })),
  );

  const matching = records.filter(({ rec }) => matchesTarget(rec));

  await Promise.all(matching.map((m) => deletePath(m.key)));
  return matching.length > 0;
}

/**
 * Internal-only helper for server-side push notification dispatch.
 */
export async function listEventSubscribers(
  id: string,
): Promise<SubscriberRecord[]> {
  assertValidId(id, 'event ID');
  const storedMeta = await getJson<StoredEventMeta>(eventMetaKey(id));
  if (storedMeta?.storageVersion === 2) {
    return (await getJson<SubscriberRecord[]>(subscribersCollectionKey(id))) ?? [];
  }

  const keys = await listPrefix(`events/${id}/subscribers/`);
  const records = await Promise.all(
    keys.map((k) => getJson<SubscriberRecord>(k)),
  );
  return records.filter((r): r is SubscriberRecord => r !== null);
}

/**
 * Saves a validated cover image for an existing event after host authorization.
 */
export async function saveEventCover(
  id: string,
  editKey: string | null | undefined,
  rawBuffer: Buffer,
  declaredMime?: string | null,
): Promise<{ url: string; contentType: string; size: number; event: EventMeta }> {
  const existing = await loadStoredEventOrThrow(id);
  assertHostAuth(editKey, existing);

  const validated = validateCoverImage(rawBuffer, declaredMime);
  const filename = `cover-${generateId(8)}.${validated.extension}`;
  const pathKey = mediaFileKey(id, filename);
  const sidecar: CoverMetaSidecar = {
    contentType: validated.contentType,
    filename,
    size: validated.buffer.length,
    createdAt: new Date().toISOString(),
  };

  await deletePrefix(`events/${id}/media/`);
  await putBinary(pathKey, validated.buffer, validated.contentType);
  await putJson(`${pathKey}.meta.json`, sidecar);

  const url = `/api/events/${id}/cover?file=${encodeURIComponent(filename)}`;
  const updated: StoredEventMeta = {
    ...existing,
    style: {
      ...existing.style,
      customCoverUrl: url,
    },
    updatedAt: new Date().toISOString(),
  };

  await putJson(eventMetaKey(id), updated);

  return {
    url,
    contentType: validated.contentType,
    size: validated.buffer.length,
    event: stripEventSecret(updated),
  };
}

/**
 * Loads an event's uploaded cover image bytes and MIME type.
 */
export async function getEventCover(
  id: string,
  filename?: string | null,
): Promise<{ data: Buffer; contentType: string } | null> {
  if (!id || !SAFE_ID_RE.test(id)) {
    return null;
  }

  const hasExplicitFilename = Boolean(filename?.trim());
  let targetFile = filename?.trim() || '';
  if (targetFile) {
    if (!/^[a-zA-Z0-9_-]{4,64}\.(png|jpg|jpeg|webp|gif)$/.test(targetFile)) {
      return null;
    }
  } else {
    const keys = await listPrefix(`events/${id}/media/`);
    const binaryKeys = keys.filter((k) => !k.endsWith('.meta.json'));
    if (binaryKeys.length === 0) {
      return null;
    }
    const latest = binaryKeys[binaryKeys.length - 1];
    targetFile = latest.slice(`events/${id}/media/`.length);
  }

  const key = mediaFileKey(id, targetFile);
  const [binary, sidecar] = await Promise.all([
    getBinary(key, hasExplicitFilename ? { useCache: true } : undefined),
    getJson<CoverMetaSidecar>(`${key}.meta.json`),
  ]);

  if (!binary) {
    return null;
  }

  return {
    data: binary.data,
    contentType: sidecar?.contentType || binary.contentType,
  };
}

/**
 * Stores a pre-publish cover image upload for use during Studio creation.
 */
export async function saveTempCoverUpload(
  rawBuffer: Buffer,
  declaredMime?: string | null,
): Promise<{ url: string; path: string; contentType: string; size: number }> {
  const validated = validateCoverImage(rawBuffer, declaredMime);
  const filename = `${generateId(16)}.${validated.extension}`;
  const key = tempCoverKey(filename);
  const sidecar: CoverMetaSidecar = {
    contentType: validated.contentType,
    filename,
    size: validated.buffer.length,
    createdAt: new Date().toISOString(),
  };

  await putBinary(key, validated.buffer, validated.contentType);
  await putJson(`${key}.meta.json`, sidecar);

  return {
    url: `/api/uploads/cover?path=${encodeURIComponent(filename)}`,
    path: filename,
    contentType: validated.contentType,
    size: validated.buffer.length,
  };
}

/**
 * Loads a pre-publish cover upload safely by validated filename.
 */
export async function getTempCoverUpload(
  filename: string | null | undefined,
): Promise<{ data: Buffer; contentType: string } | null> {
  if (
    !filename ||
    typeof filename !== 'string' ||
    !/^[a-zA-Z0-9_-]{8,32}\.(png|jpg|jpeg|webp|gif)$/.test(filename.trim())
  ) {
    return null;
  }

  const key = tempCoverKey(filename.trim());
  const [binary, sidecar] = await Promise.all([
    getBinary(key),
    getJson<CoverMetaSidecar>(`${key}.meta.json`),
  ]);

  if (!binary) {
    return null;
  }

  return {
    data: binary.data,
    contentType: sidecar?.contentType || binary.contentType,
  };
}
