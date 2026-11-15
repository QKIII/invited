import { Suspense } from 'react';
import type { Metadata } from 'next';
import { EditInviteClient } from '@/components/studio/EditInviteClient';

export const metadata: Metadata = {
  title: 'Host Editor — invited',
  description: 'Manage your event details, styling, RSVPs, and guest wall.',
};

interface EditPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ key?: string }>;
}

export default async function EditEventPage({
  params,
  searchParams,
}: EditPageProps) {
  const { id } = await params;
  const resolvedSearch = await searchParams;
  const initialKey =
    typeof resolvedSearch?.key === 'string' ? resolvedSearch.key : undefined;

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#060913] flex items-center justify-center text-slate-300 text-sm">
          Loading host editor...
        </div>
      }
    >
      <EditInviteClient eventId={id} initialKey={initialKey} />
    </Suspense>
  );
}
