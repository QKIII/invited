import { Suspense } from 'react';
import { CreateInviteClient } from '@/components/studio/CreateInviteClient';

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <CreateInviteClient />
    </Suspense>
  );
}
