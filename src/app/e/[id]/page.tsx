import { cache } from 'react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { resolveCoverImageUrl } from '@/components/covers/CoverArt';
import { InviteView } from '@/components/invite/InviteView';
import { formatEventDateTime } from '@/lib/polyfills/temporal';
import { stripHtmlToText } from '@/lib/sanitize';
import { getEventDetail } from '@/lib/storage/events';

export const dynamic = 'force-dynamic';

const getCachedPublicEventDetail = cache((id: string) => getEventDetail(id));

async function resolveRequestOrigin(): Promise<string> {
  try {
    const reqHeaders = await headers();
    const host =
      reqHeaders.get('x-forwarded-host')?.split(',')[0]?.trim() ||
      reqHeaders.get('host')?.trim();
    if (host) {
      const proto =
        reqHeaders.get('x-forwarded-proto')?.split(',')[0]?.trim() ||
        (host.startsWith('localhost') || host.startsWith('127.0.0.1')
          ? 'http'
          : 'https');
      return `${proto}://${host}`;
    }
  } catch {
    // Outside Next.js request context (e.g. unit tests)
  }
  if (process.env.NEXT_PUBLIC_SITE_URL?.trim()) {
    return process.env.NEXT_PUBLIC_SITE_URL.trim().replace(/\/+$/, '');
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.trim()}`;
  }
  return 'https://invited-lyart.vercel.app';
}

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ key?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const detail = await getCachedPublicEventDetail(id);

  if (!detail) {
    return {
      title: 'Invitation Not Found — invited',
      description: 'This invitation link is no longer active or could not be found.',
    };
  }

  const { event } = detail;
  const formatted = await formatEventDateTime(
    event.startIso,
    event.endIso,
    event.timeZone,
  );
  const locationPart = event.locationName
    ? ` · ${event.locationName}`
    : event.virtualUrl
      ? ' · Online'
      : '';
  const bodySnippet = stripHtmlToText(event.descriptionHtml).slice(0, 120);
  const description = [
    `${formatted.fullLabel}${locationPart}`,
    event.hostName ? `Hosted by ${event.hostName}` : '',
    bodySnippet,
  ]
    .filter(Boolean)
    .join(' — ');

  const shareTitle = `You're invited to ${event.title}`;
  const origin = await resolveRequestOrigin();
  const rawCoverUrl = resolveCoverImageUrl(event.style);
  const absoluteCoverUrl = /^https?:\/\//i.test(rawCoverUrl)
    ? rawCoverUrl
    : new URL(
        rawCoverUrl.startsWith('/') ? rawCoverUrl : `/${rawCoverUrl}`,
        origin,
      ).toString();
  const isStaticPresetJpg =
    rawCoverUrl.startsWith('/covers/') && rawCoverUrl.endsWith('.jpg');

  return {
    title: shareTitle,
    description,
    openGraph: {
      title: shareTitle,
      description,
      type: 'website',
      images: [
        {
          url: absoluteCoverUrl,
          ...(isStaticPresetJpg
            ? { width: 960, height: 540, type: 'image/jpeg' }
            : {}),
          alt: shareTitle,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: shareTitle,
      description,
      images: [absoluteCoverUrl],
    },
  };
}

export default async function EventInvitePage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { key } = await searchParams;

  const detail = key
    ? await getEventDetail(id, { editKey: key })
    : await getCachedPublicEventDetail(id);
  if (!detail) {
    notFound();
  }

  const initialFormattedDate = await formatEventDateTime(
    detail.event.startIso,
    detail.event.endIso,
    detail.event.timeZone,
  );

  return (
    <InviteView
      initialDetail={detail}
      initialFormattedDate={initialFormattedDate}
      initialEditKey={key ?? null}
    />
  );
}
