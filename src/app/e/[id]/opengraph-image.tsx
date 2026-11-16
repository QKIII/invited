import { ImageResponse } from 'next/og';
import { formatEventDateTime } from '@/lib/polyfills/temporal';
import { getEventDetail } from '@/lib/storage/events';
import { getThemePreset } from '@/lib/themes/presets';

export const runtime = 'nodejs';
export const revalidate = 300;
export const alt = 'Event invitation card';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

function safeHex(candidate: string | undefined, fallback: string): string {
  if (candidate && /^#[0-9a-fA-F]{6}$/.test(candidate.trim())) {
    return candidate.trim();
  }
  return fallback;
}

function getOnAccentColor(hex: string): string {
  const clean = safeHex(hex, '#6366f1').slice(1);
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? '#0b0f19' : '#ffffff';
}

function truncateText(text: string, maxLen: number): string {
  const normalized = text.trim();
  if (normalized.length <= maxLen) return normalized;
  return `${normalized.slice(0, maxLen - 1).trimEnd()}…`;
}

export default async function OpenGraphImage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getEventDetail(id, { summaryOnly: true });

  if (!detail) {
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '64px',
            backgroundColor: '#090d16',
            backgroundImage: 'linear-gradient(135deg, #090d16 0%, #161b2e 55%, #11242b 100%)',
            color: '#f8fafc',
          }}
        >
          <div
            style={{
              display: 'flex',
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: '#a5b4fc',
            }}
          >
            invited
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', fontSize: 58, fontWeight: 700, lineHeight: 1.1 }}>
              You&apos;re invited
            </div>
            <div style={{ display: 'flex', fontSize: 26, color: '#cbd5e1' }}>
              Free, account-free invitations with instant RSVPs
            </div>
          </div>
          <div style={{ display: 'flex', fontSize: 20, color: '#94a3b8' }}>
            Open link to view event details
          </div>
        </div>
      ),
      { ...size },
    );
  }

  const { event, rsvps } = detail;
  const preset = getThemePreset(event.style.themeId);
  const isLight = (event.style.colorMode ?? preset.colorMode) === 'light';
  const accent = safeHex(event.style.customAccentHex, safeHex(preset.accent, '#6366f1'));
  const onAccent = getOnAccentColor(accent);
  const bgBase = safeHex(
    event.style.customSurfaceHex,
    safeHex(preset.pageBg, isLight ? '#faf7f2' : '#0b0f19'),
  );
  const usePresetPalette = !event.style.customSurfaceHex && (event.style.colorMode ?? preset.colorMode) === preset.colorMode;
  const cardBg = usePresetPalette
    ? safeHex(preset.cardBg, isLight ? '#ffffff' : '#0f172a')
    : isLight
      ? '#ffffff'
      : '#111827';
  const borderCol = usePresetPalette
    ? safeHex(preset.border, isLight ? '#e2e8f0' : '#334155')
    : isLight
      ? '#e2e8f0'
      : '#334155';
  const textPrimary = usePresetPalette
    ? safeHex(preset.textPrimary, isLight ? '#0f172a' : '#f8fafc')
    : isLight
      ? '#0f172a'
      : '#f8fafc';
  const textMuted = usePresetPalette
    ? safeHex(preset.textMuted, isLight ? '#475569' : '#cbd5e1')
    : isLight
      ? '#475569'
      : '#cbd5e1';

  const formatted = await formatEventDateTime(
    event.startIso,
    event.endIso,
    event.timeZone,
  );

  const locationLine = event.locationName
    ? [event.locationName, event.locationAddress].filter(Boolean).join(' · ')
    : event.virtualUrl
      ? 'Virtual Event (Link inside)'
      : 'Location details inside';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '44px',
          backgroundColor: bgBase,
          backgroundImage: `linear-gradient(135deg, ${accent}38 0%, ${bgBase} 52%, ${accent}26 100%)`,
          color: textPrimary,
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '46px 52px',
            borderRadius: '32px',
            backgroundColor: cardBg,
            border: `2px solid ${borderCol}`,
          }}
        >
          {/* Top badge row */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              width: '100%',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 20px',
                borderRadius: '999px',
                border: `1.5px solid ${borderCol}`,
                fontSize: 22,
                fontWeight: 600,
              }}
            >
              <span>{preset.emoji}</span>
              <span>{preset.name}</span>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: 24,
                fontWeight: 700,
                color: accent,
              }}
            >
              invited
            </div>
          </div>

          {/* Title & Host */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div
              style={{
                display: 'flex',
                fontSize: event.title.length > 42 ? 48 : 58,
                fontWeight: 700,
                lineHeight: 1.12,
                letterSpacing: '-0.02em',
              }}
            >
              {truncateText(event.title, 76)}
            </div>

            {event.hostName && (
              <div style={{ display: 'flex', fontSize: 26, color: textMuted }}>
                Hosted by {truncateText(event.hostName, 44)}
              </div>
            )}
          </div>

          {/* Logistics & CTA row */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              width: '100%',
              gap: '24px',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '72%' }}>
              <div style={{ display: 'flex', fontSize: 26, fontWeight: 600 }}>
                {truncateText(formatted.fullLabel, 64)}
              </div>
              <div style={{ display: 'flex', fontSize: 22, color: textMuted }}>
                {truncateText(locationLine, 68)}
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '14px 26px',
                borderRadius: '999px',
                backgroundColor: accent,
                color: onAccent,
                fontSize: 22,
                fontWeight: 700,
              }}
            >
              {rsvps.totalHeadcount > 0
                ? `${rsvps.totalHeadcount} Going · RSVP`
                : 'Open & RSVP'}
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
