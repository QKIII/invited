import { NextResponse } from 'next/server';
import { buildIcsContent } from '@/lib/calendar/ics';
import { getEventDetail } from '@/lib/storage/events';
import { handleRouteError } from '@/lib/storage/http';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const detail = await getEventDetail(id);
    if (!detail) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const origin = new URL(req.url).origin;
    const eventUrl = `${origin}/e/${detail.event.id}`;
    const icsBody = buildIcsContent(detail.event, eventUrl);

    return new NextResponse(icsBody, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'attachment; filename="event.ics"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
