import * as chrono from 'chrono-node';
import type { CoverLayout, InviteStyleConfig } from '@/types/invite';
import { getThemePreset } from '@/lib/themes/presets';

export interface ParsedEventDraft {
  title: string;
  startIso: string;
  endIso?: string;
  hasExplicitDate?: boolean;
  hasExplicitTime?: boolean;
  timeZone: string;
  locationName?: string;
  locationAddress?: string;
  virtualUrl?: string;
  hostName?: string;
  descriptionHtml: string;
  rsvpNotePrompt: string;
  detectedOccasionLabel: string;
  style: InviteStyleConfig;
  confidenceChips: Array<{ icon: string; label: string; value: string }>;
}

export const EXAMPLE_EVENT_PROMPTS: Array<{
  label: string;
  prompt: string;
}> = [
  {
    label: 'Christmas Party',
    prompt: "Christmas party on the 9th at 3pm at 42 Maple St",
  },
  {
    label: 'Candlelight Service',
    prompt: 'Candlelight service celebrating Jesus birth Dec 24 at 7pm at Grace Chapel',
  },
  {
    label: 'Halloween Party',
    prompt: 'Halloween costume party Oct 31 at 8pm at The Old Carriage House',
  },
  {
    label: 'Friendsgiving',
    prompt: "Friendsgiving potluck Nov 26 at 5pm at Maya's place",
  },
  {
    label: '4th of July BBQ',
    prompt: '4th of July BBQ at Riverside Park at 5pm',
  },
  {
    label: 'Baby Shower',
    prompt: "Emma's baby shower next Saturday at 2pm at 118 Blossom Lane",
  },
];

interface OccasionRule {
  id: string;
  themeId: string;
  label: string;
  defaultTitle: string;
  defaultHour: number;
  defaultMinute: number;
  coverLayout: CoverLayout;
  rsvpNotePrompt: string;
  priority: number;
  keywords: RegExp[];
  buildDescription: (ctx: { title: string; location?: string; extraNote?: string }) => string;
}

