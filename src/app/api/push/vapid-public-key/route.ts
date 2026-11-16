import { NextResponse } from 'next/server';
import { isEmailConfigured } from '@/lib/notifications/email';
import { getVapidPublicKey } from '@/lib/notifications/push';

export async function GET() {
  return NextResponse.json(
    {
      publicKey: getVapidPublicKey(),
      emailConfigured: isEmailConfigured(),
    },
    { status: 200, headers: { 'Cache-Control': 'no-store' } },
  );
}
