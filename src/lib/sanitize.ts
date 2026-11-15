export const ALLOWED_ELEMENTS: string[] = [
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

export const ALLOWED_ATTRIBUTES: string[] = ['href', 'target', 'rel'];

interface SanitizerConfig {
  elements?: string[];
  attributes?: string[];
}

interface ElementWithSetHTML extends HTMLElement {
  setHTML: (html: string, options?: { sanitizer?: SanitizerConfig }) => void;
}

type DomPurifyInstance = typeof import('dompurify')['default'];

let dompurifyPromise: Promise<DomPurifyInstance> | null = null;

async function getDOMPurify(): Promise<DomPurifyInstance> {
  if (!dompurifyPromise) {
    dompurifyPromise = import('dompurify').then((mod) => {
      const candidate = mod.default as unknown as DomPurifyInstance &
        ((win: Window) => DomPurifyInstance);
      if (typeof candidate?.sanitize === 'function') {
        return candidate;
      }
      if (typeof candidate === 'function' && typeof window !== 'undefined') {
        return candidate(window);
      }
      return candidate;
    });
  }
  return dompurifyPromise;
}

export function isSafeHref(href: string | null | undefined): boolean {
  if (!href) return false;
  const trimmed = href.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('/') || trimmed.startsWith('#')) {
    return !trimmed.startsWith('//');
  }
  try {
    const parsed = new URL(trimmed, 'https://example.invalid');
    return (
      parsed.protocol === 'https:' ||
      parsed.protocol === 'http:' ||
      parsed.protocol === 'mailto:' ||
      parsed.protocol === 'tel:'
    );
  } catch {
    return false;
  }
}

function enforceSafeAnchors(root: HTMLElement): void {
  const anchors = root.querySelectorAll('a');
  for (const anchor of anchors) {
    const href = anchor.getAttribute('href');
    if (!isSafeHref(href)) {
      anchor.removeAttribute('href');
      anchor.removeAttribute('target');
      anchor.removeAttribute('rel');
      continue;
    }

    const trimmed = href!.trim();
    if (/^https?:/i.test(trimmed)) {
      anchor.setAttribute('target', '_blank');
      anchor.setAttribute('rel', 'noopener noreferrer nofollow');
    } else if (anchor.getAttribute('target') === '_blank') {
      anchor.setAttribute('rel', 'noopener noreferrer nofollow');
    } else {
      anchor.setAttribute('rel', 'noopener noreferrer');
    }
  }
}

/**
 * Safely renders untrusted HTML into `el` using native `Element.prototype.setHTML`
 * when supported, or lazily loads DOMPurify with a strict allowlist fallback.
 */
export async function safeSetHTML(el: HTMLElement, html: string): Promise<void> {
  const input = html ?? '';
  if (!input.trim()) {
    el.textContent = '';
    return;
  }

  const hasNativeSetHTML =
    typeof Element !== 'undefined' &&
    'setHTML' in Element.prototype &&
    typeof (el as Partial<ElementWithSetHTML>).setHTML === 'function';

  if (hasNativeSetHTML) {
    try {
      (el as ElementWithSetHTML).setHTML(input, {
        sanitizer: {
          elements: [...ALLOWED_ELEMENTS],
          attributes: [...ALLOWED_ATTRIBUTES],
        },
      });
      enforceSafeAnchors(el);
      return;
    } catch {
      // Fall back to DOMPurify if native setHTML rejects options object.
    }
  }

  const DOMPurify = await getDOMPurify();
  const clean = DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [...ALLOWED_ELEMENTS, '#text'],
    ALLOWED_ATTR: [...ALLOWED_ATTRIBUTES],
    ALLOW_ARIA_ATTR: false,
    ALLOW_DATA_ATTR: false,
    KEEP_CONTENT: false,
  });

  el.innerHTML = clean;
  enforceSafeAnchors(el);
}

/**
 * Extracts plain text from sanitized rich HTML for SSR fallback previews and metadata.
 */
export function stripHtmlToText(html: string): string {
  if (!html) return '';
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/(p|h2|h3|li|blockquote)>/gi, '\n')
    .replace(/<(br|hr)\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