const OCCASION_RULES: OccasionRule[] = [
  {
    id: 'sacred-nativity',
    themeId: 'sacred-nativity',
    label: 'Sacred & Candlelight',
    defaultTitle: 'Candlelight Service',
    defaultHour: 19,
    defaultMinute: 0,
    coverLayout: 'banner',
    rsvpNotePrompt: 'Share a note or anything you plan to bring',
    priority: 100,
    keywords: [
      /\bjesus\b/i,
      /\bnativity\b/i,
      /\bchrist\b/i,
      /\bcandlelight\b/i,
      /\bbaptism\b/i,
      /\bgood friday\b/i,
      /\bchristmas eve\b/i,
      /\badvent\b/i,
      /\bworship\b/i,
      /\bchurch\b/i,
      /\bchapel\b/i,
      /\bsacred\b/i,
      /\beaster\s+(?:sunday|service|sunrise|vigil)\b/i,
    ],
    buildDescription: ({ extraNote }) =>
      [
        `<p>Join us for a warm evening of candlelight, music, and time together.</p>`,
        extraNote ? `<p><strong>Note from the host:</strong> ${escapeHtml(extraNote)}</p>` : '',
      ]
        .filter(Boolean)
        .join(''),
  },
  {
    id: 'cozy-christmas',
    themeId: 'cozy-christmas',
    label: 'Christmas',
    defaultTitle: 'Christmas Party',
    defaultHour: 18,
    defaultMinute: 0,
    coverLayout: 'banner',
    rsvpNotePrompt: 'Bringing a snack, drink, or treat? Let everyone know.',
    priority: 90,
    keywords: [
      /\bchristmas\b/i,
      /\bxmas\b/i,
      /\bugly sweater\b/i,
      /\bwhite elephant\b/i,
      /\bsecret santa\b/i,
      /\bsanta\b/i,
      /\bmistletoe\b/i,
      /\bgingerbread\b/i,
      /\btree lighting\b/i,
      /\bholiday party\b/i,
      /\bhot cocoa\b/i,
    ],
    buildDescription: ({ extraNote }) =>
      [
        `<p>Come celebrate the season with good food, warm drinks, and friends.</p>`,
        extraNote ? `<p>${escapeHtml(extraNote)}</p>` : '',
      ]
        .filter(Boolean)
        .join(''),
  },
  {
    id: 'spooky-halloween',
    themeId: 'spooky-halloween',
    label: 'Halloween',
    defaultTitle: 'Halloween Party',
    defaultHour: 20,
    defaultMinute: 0,
    coverLayout: 'banner',
    rsvpNotePrompt: 'Let us know what snack, drink, or dish you are bringing.',
    priority: 88,
    keywords: [
      /\bhalloween\b/i,
      /\bspooky\b/i,
      /\bcostume\b/i,
      /\bhaunted\b/i,
      /\btrick or treat\b/i,
      /\bpumpkin\b/i,
      /\bmasquerade\b/i,
      /\boct(?:ober)?\s*31\b/i,
    ],
    buildDescription: ({ extraNote }) =>
      [
        `<p>Wear a costume if you would like and stop by for drinks, snacks, and music.</p>`,
        extraNote ? `<p>${escapeHtml(extraNote)}</p>` : '',
      ]
        .filter(Boolean)
        .join(''),
  },
  {
    id: 'warm-thanksgiving',
    themeId: 'warm-thanksgiving',
    label: 'Thanksgiving',
    defaultTitle: 'Friendsgiving Dinner',
    defaultHour: 17,
    defaultMinute: 0,
    coverLayout: 'banner',
    rsvpNotePrompt: 'Tell everyone which dish, side, or drink you are bringing.',
    priority: 87,
    keywords: [
      /\bthanksgiving\b/i,
      /\bfriendsgiving\b/i,
      /\bturkey\b/i,
      /\bharvest\b/i,
      /\bgratitude\b/i,
    ],
    buildDescription: ({ extraNote }) =>
      [
        `<p>Pull up a chair for dinner and a relaxed night together. Drop what dish you are bringing in your RSVP.</p>`,
        extraNote ? `<p>${escapeHtml(extraNote)}</p>` : '',
      ]
        .filter(Boolean)
        .join(''),
  },
  {
    id: 'fourth-of-july',
    themeId: 'fourth-of-july',
    label: 'Fourth of July',
    defaultTitle: '4th of July Cookout',
    defaultHour: 17,
    defaultMinute: 0,
    coverLayout: 'banner',
    rsvpNotePrompt: 'Bringing something for the grill or cooler? Let us know.',
    priority: 86,
    keywords: [
      /\b4th of july\b/i,
      /\bfourth of july\b/i,
      /\bjuly 4(?:th)?\b/i,
      /\bindependence\b/i,
      /\bfireworks\b/i,
    ],
    buildDescription: ({ extraNote }) =>
      [
        `<p>Come hang out for food off the grill, cold drinks, and fireworks after dark.</p>`,
        extraNote ? `<p>${escapeHtml(extraNote)}</p>` : '',
      ]
        .filter(Boolean)
        .join(''),
  },
  {
    id: 'new-years-eve',
    themeId: 'new-years-eve',
    label: "New Year's Eve",
    defaultTitle: "New Year's Eve",
    defaultHour: 21,
    defaultMinute: 0,
    coverLayout: 'banner',
    rsvpNotePrompt: 'Let us know what snack or drink you are bringing.',
    priority: 85,
    keywords: [
      /\bnew year(?:'s)?(?:\s+eve)?\b/i,
      /\bnye\b/i,
      /\bcountdown\b/i,
      /\bmidnight toast\b/i,
      /\bchampagne\b/i,
      /\bdec(?:ember)?\s*31\b/i,
    ],
    buildDescription: ({ extraNote }) =>
      [
        `<p>Come ring in the new year with drinks, music, and a midnight toast.</p>`,
        extraNote ? `<p>${escapeHtml(extraNote)}</p>` : '',
      ]
        .filter(Boolean)
        .join(''),
  },
  {
    id: 'valentines-rose',
    themeId: 'valentines-rose',
    label: "Valentine's",
    defaultTitle: "Valentine's Gathering",
    defaultHour: 19,
    defaultMinute: 0,
    coverLayout: 'banner',
    rsvpNotePrompt: 'Leave a quick note or food allergy for the host.',
    priority: 84,
    keywords: [
      /\bvalentine\b/i,
      /\bvalentines\b/i,
      /\bgalentine\b/i,
      /\bgalentines\b/i,
      /\bsweetheart\b/i,
      /\bfeb(?:ruary)?\s*14\b/i,
    ],
    buildDescription: ({ extraNote }) =>
      [
        `<p>Join us for sweets, drinks, and a cozy night together.</p>`,
        extraNote ? `<p>${escapeHtml(extraNote)}</p>` : '',
      ]
        .filter(Boolean)
        .join(''),
  },
  {
    id: 'st-patricks-emerald',
    themeId: 'st-patricks-emerald',
    label: "St. Patrick's Day",
    defaultTitle: "St. Patrick's Day Gathering",
    defaultHour: 18,
    defaultMinute: 0,
    coverLayout: 'banner',
    rsvpNotePrompt: 'Bringing snacks or drinks? Leave a quick note.',
    priority: 83,
    keywords: [
      /\bst\.?\s*patrick(?:'s)?\b/i,
      /\bsaint patrick\b/i,
      /\bshamrock\b/i,
      /\birish\b/i,
      /\bclover\b/i,
    ],
    buildDescription: ({ extraNote }) =>
      [
        `<p>Wear a bit of green and join us for good food and drinks.</p>`,
        extraNote ? `<p>${escapeHtml(extraNote)}</p>` : '',
      ]
        .filter(Boolean)
        .join(''),
  },
  {
    id: 'baby-shower-cloud',
    themeId: 'baby-shower-cloud',
    label: 'Baby Shower',
    defaultTitle: 'Baby Shower',
    defaultHour: 14,
    defaultMinute: 0,
    coverLayout: 'banner',
    rsvpNotePrompt: 'Leave a sweet note or let us know if you have dietary needs.',
    priority: 82,
    keywords: [
      /\bbaby shower\b/i,
      /\bgender reveal\b/i,
      /\bbaby sprinkle\b/i,
      /\bnewborn\b/i,
      /\bstork\b/i,
      /\blittle one\b/i,
    ],
    buildDescription: ({ extraNote }) =>
      [
        `<p>Let's get together to celebrate the parents-to-be before their little one arrives.</p>`,
        extraNote ? `<p>${escapeHtml(extraNote)}</p>` : '',
      ]
        .filter(Boolean)
        .join(''),
  },
  {
    id: 'bridal-atelier',
    themeId: 'bridal-atelier',
    label: 'Bridal & Wedding',
    defaultTitle: 'Bridal Shower',
    defaultHour: 11,
    defaultMinute: 30,
    coverLayout: 'banner',
    rsvpNotePrompt: 'Share any food allergies or a quick note for the host.',
    priority: 81,
    keywords: [
      /\bbridal\b/i,
      /\bbachelorette\b/i,
      /\bbachelor\b/i,
      /\bwedding\b/i,
      /\bengagement\b/i,
      /\bengaged\b/i,
      /\brehearsal dinner\b/i,
    ],
    buildDescription: ({ extraNote }) =>
      [
        `<p>Join us for food, drinks, and a warm celebration together.</p>`,
        extraNote ? `<p>${escapeHtml(extraNote)}</p>` : '',
      ]
        .filter(Boolean)
        .join(''),
  },
  {
    id: 'spring-easter-garden',
    themeId: 'spring-easter-garden',
    label: 'Spring & Easter',
    defaultTitle: 'Spring Gathering',
    defaultHour: 12,
    defaultMinute: 0,
    coverLayout: 'banner',
    rsvpNotePrompt: 'Bringing a brunch dish or treat? Let the host know.',
    priority: 80,
    keywords: [
      /\beaster\b/i,
      /\bspring\b/i,
      /\begg hunt\b/i,
      /\bgarden party\b/i,
      /\btea party\b/i,
      /\bblossom\b/i,
    ],
    buildDescription: ({ extraNote }) =>
      [
        `<p>Join us for an easygoing afternoon with fresh bites and good company.</p>`,
        extraNote ? `<p>${escapeHtml(extraNote)}</p>` : '',
      ]
        .filter(Boolean)
        .join(''),
  },
  {
    id: 'summer-cookout',
    themeId: 'summer-cookout',
    label: 'Cookout',
    defaultTitle: 'Backyard Cookout',
    defaultHour: 16,
    defaultMinute: 0,
    coverLayout: 'banner',
    rsvpNotePrompt: 'Let us know what dish, salad, or drink you are bringing.',
    priority: 75,
    keywords: [
      /\bmemorial day\b/i,
      /\blabor day\b/i,
      /\bbbq\b/i,
      /\bbarbecue\b/i,
      /\bcookout\b/i,
      /\bpool party\b/i,
      /\bpicnic\b/i,
      /\bsummer\b/i,
      /\bbeach\b/i,
    ],
    buildDescription: ({ extraNote }) =>
      [
        `<p>Firing up the grill for a relaxed afternoon outside with cold drinks and good food.</p>`,
        extraNote ? `<p>${escapeHtml(extraNote)}</p>` : '',
      ]
        .filter(Boolean)
        .join(''),
  },
  {
    id: 'birthday-confetti',
    themeId: 'birthday-confetti',
    label: 'Birthday',
    defaultTitle: 'Birthday Party',
    defaultHour: 19,
    defaultMinute: 0,
    coverLayout: 'banner',
    rsvpNotePrompt: 'Leave a note or let us know if you are bringing anything.',
    priority: 70,
    keywords: [
      /\bbirthday\b/i,
      /\bbday\b/i,
      /\b(?:21st|25th|30th|40th|50th|60th|sweet 16)\b/i,
    ],
    buildDescription: ({ extraNote }) =>
      [
        `<p>Come celebrate with food, drinks, and birthday cake.</p>`,
        extraNote ? `<p>${escapeHtml(extraNote)}</p>` : '',
      ]
        .filter(Boolean)
        .join(''),
  },
  {
    id: 'winter-snowfall',
    themeId: 'winter-snowfall',
    label: 'Winter',
    defaultTitle: 'Winter Gathering',
    defaultHour: 18,
    defaultMinute: 0,
    coverLayout: 'banner',
    rsvpNotePrompt: 'Bringing a warm drink, snack, or dessert? Share below.',
    priority: 65,
    keywords: [
      /\bsnow\b/i,
      /\bwinter\b/i,
      /\bhanukkah\b/i,
      /\bchanukah\b/i,
      /\bmenorah\b/i,
      /\blatke\b/i,
      /\bski\b/i,
      /\bchalet\b/i,
      /\bfireside\b/i,
      /\bsolstice\b/i,
    ],
    buildDescription: ({ extraNote }) =>
      [
        `<p>Come in from the cold for good food, warm drinks, and a cozy night together.</p>`,
        extraNote ? `<p>${escapeHtml(extraNote)}</p>` : '',
      ]
        .filter(Boolean)
        .join(''),
  },
  {
    id: 'candlelit-dinner',
    themeId: 'candlelit-dinner',
    label: 'Dinner',
    defaultTitle: 'Dinner Gathering',
    defaultHour: 19,
    defaultMinute: 0,
    coverLayout: 'banner',
    rsvpNotePrompt: 'Let us know what dish or drink you are bringing, or any allergies.',
    priority: 60,
    keywords: [
      /\bdinner\b/i,
      /\bpotluck\b/i,
      /\bbrunch\b/i,
      /\bsupper\b/i,
      /\btasting\b/i,
      /\bwine\b/i,
      /\bfondue\b/i,
      /\bgame night\b/i,
    ],
    buildDescription: ({ extraNote }) =>
      [
        `<p>Pull up a chair for good food and an easy evening together.</p>`,
        extraNote ? `<p>${escapeHtml(extraNote)}</p>` : '',
      ]
        .filter(Boolean)
        .join(''),
  },
  {
    id: 'electric-quantum',
    themeId: 'electric-quantum',
    label: 'Night Out',
    defaultTitle: 'Friday Night Hang',
    defaultHour: 21,
    defaultMinute: 0,
    coverLayout: 'banner',
    rsvpNotePrompt: 'Let us know if you are bringing anyone or have a music request.',
    priority: 55,
    keywords: [
      /\bdj\b/i,
      /\bafterparty\b/i,
      /\bsynth\b/i,
      /\blistening party\b/i,
      /\blaunch party\b/i,
      /\brave\b/i,
      /\bneon\b/i,
    ],
    buildDescription: ({ extraNote }) =>
      [
        `<p>Come through whenever you can for good music and a relaxed late night.</p>`,
        extraNote ? `<p>${escapeHtml(extraNote)}</p>` : '',
      ]
        .filter(Boolean)
        .join(''),
  },
  {
    id: 'minimal-paper',
    themeId: 'minimal-paper',
    label: 'Gathering',
    defaultTitle: 'Get-Together',
    defaultHour: 18,
    defaultMinute: 30,
    coverLayout: 'banner',
    rsvpNotePrompt: 'Add a quick note for the host.',
    priority: 50,
    keywords: [
      /\bgallery\b/i,
      /\bexhibition\b/i,
      /\bworkshop\b/i,
      /\bbook club\b/i,
      /\bsalon\b/i,
      /\bmeetup\b/i,
    ],
    buildDescription: ({ extraNote }) =>
      [
        `<p>Getting everyone together for good conversation and light refreshments.</p>`,
        extraNote ? `<p>${escapeHtml(extraNote)}</p>` : '',
      ]
        .filter(Boolean)
        .join(''),
  },
];

const WRITTEN_ORDINALS: Record<string, number> = {
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  sixth: 6,
  seventh: 7,
  eighth: 8,
  ninth: 9,
  tenth: 10,
  eleventh: 11,
  twelfth: 12,
  thirteenth: 13,
  fourteenth: 14,
  fifteenth: 15,
  sixteenth: 16,
  seventeenth: 17,
  eighteenth: 18,
  nineteenth: 19,
  twentieth: 20,
  'twenty-first': 21,
  'twenty first': 21,
  'twenty-second': 22,
  'twenty second': 22,
  'twenty-third': 23,
  'twenty third': 23,
  'twenty-fourth': 24,
  'twenty fourth': 24,
  'twenty-fifth': 25,
  'twenty fifth': 25,
  'twenty-sixth': 26,
  'twenty sixth': 26,
  'twenty-seventh': 27,
  'twenty seventh': 27,
  'twenty-eighth': 28,
  'twenty eighth': 28,
  'twenty-ninth': 29,
  'twenty ninth': 29,
  thirtieth: 30,
  'thirty-first': 31,
  'thirty first': 31,
};

const ORDINAL_PATTERN = new RegExp(
  `\\b(?:on\\s+)?the\\s+(${Object.keys(WRITTEN_ORDINALS)
    .sort((a, b) => b.length - a.length)
    .join('|')}|\\d{1,2}(?:st|nd|rd|th))\\b(?!\\s+of\\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)|\\s+(?:st|street|ave|avenue|rd|road|blvd|ln|lane|dr|drive|floor|fl|anniversary|birthday|bday)\\b)`,
  'i',
);

const PRESERVE_HOLIDAY_PHRASES: RegExp[] = [
  /\b4th of july\b/i,
  /\bfourth of july\b/i,
  /\bnew year(?:'s)?(?:\s+eve|\s+day)?\b/i,
  /\bchristmas(?:\s+eve|\s+day)?\b/i,
  /\bhalloween\b/i,
  /\bthanksgiving\b/i,
  /\bfriendsgiving\b/i,
  /\bvalentine(?:'s)?(?:\s+day)?\b/i,
  /\bst\.?\s*patrick(?:'s)?(?:\s+day)?\b/i,
  /\bmemorial day\b/i,
  /\blabor day\b/i,
  /\beaster\b/i,
];

const SMALL_TITLE_WORDS = new Set([
  'a',
  'an',
  'and',
  'at',
  'by',
  'for',
  'from',
  'in',
  'of',
  'on',
  'or',
  'the',
  'to',
  'vs',
  'with',
]);

const UPPERCASE_WORDS = new Set(['bbq', 'nye', 'dj', 'vip', 'rsvp', 'diy', 'usa']);

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function resolveTimeZone(requested?: string): string {
  if (requested && requested.trim()) {
    try {
      Intl.DateTimeFormat('en-US', { timeZone: requested.trim() });
      return requested.trim();
    } catch {
      // fall through
    }
  }
  try {
    const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (resolved) {
      Intl.DateTimeFormat('en-US', { timeZone: resolved });
      return resolved;
    }
  } catch {
    // fall through
  }
  return 'America/New_York';
}

interface WallParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function getWallParts(date: Date, timeZone: string): WallParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) => {
    const found = parts.find((p) => p.type === type);
    return found ? Number(found.value) : 0;
  };
  const rawHour = pick('hour');
  return {
    year: pick('year'),
    month: pick('month'),
    day: pick('day'),
    hour: rawHour === 24 ? 0 : rawHour,
    minute: pick('minute'),
    second: pick('second'),
  };
}

function getChronoOffsetMinutes(date: Date, timeZone: string): number {
  const w = getWallParts(date, timeZone);
  const wallUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  const actualSecUtc = Math.floor(date.getTime() / 1000) * 1000;
  return Math.round((wallUtc - actualSecUtc) / 60000);
}

function zonedWallTimeToIso(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): string {
  // Normalize overflow (e.g., day + 1 past month end) in calendar space first.
  const normDate = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));
  const ny = normDate.getUTCFullYear();
  const nm = normDate.getUTCMonth() + 1;
  const nd = normDate.getUTCDate();
  const nh = normDate.getUTCHours();
  const nmin = normDate.getUTCMinutes();

  const targetWallUtc = Date.UTC(ny, nm - 1, nd, nh, nmin, 0, 0);
  let guess = targetWallUtc;

  for (let pass = 0; pass < 2; pass++) {
    const w = getWallParts(new Date(guess), timeZone);
    const actualWallUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, 0, 0);
    guess += targetWallUtc - actualWallUtc;
  }

  return new Date(guess).toISOString();
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function resolveForwardDayOfMonth(
  refParts: WallParts,
  targetDay: number,
): { year: number; month: number; day: number } {
  let year = refParts.year;
  let month = refParts.month;

  if (targetDay < refParts.day) {
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  // Advance until the month actually has targetDay (e.g., 31st).
  for (let guard = 0; guard < 12; guard++) {
    if (targetDay <= daysInMonth(year, month)) {
      return { year, month, day: targetDay };
    }
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  return { year, month, day: Math.min(targetDay, daysInMonth(year, month)) };
}

function resolveForwardFixedDate(
  refParts: WallParts,
  month: number,
  day: number,
): { year: number; month: number; day: number } {
  let year = refParts.year;
  if (month < refParts.month || (month === refParts.month && day < refParts.day)) {
    year += 1;
  }
  return { year, month, day };
}

function matchOccasion(prompt: string): OccasionRule | null {
  let best: OccasionRule | null = null;
  let bestScore = -1;

  for (const rule of OCCASION_RULES) {
    let matches = 0;
    for (const re of rule.keywords) {
      if (re.test(prompt)) {
        matches += 1;
      }
    }
    if (matches > 0) {
      const score = rule.priority + matches * 5;
      if (score > bestScore) {
        bestScore = score;
        best = rule;
      }
    }
  }
  return best;
}

function maskRange(str: string, start: number, end: number): string {
  const safeStart = Math.max(0, start);
  const safeEnd = Math.min(str.length, end);
  if (safeEnd <= safeStart) {
    return str;
  }
  return str.slice(0, safeStart) + ' '.repeat(safeEnd - safeStart) + str.slice(safeEnd);
}

function extractVirtualUrl(prompt: string): {
  virtualUrl?: string;
  span?: [number, number];
} {
  const match = /https?:\/\/[^\s)>]+/i.exec(prompt);
  if (!match) {
    return {};
  }
  const raw = match[0].replace(/[.,;!?]+$/, '');
  return {
    virtualUrl: raw,
    span: [match.index, match.index + raw.length],
  };
}

function extractHostName(prompt: string): {
  hostName?: string;
  span?: [number, number];
} {
  const patterns = [
    /\b(?:hosted|organized|thrown|invited|put on)\s+by\s+([A-Za-z][A-Za-z'’.-]*(?:\s+[A-Za-z][A-Za-z'’.-]*){0,2}?)(?=\s+(?:at|on|in|from|for|with|https?:)\b|[,.!?\n;—–]|$)/i,
    /\bmy\s+name\s+is\s+([A-Za-z][A-Za-z'’.-]*(?:\s+[A-Za-z][A-Za-z'’.-]*){0,1}?)(?=\s+(?:and|at|on|in|from|for|with)\b|[,.!?\n;—–]|$)/i,
  ];

  for (const re of patterns) {
    const m = re.exec(prompt);
    if (m && m[1]) {
      const cleaned = m[1].trim();
      if (cleaned.length >= 2) {
        return {
          hostName: cleaned,
          span: [m.index, m.index + m[0].length],
        };
      }
    }
  }
  return {};
}

