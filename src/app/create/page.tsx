import { Suspense } from 'react';
import type { Metadata } from 'next';
import { CreateInviteClient } from '@/components/studio/CreateInviteClient';

export const metadata: Metadata = {
  title: 'Create Invite — invited',
  description:
    'Design an account-free event invitation with live preview, rich description, and instant binary RSVPs.',
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
        <div className="min-h-screen bg-[#060913] flex items-center justify-center text-slate-300 text-sm">
          Loading invite studio...
        </div>
      }
    >
      <CreateInviteClient initialPrompt={initialPrompt} />
    </Suspense>
  );
}
