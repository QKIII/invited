'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { safeSetHTML, stripHtmlToText } from '@/lib/sanitize';

interface SafeRichHtmlProps {
  html: string;
  className?: string;
}

/**
 * Renders sanitized rich event description HTML without unsafe raw HTML injection.
 * Provides safe plain-text SSR output while hydrating into sanitized prose DOM.
 */
export function SafeRichHtml({ html, className }: SafeRichHtmlProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [renderedHtml, setRenderedHtml] = useState<string | null>(null);

  const fallbackText = useMemo(() => stripHtmlToText(html), [html]);
  const isReady = renderedHtml === html;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let cancelled = false;
    void safeSetHTML(el, html).then(() => {
      if (!cancelled) {
        setRenderedHtml(html);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [html]);

  if (!html.trim()) {
    return null;
  }

  return (
    <>
      {!isReady && fallbackText ? (
        <div className={className} style={{ whiteSpace: 'pre-line' }}>
          {fallbackText}
        </div>
      ) : null}
      <div ref={containerRef} className={className} hidden={!isReady} />
    </>
  );
}
