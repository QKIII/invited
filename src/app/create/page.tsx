import { Suspense } from 'react';
import type { Metadata } from 'next';
import { CreateInviteClient } from '@/components/studio/CreateInviteClient';

export const metadata: Metadata = {
  title: 'New Invite — invited',
  description:
    'Create an event invite in seconds and collect RSVPs with a single link.',
};

interface CreatePageProps {
  searchParams: Promise<{ prompt?: string; from?: string }>;
}

export default async function CreatePage({ searchParams }: CreatePageProps) {
  const resolved = await searchParams;
  const initialPrompt =
    typeof resolved?.prompt === 'string' ? resolved.prompt : undefined;

  return (
    <Suspense
      fallback={
        <div className="min-h-dvh bg-[#082556] flex items-center justify-center text-slate-200 text-sm">
          Loading...
        </div>
      }
    >
      <CreateInviteClient initialPrompt={initialPrompt} />
    </Suspense>
  );
}
