import fs from 'node:fs/promises';
import path from 'node:path';
import { ImageResponse } from 'next/og';
import { resolveCoverImageUrl } from '@/components/covers/CoverArt';
import { getEventCover, getEventDetail } from '@/lib/storage/events';
import { getThemePreset } from '@/lib/themes/presets';

export const runtime = 'nodejs';
export const revalidate = 300;
export const alt = 'Event cover preview';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

function safeHex(candidate: string | undefined, fallback: string): string {
  if (candidate && /^#[0-9a-fA-F]{6}$/.test(candidate.trim())) {
    return candidate.trim();
  }
  return fallback;
}

async function loadCoverDataUri(
  eventId: string,
  rawCoverUrl: string,
): Promise<string | null> {
  try {
    if (rawCoverUrl.startsWith('/covers/')) {
      const publicCoversRoot = path.resolve(process.cwd(), 'public', 'covers');
      const rel = rawCoverUrl.replace(/^\/covers\//, '');
      const fullPath = path.resolve(publicCoversRoot, rel);
      if (fullPath !== publicCoversRoot && !fullPath.startsWith(publicCoversRoot + path.sep)) {
        return null;
      }
      const buf = await fs.readFile(fullPath);
      return `data:image/jpeg;base64,${buf.toString('base64')}`;
    }

    if (rawCoverUrl.startsWith('/api/events/')) {
      const file = new URL(rawCoverUrl, 'http://localhost').searchParams.get('file');
      const media = await getEventCover(eventId, file);
      if (!media) return null;
      return `data:${media.contentType};base64,${media.data.toString('base64')}`;
    }

    if (/^https?:\/\//i.test(rawCoverUrl)) {
      return rawCoverUrl;
    }
  } catch {
    return null;
  }
  return null;
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

  const { event } = detail;
  const preset = getThemePreset(event.style.themeId);
  const isLight = (event.style.colorMode ?? preset.colorMode) === 'light';
  const accent = safeHex(event.style.customAccentHex, safeHex(preset.accent, '#6366f1'));
  const bgBase = safeHex(
    event.style.customSurfaceHex,
    safeHex(preset.pageBg, isLight ? '#faf7f2' : '#0b0f19'),
  );
  const usePresetPalette =
    !event.style.customSurfaceHex &&
    (event.style.colorMode ?? preset.colorMode) === preset.colorMode;
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

  const coverSrc = await loadCoverDataUri(
    event.id,
    resolveCoverImageUrl(event.style),
  );

  if (coverSrc) {
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            backgroundColor: bgBase,
          }}
        >
          <img
            src={coverSrc}
            alt={`You're invited to ${event.title}`}
            width={1200}
            height={630}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        </div>
      ),
      { ...size },
    );
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px',
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
            justifyContent: 'center',
            gap: '16px',
            padding: '52px',
            borderRadius: '32px',
            backgroundColor: cardBg,
            border: `2px solid ${borderCol}`,
          }}
        >
          <div style={{ display: 'flex', fontSize: 28, fontWeight: 700, color: accent }}>
            invited
          </div>
          <div style={{ display: 'flex', fontSize: 54, fontWeight: 700, lineHeight: 1.12 }}>
            You&apos;re invited to {event.title}
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
