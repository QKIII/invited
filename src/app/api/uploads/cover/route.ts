import { NextResponse } from 'next/server';
import { getTempCoverUpload, saveTempCoverUpload } from '@/lib/storage/events';
import { handleRouteError } from '@/lib/storage/http';
import { extractImagePayload } from '@/lib/storage/media';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const pathParam = url.searchParams.get('path');
    const media = await getTempCoverUpload(pathParam);
    if (!media) {
      return NextResponse.json(
        { error: 'Uploaded cover image not found' },
        { status: 404 },
      );
    }

    return new NextResponse(new Uint8Array(media.data), {
      status: 200,
      headers: {
        'Content-Type': media.contentType,
        'Cache-Control': 'public, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'",
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request) {
  try {
    const { buffer, declaredMime } = await extractImagePayload(req);
    const result = await saveTempCoverUpload(buffer, declaredMime);

    return NextResponse.json(result, {
      status: 201,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
