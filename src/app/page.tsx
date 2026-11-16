import { Suspense } from 'react';
import { HomeLandingClient, type HomeStage } from '@/components/home/HomeLandingClient';

interface HomePageProps {
  searchParams?: Promise<{ stage?: string }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const resolved = searchParams ? await searchParams : undefined;
  const initialStage: HomeStage = resolved?.stage === 'prompt' ? 'prompt' : 'hero';

  return (
    <Suspense fallback={null}>
      <HomeLandingClient initialStage={initialStage} />
    </Suspense>
  );
}
