import { NextResponse } from 'next/server';
import { deleteRsvp } from '@/lib/storage/events';
import {
  extractEditKey,
  extractGuestToken,
  handleRouteError,
} from '@/lib/storage/http';

type RouteContext = { params: Promise<{ id: string; rsvpId: string }> };

export async function DELETE(req: Request, context: RouteContext) {
  try {
    const { id, rsvpId } = await context.params;
    const editKey = extractEditKey(req);
    const guestToken = extractGuestToken(req);

    await deleteRsvp(id, rsvpId, { editKey, guestToken });

    return NextResponse.json(
      { deleted: true, rsvpId },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
