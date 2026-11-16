import { NextResponse } from 'next/server';
import { getEventCover, saveEventCover } from '@/lib/storage/events';
import { extractEditKey, handleRouteError } from '@/lib/storage/http';
import { extractImagePayload } from '@/lib/storage/media';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const url = new URL(req.url);
    const filename = url.searchParams.get('file');

    const media = await getEventCover(id, filename);
    if (!media) {
      return NextResponse.json({ error: 'Cover image not found' }, { status: 404 });
    }

    const cacheControl = filename?.trim()
      ? 'public, max-age=31536000, s-maxage=31536000, immutable'
      : 'public, max-age=3600';

    return new NextResponse(new Uint8Array(media.data), {
      status: 200,
      headers: {
        'Content-Type': media.contentType,
        'Cache-Control': cacheControl,
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'",
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const headerOrQueryKey = extractEditKey(req);
    const { buffer, declaredMime, editKeyFromForm } =
      await extractImagePayload(req);
    const editKey = headerOrQueryKey ?? editKeyFromForm ?? null;

    const result = await saveEventCover(id, editKey, buffer, declaredMime);

    return NextResponse.json(
      result,
      { status: 201, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
