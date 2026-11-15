import { NextResponse } from 'next/server';
import { createEvent, type CreateEventInput } from '@/lib/storage/events';
import { handleRouteError, readJsonBody } from '@/lib/storage/http';

export async function POST(req: Request) {
  try {
    const body = await readJsonBody<CreateEventInput>(req);
    const { event, editKey } = await createEvent(body);

    const guestUrl = `/e/${event.id}`;
    const editUrl = `/e/${event.id}/edit?key=${encodeURIComponent(editKey)}`;

    return NextResponse.json(
      {
        id: event.id,
        editKey,
        guestUrl,
        editUrl,
        event,
      },
      { status: 201, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
