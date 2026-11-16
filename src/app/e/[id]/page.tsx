import { cache } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { InviteView } from '@/components/invite/InviteView';
import { formatEventDateTime } from '@/lib/polyfills/temporal';
import { stripHtmlToText } from '@/lib/sanitize';
import { getEventDetail } from '@/lib/storage/events';

export const dynamic = 'force-dynamic';

const getCachedPublicEventDetail = cache((id: string) => getEventDetail(id));

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

  return {
    title: `${event.title} — invited`,
    description,
    openGraph: {
      title: event.title,
      description,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: event.title,
      description,
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
