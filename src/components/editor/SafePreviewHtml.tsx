'use client';

import { useEffect, useRef } from 'react';

const ALLOWED_ELEMENTS = [
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'h2',
  'h3',
  'ul',
  'ol',
  'li',
  'blockquote',
  'a',
  'code',
  'hr',
];

const ALLOWED_ATTRIBUTES = ['href', 'target', 'rel'];

type DomPurifyInstance = typeof import('dompurify').default;
let dompurifyPromise: Promise<DomPurifyInstance> | null = null;

async function getDomPurify(): Promise<DomPurifyInstance> {
  if (!dompurifyPromise) {
    dompurifyPromise = import('dompurify').then((mod) => mod.default);
  }
  return dompurifyPromise;
}

export async function sanitizeRichTextHtml(html: string): Promise<string> {
  if (!html || !html.trim()) return '';
  const DOMPurify = await getDomPurify();
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ALLOWED_ELEMENTS,
    ALLOWED_ATTR: ALLOWED_ATTRIBUTES,
    ALLOW_ARIA_ATTR: false,
    ALLOW_DATA_ATTR: false,
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|\/[^/])/i,
  });
}

function hardenLinks(container: HTMLElement): void {
  const links = container.querySelectorAll('a');
  for (const link of links) {
    const href = link.getAttribute('href')?.trim() ?? '';
    if (!/^(?:https?:\/\/|mailto:|\/(?!\/))/i.test(href)) {
      link.removeAttribute('href');
    } else {
      link.setAttribute('rel', 'noopener noreferrer nofollow');
      link.setAttribute('target', '_blank');
    }
  }
}

export async function safeSetElementHtml(
  el: HTMLElement,
  html: string,
): Promise<void> {
  if (!html || !html.trim()) {
    el.textContent = '';
    return;
  }

  if (typeof Element !== 'undefined' && 'setHTML' in Element.prototype) {
    try {
      const setHtmlFn = (
        el as HTMLElement & {
          setHTML?: (
            input: string,
            options?: {
              sanitizer?: {
                elements?: string[];
                attributes?: string[];
              };
            },
          ) => void;
        }
      ).setHTML;
      if (typeof setHtmlFn === 'function') {
        setHtmlFn.call(el, html, {
          sanitizer: {
            elements: ALLOWED_ELEMENTS,
            attributes: ALLOWED_ATTRIBUTES,
          },
        });
        hardenLinks(el);
        return;
      }
    } catch {
      // Fallback to DOMPurify if experimental native setHTML rejects options
    }
  }

  const clean = await sanitizeRichTextHtml(html);
  el.innerHTML = clean;
  hardenLinks(el);
}

interface SafePreviewHtmlProps {
  html: string;
  className?: string;
  emptyFallback?: string;
}

export function SafePreviewHtml({
  html,
  className,
  emptyFallback,
}: SafePreviewHtmlProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let cancelled = false;

    const apply = async () => {
      if (!html || !html.trim()) {
        if (!cancelled) {
          el.textContent = emptyFallback ?? '';
        }
        return;
      }
      await safeSetElementHtml(el, html);
      if (cancelled) return;
      if (!el.textContent?.trim() && emptyFallback) {
        el.textContent = emptyFallback;
      }
    };

    void apply();
    return () => {
      cancelled = true;
    };
  }, [html, emptyFallback]);

  return (
    <div
      ref={containerRef}
      className={`invite-prose ${className ?? ''}`.trim()}
    />
  );
}
