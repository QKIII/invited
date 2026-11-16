export type RsvpStatus = 'yes' | 'no'; // STRICTLY binary — never 'maybe'

export type AmbientEffectId =
  | 'aurora'
  | 'prism-gradient'
  | 'snowfall'
  | 'rain-glass'
  | 'christmas-lights'
  | 'starlight-radiance'
  | 'halloween-bats'
  | 'autumn-leaves'
  | 'fireworks'
  | 'confetti'
  | 'botanical-petals'
  | 'lullaby-stars'
  | 'floating-hearts'
  | 'champagne-sparkle'
  | 'warm-bokeh'
  | 'none';

export type FontPairingId =
  | 'editorial-serif'
  | 'modern-sans'
  | 'expressive-display'
  | 'sacred-classic'
  | 'playful-rounded'
  | 'studio-mono';

export type CoverLayout = 'square' | 'banner' | 'none';

export type CtaStyleMode = 'gradient' | 'solid';

export interface InviteStyleConfig {
  themeId: string;
  fontId: FontPairingId;
  effectId: AmbientEffectId;
  coverPresetId: string;
  customCoverUrl?: string;
  coverLayout: CoverLayout;
  customSurfaceHex?: string;
  customAccentHex?: string;
  customCtaEndHex?: string;
  ctaStyle?: CtaStyleMode;
  colorMode?: 'dark' | 'light';
}

export interface EventMeta {
  id: string;
  title: string;
  descriptionHtml: string;
  startIso: string;       // ISO 8601 instant or local ISO paired with timeZone
  endIso?: string;
  timeZone: string;       // IANA timezone e.g. 'America/New_York'
  locationName?: string;
  locationAddress?: string;
  virtualUrl?: string;
  hostName?: string;
  rsvpNotePrompt?: string; // e.g. "Bringing a dish or drink? Add a note!"
  invitedNames: string[];  // Optional host-provided expected guest names
  hideGuestList: boolean;
  style: InviteStyleConfig;
  createdAt: string;
  updatedAt: string;
}

export interface StoredEventMeta extends EventMeta {
  editKeyHash: string; // SHA-256 hex of secret editKey — NEVER sent to clients
  storageVersion?: 2;
}

export interface RsvpRecord {
  id: string;
  eventId: string;
  guestName: string;
  status: RsvpStatus;
  plusOnes: number;       // 0 when status === 'no'
  bringingNote?: string;  // Meal / dish / RSVP comment
  createdAt: string;
  updatedAt: string;
}

export interface StoredRsvpRecord extends RsvpRecord {
  guestTokenHash: string; // SHA-256 hex of client's guestToken — NEVER sent to other clients
}

export interface CommentRecord {
  id: string;
  eventId: string;
  authorName: string;
  body: string;
  isHost: boolean;
  rsvpStatus?: RsvpStatus;
  reactions: Record<string, number>; // emoji -> count
  createdAt: string;
}

export interface EventDetailResponse {
  event: EventMeta;
  rsvps: {
    yes: RsvpRecord[];
    no: RsvpRecord[];
    totalHeadcount: number;
    awaitingNames: string[];
  };
  comments: CommentRecord[];
  subscriberCount: number;
  viewerRsvp?: RsvpRecord;
  isHost: boolean;
}