const STREET_ADDRESS_RE =
  /^\d+\s+[A-Za-z0-9.'’\-\s]+\b(?:st|street|ave|avenue|rd|road|blvd|boulevard|ln|lane|dr|drive|ct|court|way|pl|place|pkwy|parkway|cir|circle|ter|terrace|trl|trail)\b/i;

const NON_LOCATION_IN_RE =
  /^(?:honor|celebration|memory|costumes?|pajamas|person|advance|total|mind|touch|town|love)\b/i;

const NON_LOCATION_AT_RE =
  /^(?:night|dusk|dawn|sunset|sunrise|noon|midnight|home\s+for|christmas|easter|thanksgiving|halloween|all|\d{1,2}(?::\d{2})?\s*(?:am|pm|o'?clock)?)$/i;

function splitVenueAndAddress(rawPlace: string): {
  locationName: string;
  locationAddress?: string;
} {
  const trimmed = rawPlace.replace(/^[,.\s]+|[,.\s]+$/g, '');
  if (!trimmed) {
    return { locationName: '' };
  }

  // Case 1: "Joe's Pizza (42 Maple St)"
  const parenMatch = /^(.+?)\s*\(([^)]+)\)\s*$/.exec(trimmed);
  if (parenMatch && STREET_ADDRESS_RE.test(parenMatch[2].trim())) {
    return {
      locationName: parenMatch[1].trim(),
      locationAddress: parenMatch[2].trim(),
    };
  }

  // Case 2: "42 Maple St" or "42 Maple St, Austin TX"
  if (STREET_ADDRESS_RE.test(trimmed)) {
    return {
      locationName: trimmed,
      locationAddress: trimmed,
    };
  }

  // Case 3: "Riverside Park, 500 River Rd"
  const commaIdx = trimmed.indexOf(',');
  if (commaIdx > 0) {
    const first = trimmed.slice(0, commaIdx).trim();
    const rest = trimmed.slice(commaIdx + 1).trim();
    if (STREET_ADDRESS_RE.test(rest)) {
      return {
        locationName: first,
        locationAddress: rest,
      };
    }
  }

  return { locationName: trimmed };
}

const ABBREVIATION_DOT_SENTINEL = '\uE000';

const WORD_ABBREVIATION_DOT_RE =
  /\b(St|Mt|Ft|Dr|Ave|Blvd|Rd|Ln|Ct|Pl|Pkwy|Ste|Apt|Mr|Mrs|Ms|Rev|Fr|Sr|Jr)\./gi;

const INITIALISM_DOT_RE = /\b(a\.m\.|p\.m\.|u\.s\.)/gi;

const COMPASS_ABBREVIATION_DOT_RE = /\b([NSEW])\.(?=\s+[A-Za-z0-9])/g;

function protectAbbreviationDots(text: string): string {
  return text
    .replace(INITIALISM_DOT_RE, (m) => m.replace(/\./g, ABBREVIATION_DOT_SENTINEL))
    .replace(WORD_ABBREVIATION_DOT_RE, `$1${ABBREVIATION_DOT_SENTINEL}`)
    .replace(COMPASS_ABBREVIATION_DOT_RE, `$1${ABBREVIATION_DOT_SENTINEL}`);
}

function restoreAbbreviationDots(text: string): string {
  return text.replaceAll(ABBREVIATION_DOT_SENTINEL, '.');
}

function extractLocation(
  maskedPrompt: string,
): {
  locationName?: string;
  locationAddress?: string;
  span?: [number, number];
} {
  const safePrompt = protectAbbreviationDots(maskedPrompt);

  const atPattern =
    /(?:^|\s)(?:at|@)\s+([^.!?\n;—–]+?)(?=\s+(?:hosted|organized|thrown|bringing|bring|for\s+my|to\s+celebrate|https?:)\b|[.!?\n;—–]|$)/gi;

  let match: RegExpExecArray | null;
  while ((match = atPattern.exec(safePrompt)) !== null) {
    const candidate = restoreAbbreviationDots(match[1]).trim();
    if (!candidate || NON_LOCATION_AT_RE.test(candidate)) {
      continue;
    }
    const { locationName, locationAddress } = splitVenueAndAddress(candidate);
    if (locationName) {
      const leadingSpace = match[0].startsWith(' ') ? 1 : 0;
      return {
        locationName,
        locationAddress,
        span: [match.index + leadingSpace, match.index + match[0].length],
      };
    }
  }

  const inPattern =
    /(?:^|\s)in\s+([^,.!?\n;—–]+?)(?=\s+(?:hosted|organized|thrown|bringing|bring|https?:)\b|[,.!?\n;—–]|$)/gi;
  while ((match = inPattern.exec(safePrompt)) !== null) {
    const candidate = restoreAbbreviationDots(match[1]).trim();
    if (!candidate || NON_LOCATION_IN_RE.test(candidate)) {
      continue;
    }
    const { locationName, locationAddress } = splitVenueAndAddress(candidate);
    if (locationName) {
      const leadingSpace = match[0].startsWith(' ') ? 1 : 0;
      return {
        locationName,
        locationAddress,
        span: [match.index + leadingSpace, match.index + match[0].length],
      };
    }
  }

  return {};
}

function smartTitleCase(raw: string): string {
  const words = raw
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .filter(Boolean);

  return words
    .map((word, idx) => {
      const lower = word.toLowerCase();
      if (UPPERCASE_WORDS.has(lower)) {
        return lower.toUpperCase();
      }
      if (/^\d+(?:st|nd|rd|th)$/i.test(lower)) {
        return lower;
      }
      const isEdge = idx === 0 || idx === words.length - 1;
      if (!isEdge && SMALL_TITLE_WORDS.has(lower)) {
        return lower;
      }
      // Preserve internal punctuation like Emma's, St., New Year's
      return word.replace(/^[a-z]/i, (ch) => ch.toUpperCase());
    })
    .join(' ');
}

function extractTitleAndExtraNote(
  prompt: string,
  spansToStrip: Array<[number, number]>,
  fallbackTitle: string,
): { title: string; extraNote?: string } {
  const trimmed = prompt.trim();
  if (!trimmed) {
    return { title: fallbackTitle };
  }

  // Split trailing sentence / em-dash note so extra details feed the starter description.
  // Protect abbreviation periods (e.g., St., Dr., a.m.) from triggering a sentence break.
  let extraNote: string | undefined;
  let primaryEnd = trimmed.length;
  const protectedTrimmed = protectAbbreviationDots(trimmed);
  const sentenceBreak = /(?<=[.!?])\s+|\s+[—–]\s+/.exec(protectedTrimmed);
  if (sentenceBreak && sentenceBreak.index > 4) {
    primaryEnd = sentenceBreak.index;
    const remainder = trimmed.slice(sentenceBreak.index + sentenceBreak[0].length).trim();
    if (remainder.length > 2) {
      extraNote = remainder;
    }
  }

  let working = trimmed;
  // Remove spans outside holiday phrases.
  for (const [start, end] of spansToStrip) {
    const slice = working.slice(start, end);
    const keepHoliday = PRESERVE_HOLIDAY_PHRASES.some((re) => re.test(slice));
    if (!keepHoliday) {
      working = maskRange(working, start, end);
    }
  }

  working = working.slice(0, primaryEnd);

  // Strip conversational openings cleanly.
  const leadPatterns = [
    /^\s*(?:hey|hi|hello|yo|hiya|heya)(?:\s+(?:everyone|all|guys|y'all|friends|folks|there))?[,!\s]+/i,
    /^\s*(?:i'm|im|i am|we're|were|we are|we|i)\s+(?:planning|doing|having|hosting|throwing|organizing|putting on)\s+(?:a|an|the|our|my)?\s*/i,
    /^\s*(?:looking to|want to|gonna|going to)\s+(?:host|throw|have|do|celebrate)\s+(?:a|an|the|our|my)?\s*/i,
    /^\s*(?:come\s+)?(?:join us for|join our|come to|you're invited to|you are invited to|invited to|hosting|throwing|having|doing)\s+(?:a|an|the|our|my)?\s*/i,
    /^\s*(?:a|an|the)\s+/i,
  ];

  let changed = true;
  while (changed) {
    changed = false;
    for (const re of leadPatterns) {
      const next = working.replace(re, '');
      if (next !== working) {
        working = next;
        changed = true;
      }
    }
  }

  // Strip dangling prepositions/punctuation at edges.
  working = working
    .replace(/\s+/g, ' ')
    .replace(/^[,\s\-–—:;.!]+/, '')
    .replace(/(?:\s+(?:on|at|in|from|to|by|and|or))?\s*[,\-–—:;.!]*$/i, '')
    .trim();

  if (working.length < 2) {
    return { title: fallbackTitle, extraNote };
  }

  return {
    title: smartTitleCase(working),
    extraNote,
  };
}

function formatWhenChip(startIso: string, endIso: string | undefined, timeZone: string): string {
  const start = new Date(startIso);
  const datePart = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(start);
  const startTime = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
  }).format(start);

  if (!endIso) {
    return `${datePart} · ${startTime}`;
  }
  const end = new Date(endIso);
  const endTime = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
  }).format(end);
  return `${datePart} · ${startTime}–${endTime}`;
}

export function parseEventPrompt(
  prompt: string,
  referenceDate?: Date,
  timeZone?: string,
): ParsedEventDraft {
  const cleanedPrompt = prompt.replace(/\s+/g, ' ').trim();
  const safeTimeZone = resolveTimeZone(timeZone);
  const refDate = referenceDate ? new Date(referenceDate) : new Date();
  const refWall = getWallParts(refDate, safeTimeZone);
  const refOffsetMinutes = getChronoOffsetMinutes(refDate, safeTimeZone);

  const occasionRule = matchOccasion(cleanedPrompt);
  const pelicanCue = /\b(?:pelican|penguin|breakfast exchange)\b/i.test(cleanedPrompt);
  const discoCue = /\b(?:y2k|disco|mirrorball|karaoke|dance party|afterparty)\b/i.test(cleanedPrompt);

  let resolvedThemeId = occasionRule?.themeId ?? 'aurora-midnight';
  if (pelicanCue) {
    resolvedThemeId = 'winter-snowfall';
  } else if (discoCue && !occasionRule) {
    resolvedThemeId = /\by2k\b/i.test(cleanedPrompt) ? 'y2k-chrome' : 'sunset-disco';
  }
  const themePreset = getThemePreset(resolvedThemeId);

  // 1. Extract virtual URL and host name first.
  const urlResult = extractVirtualUrl(cleanedPrompt);
  const hostResult = extractHostName(cleanedPrompt);

  // 2. Run chrono-node for natural date/time extraction.
  const chronoResults = cleanedPrompt
    ? chrono.parse(
        cleanedPrompt,
        { instant: refDate, timezone: refOffsetMinutes },
        { forwardDate: true },
      )
    : [];

  const isCertainDateResult = (r: chrono.ParsedResult) =>
    r.start.isCertain('day') ||
    r.start.isCertain('month') ||
    r.start.isCertain('weekday') ||
    r.start.isCertain('year');

  // chrono-node greedily merges leading "night/morning/evening/afternoon" into the following
  // date expression (e.g. "night Friday at 7pm"), dropping the weekday/date certainty.
  const resolvedChronoResults = chronoResults.flatMap((r) => {
    const trimmed = r.text.replace(/^(?:night|morning|evening|afternoon)\s+/i, '');
    if (trimmed !== r.text && trimmed.length > 0 && !isCertainDateResult(r)) {
      const recovered = chrono.parse(
        trimmed,
        { instant: refDate, timezone: refOffsetMinutes },
        { forwardDate: true },
      );
      if (recovered.length > 0) return [...recovered, r];
    }
    return [r];
  });

  // 3. Detect standalone written/numeric ordinals ("on the ninth", "on the 9th") that chrono skips.
  const ordinalMatch = ORDINAL_PATTERN.exec(cleanedPrompt);
  let ordinalDay: number | undefined;
  let ordinalSpan: [number, number] | undefined;
  if (ordinalMatch && ordinalMatch[1]) {
    const token = ordinalMatch[1].toLowerCase().trim();
    if (token in WRITTEN_ORDINALS) {
      ordinalDay = WRITTEN_ORDINALS[token];
    } else {
      const numeric = parseInt(token, 10);
      if (numeric >= 1 && numeric <= 31) {
        ordinalDay = numeric;
      }
    }
    if (ordinalDay !== undefined) {
      ordinalSpan = [ordinalMatch.index, ordinalMatch.index + ordinalMatch[0].length];
    }
  }

  // Merge date/time resolution across chrono + ordinal fallback + holiday fallback.
  const dateChrono = resolvedChronoResults.find(isCertainDateResult);
  const timeChrono = resolvedChronoResults.find((r) => r.start.isCertain('hour'));

  let year = refWall.year;
  let month = refWall.month;
  let day = refWall.day;
  let hasExplicitDate = false;

  if (dateChrono) {
    year = dateChrono.start.get('year') ?? refWall.year;
    month = dateChrono.start.get('month') ?? refWall.month;
    day = dateChrono.start.get('day') ?? refWall.day;
    hasExplicitDate = true;
  }

  if (!hasExplicitDate && ordinalDay !== undefined) {
    const resolved = resolveForwardDayOfMonth(refWall, ordinalDay);
    year = resolved.year;
    month = resolved.month;
    day = resolved.day;
    hasExplicitDate = true;
  }

  if (!hasExplicitDate) {
    // Fixed-date holiday fallbacks when no date was explicitly provided.
    if (/\bchristmas eve\b/i.test(cleanedPrompt)) {
      ({ year, month, day } = resolveForwardFixedDate(refWall, 12, 24));
      hasExplicitDate = true;
    } else if (/\bchristmas day\b/i.test(cleanedPrompt)) {
      ({ year, month, day } = resolveForwardFixedDate(refWall, 12, 25));
      hasExplicitDate = true;
    } else if (/\b(?:new year(?:'s)? eve|nye)\b/i.test(cleanedPrompt)) {
      ({ year, month, day } = resolveForwardFixedDate(refWall, 12, 31));
      hasExplicitDate = true;
    } else if (/\bhalloween\b/i.test(cleanedPrompt)) {
      ({ year, month, day } = resolveForwardFixedDate(refWall, 10, 31));
      hasExplicitDate = true;
    } else if (/\bvalentine(?:'s)?(?:\s+day)?\b/i.test(cleanedPrompt)) {
      ({ year, month, day } = resolveForwardFixedDate(refWall, 2, 14));
      hasExplicitDate = true;
    } else if (/\bst\.?\s*patrick(?:'s)?(?:\s+day)?\b/i.test(cleanedPrompt)) {
      ({ year, month, day } = resolveForwardFixedDate(refWall, 3, 17));
      hasExplicitDate = true;
    }
  }

  if (!hasExplicitDate) {
    // Default cleanly to upcoming Saturday.
    const refUtcDate = new Date(Date.UTC(refWall.year, refWall.month - 1, refWall.day));
    const dow = refUtcDate.getUTCDay();
    const daysUntilSaturday = dow === 6 ? 7 : 6 - dow;
    const nextSat = new Date(
      Date.UTC(refWall.year, refWall.month - 1, refWall.day + daysUntilSaturday),
    );
    year = nextSat.getUTCFullYear();
    month = nextSat.getUTCMonth() + 1;
    day = nextSat.getUTCDate();
  }

  // Time & AM/PM smart disambiguation.
  const morningCue = /\b(?:morning|sunrise|breakfast|brunch|coffee|a\.?m\.?)\b/i.test(cleanedPrompt);
  let hour = occasionRule?.defaultHour ?? (morningCue ? 11 : 18);
  let minute = occasionRule?.defaultMinute ?? 0;

  if (/\bsunrise\b/i.test(cleanedPrompt)) {
    hour = 7;
    minute = 0;
  } else if (/\bbrunch\b/i.test(cleanedPrompt) && !timeChrono) {
    hour = 11;
    minute = 0;
  }

  if (timeChrono) {
    const rawHour = timeChrono.start.get('hour') ?? hour;
    const rawMin = timeChrono.start.get('minute') ?? 0;
    hour = rawHour;
    minute = rawMin;

    if (!timeChrono.start.isCertain('meridiem')) {
      const endHourRaw = timeChrono.end?.get('hour') ?? null;
      const isBrunchSpan =
        hour >= 9 && hour <= 11 && endHourRaw !== null && endHourRaw >= 1 && endHourRaw <= 5;
      if (!morningCue && !isBrunchSpan) {
        if (hour >= 1 && hour <= 6) {
          hour += 12;
        } else if (hour >= 7 && hour <= 11 && !/\bmorning\b/i.test(cleanedPrompt)) {
          hour += 12;
        }
      }
    }
  }

  const hasExplicitTime = Boolean(
    timeChrono || /\b(?:noon|midnight|sunrise)\b/i.test(cleanedPrompt),
  );

  const startIso = zonedWallTimeToIso(year, month, day, hour, minute, safeTimeZone);

  let endIso: string | undefined;
  if (timeChrono?.end && timeChrono.end.isCertain('hour')) {
    const endYear = timeChrono.end.isCertain('year')
      ? (timeChrono.end.get('year') ?? year)
      : year;
    const endMonth = timeChrono.end.isCertain('month')
      ? (timeChrono.end.get('month') ?? month)
      : month;
    let endDay = timeChrono.end.isCertain('day')
      ? (timeChrono.end.get('day') ?? day)
      : day;
    let endHour = timeChrono.end.get('hour') ?? hour;
    const endMinute = timeChrono.end.get('minute') ?? 0;

    if (!timeChrono.end.isCertain('meridiem')) {
      if (endHour < hour && endHour + 12 > hour && endHour <= 11) {
        endHour += 12;
      } else if (hour >= 12 && endHour >= 1 && endHour <= 11 && endHour + 12 > hour) {
        endHour += 12;
      }
    }

    let candidateEndIso = zonedWallTimeToIso(
      endYear,
      endMonth,
      endDay,
      endHour,
      endMinute,
      safeTimeZone,
    );
    if (Date.parse(candidateEndIso) <= Date.parse(startIso)) {
      endDay += 1;
      candidateEndIso = zonedWallTimeToIso(
        endYear,
        endMonth,
        endDay,
        endHour,
        endMinute,
        safeTimeZone,
      );
    }
    endIso = candidateEndIso;
  }

  // 4. Mask out URL, host, and chrono/ordinal spans before extracting location.
  let maskedForLocation = cleanedPrompt;
  const spansToStrip: Array<[number, number]> = [];

  if (urlResult.span) {
    spansToStrip.push(urlResult.span);
    maskedForLocation = maskRange(maskedForLocation, urlResult.span[0], urlResult.span[1]);
  }
  if (hostResult.span) {
    spansToStrip.push(hostResult.span);
    maskedForLocation = maskRange(maskedForLocation, hostResult.span[0], hostResult.span[1]);
  }
  for (const r of chronoResults) {
    let spanStart = r.index;
    const spanEnd = r.index + r.text.length;
    const leadingPartMatch = /^(?:night|morning|evening|afternoon)\s+/i.exec(r.text);
    if (leadingPartMatch) {
      const before = cleanedPrompt.slice(0, spanStart);
      if (
        /\b(?:game|wine|movie|trivia|date|karaoke|taco|pizza|comedy|girls|boys|guys|ladies|family|film|poker|jazz|paint|craft|board\s+game|easter|christmas|sunday)\s+$/i.test(
          before,
        )
      ) {
        spanStart += leadingPartMatch[0].length;
      }
    }
    const span: [number, number] = [spanStart, spanEnd];
    spansToStrip.push(span);
    // Keep holiday phrases visible for context, only mask non-holiday time/date tokens for location parsing.
    const isHolidayText = PRESERVE_HOLIDAY_PHRASES.some((re) => re.test(r.text));
    if (!isHolidayText) {
      maskedForLocation = maskRange(maskedForLocation, span[0], span[1]);
    }
  }
  if (ordinalSpan) {
    spansToStrip.push(ordinalSpan);
    maskedForLocation = maskRange(maskedForLocation, ordinalSpan[0], ordinalSpan[1]);
  }

  const locationResult = extractLocation(maskedForLocation);
  if (locationResult.span) {
    spansToStrip.push(locationResult.span);
  }

  // 5. Extract clean title and optional host note.
  const fallbackTitle = occasionRule?.defaultTitle ?? 'Evening Gathering';
  const { title, extraNote } = extractTitleAndExtraNote(
    cleanedPrompt,
    spansToStrip,
    fallbackTitle,
  );

  let matchedCoverPresetId = themePreset.defaultCoverPresetId;
  let matchedEffectId = themePreset.defaultEffectId;
  let matchedLabel = occasionRule?.label ?? 'Evening Gathering';

  if (pelicanCue) {
    matchedCoverPresetId = 'handdrawn-pelican-holiday';
    matchedLabel = 'Pelican Breakfast';
  } else if (/\b(?:taco|margarita|fiesta|enchilada|nachos)\b/i.test(cleanedPrompt)) {
    matchedCoverPresetId = /\b(?:patio|backyard|courtyard|outdoor)\b/i.test(cleanedPrompt)
      ? 'handdrawn-taco-patio'
      : 'pattern-taco-fiesta';
    matchedLabel = 'Taco Night';
  } else if (/\b(?:pool|swim|flamingo|splash)\b/i.test(cleanedPrompt)) {
    matchedCoverPresetId = 'handdrawn-pool-party';
    matchedEffectId = 'water-caustics';
    matchedLabel = 'Pool Party';
  } else if (/\b(?:beach|ocean|surf|coast|seaside)\b/i.test(cleanedPrompt)) {
    matchedCoverPresetId = 'pattern-beach-day';
    matchedEffectId = 'water-caustics';
    matchedLabel = 'Beach Hang';
  } else if (/\b(?:campfire|bonfire|s'?mores|firepit)\b/i.test(cleanedPrompt)) {
    matchedCoverPresetId = 'handdrawn-campfire-smores';
    matchedEffectId = 'fireflies';
    matchedLabel = 'Campfire';
  } else if (/\b(?:ramen|sushi|dumpling|izakaya|noodle)\b/i.test(cleanedPrompt)) {
    matchedCoverPresetId = 'pattern-sushi-ramen';
    matchedEffectId = 'paper-lanterns';
    matchedLabel = 'Dinner Night';
  } else if (/\b(?:pancake|waffle|breakfast|brunch)\b/i.test(cleanedPrompt)) {
    matchedCoverPresetId = /\b(?:bridal|wedding)\b/i.test(cleanedPrompt)
      ? themePreset.defaultCoverPresetId
      : 'handdrawn-pancake-brunch';
  } else if (/\b(?:coffee|espresso|latte|matcha|bakery|croissant)\b/i.test(cleanedPrompt)) {
    matchedCoverPresetId = /\bmartini\b/i.test(cleanedPrompt)
      ? 'vector-espresso-martini'
      : 'pattern-coffee-pastries';
  } else if (/\b(?:cheese|charcuterie|tasting|vineyard|pinot|cabernet)\b/i.test(cleanedPrompt)) {
    matchedCoverPresetId = 'pattern-cheese-wine';
  } else if (/\b(?:pizza|game night|board game|trivia|poker)\b/i.test(cleanedPrompt)) {
    matchedCoverPresetId = 'handdrawn-pizza-games';
  } else if (/\b(?:movie|film|cinema|screening|popcorn)\b/i.test(cleanedPrompt)) {
    matchedCoverPresetId = 'handdrawn-movie-popcorn';
    matchedEffectId = 'shooting-stars';
    matchedLabel = 'Movie Night';
  } else if (/\bbook club\b/i.test(cleanedPrompt)) {
    matchedCoverPresetId = 'handdrawn-book-club';
    matchedLabel = 'Book Club';
  } else if (/\b(?:graduation|graduate|commencement)\b/i.test(cleanedPrompt)) {
    matchedCoverPresetId = 'handdrawn-graduation-toss';
    matchedLabel = 'Graduation';
  } else if (/\b(?:housewarming|new home|new apartment|moved in)\b/i.test(cleanedPrompt)) {
    matchedCoverPresetId = 'handdrawn-housewarming-door';
    matchedLabel = 'Housewarming';
  } else if (/\bkaraoke\b/i.test(cleanedPrompt)) {
    matchedCoverPresetId = 'handdrawn-karaoke-lounge';
    matchedEffectId = 'disco-prism';
  } else if (/\b(?:disco|mirrorball)\b/i.test(cleanedPrompt)) {
    matchedCoverPresetId = 'vector-disco-mirrorball';
    matchedEffectId = 'disco-prism';
  } else if (/\b(?:vinyl|record|listening party|dj)\b/i.test(cleanedPrompt)) {
    matchedCoverPresetId = 'vector-vinyl-turntable';
  } else if (/\brooftop\b/i.test(cleanedPrompt)) {
    matchedCoverPresetId = 'handdrawn-rooftop-stringlights';
  } else if (/\b(?:tennis|pickleball)\b/i.test(cleanedPrompt)) {
    matchedCoverPresetId = 'vector-tennis-club';
  } else if (/\b(?:sunset|cloud|golden hour)\b/i.test(cleanedPrompt) && !occasionRule) {
    matchedEffectId = 'twilight-clouds';
  }

  const detectedOccasionLabel = matchedLabel;
  const descriptionHtml = extraNote ? `<p>${escapeHtml(extraNote)}</p>` : '';

  const rsvpNotePrompt =
    occasionRule?.rsvpNotePrompt ?? 'Bringing a dish, drink, or quick note for the host?';

  const style: InviteStyleConfig = {
    themeId: themePreset.id,
    fontId: themePreset.defaultFontId,
    effectId: matchedEffectId,
    coverPresetId: matchedCoverPresetId,
    coverLayout: occasionRule?.coverLayout ?? 'banner',
    colorMode: themePreset.colorMode,
    ...(themePreset.defaultCardStyle ? { cardStyle: themePreset.defaultCardStyle } : {}),
  };

  const confidenceChips: Array<{ icon: string; label: string; value: string }> = [
    { icon: 'title', label: 'Title', value: title },
  ];

  if (hasExplicitDate || hasExplicitTime) {
    confidenceChips.push({
      icon: 'calendar',
      label: 'When',
      value: formatWhenChip(startIso, endIso, safeTimeZone),
    });
  }

  if (locationResult.locationName) {
    confidenceChips.push({
      icon: 'pin',
      label: 'Where',
      value: locationResult.locationName,
    });
  } else if (urlResult.virtualUrl) {
    confidenceChips.push({
      icon: 'link',
      label: 'Link',
      value: 'Online',
    });
  }

  if (hostResult.hostName) {
    confidenceChips.push({
      icon: 'user',
      label: 'Host',
      value: hostResult.hostName,
    });
  }

  confidenceChips.push({
    icon: themePreset.icon,
    label: 'Theme',
    value: themePreset.name,
  });

  return {
    title,
    startIso,
    ...(endIso ? { endIso } : {}),
    hasExplicitDate,
    hasExplicitTime,
    timeZone: safeTimeZone,
    ...(locationResult.locationName ? { locationName: locationResult.locationName } : {}),
    ...(locationResult.locationAddress ? { locationAddress: locationResult.locationAddress } : {}),
    ...(urlResult.virtualUrl ? { virtualUrl: urlResult.virtualUrl } : {}),
    ...(hostResult.hostName ? { hostName: hostResult.hostName } : {}),
    descriptionHtml,
    rsvpNotePrompt,
    detectedOccasionLabel,
    style,
    confidenceChips,
  };
}
