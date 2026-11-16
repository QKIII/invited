import { NextResponse } from 'next/server';
import { removeSubscriberByTarget } from '@/lib/storage/events';
import { handleRouteError } from '@/lib/storage/http';

type RouteContext = { params: Promise<{ id: string }> };

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export async function GET(req: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const url = new URL(req.url);
    const subId = url.searchParams.get('subId') ?? undefined;
    const email = url.searchParams.get('email') ?? undefined;

    await removeSubscriberByTarget(id, { subId, email });

    const safeEventHref = `/e/${encodeURIComponent(id)}`;
    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Unsubscribed — invited</title>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; background: #0f172a; color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .card { max-width: 420px; width: 100%; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.16); border-radius: 24px; padding: 28px; text-align: center; }
    h1 { margin: 0 0 10px; font-size: 20px; }
    p { margin: 0 0 20px; font-size: 14px; line-height: 1.5; color: #cbd5e1; }
    a { display: inline-block; background: #ffffff; color: #0f172a; padding: 10px 20px; border-radius: 999px; font-size: 14px; font-weight: 600; text-decoration: none; }
  </style>
</head>
<body>
  <div class="card">
    <h1>You&apos;re unsubscribed</h1>
    <p>You will no longer receive email updates for this event.</p>
    <a href="${escapeHtml(safeEventHref)}">Back to invite</a>
  </div>
</body>
</html>`;

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const url = new URL(req.url);
    const subId = url.searchParams.get('subId') ?? undefined;
    const email = url.searchParams.get('email') ?? undefined;

    const removed = await removeSubscriberByTarget(id, { subId, email });
    return NextResponse.json(
      { unsubscribed: true, removed },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
