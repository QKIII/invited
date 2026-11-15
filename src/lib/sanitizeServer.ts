const ALLOWED_TAGS = new Set([
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
]);

const VOID_TAGS = new Set(['br', 'hr']);

const DROP_CONTENT_TAGS = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'noscript',
  'template',
  'svg',
  'math',
  'textarea',
  'title',
  'head',
]);

const SAFE_URL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  colon: ':',
  tab: '\t',
  newline: '\n',
};

function decodeHtmlEntities(input: string): string {
  return input.replace(
    /&(#x[\da-fA-F]+|#\d+|[a-zA-Z]+);?/g,
    (match, body: string) => {
      if (body.startsWith('#x') || body.startsWith('#X')) {
        const code = Number.parseInt(body.slice(2), 16);
        return Number.isFinite(code) && code > 0 && code <= 0x10ffff
          ? String.fromCodePoint(code)
          : '';
      }
      if (body.startsWith('#')) {
        const code = Number.parseInt(body.slice(1), 10);
        return Number.isFinite(code) && code > 0 && code <= 0x10ffff
          ? String.fromCodePoint(code)
          : '';
      }
      const named = NAMED_ENTITIES[body.toLowerCase()];
      return named ?? match;
    },
  );
}

function escapeTextNode(text: string): string {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '<') {
      out += '&lt;';
    } else if (ch === '>') {
      out += '&gt;';
    } else if (ch === '&') {
      const rest = text.slice(i);
      const entityMatch = /^&(?:#\d+|#x[\da-fA-F]+|[a-zA-Z][\w-]{1,30});/.exec(
        rest,
      );
      if (entityMatch) {
        out += entityMatch[0];
        i += entityMatch[0].length - 1;
      } else {
        out += '&amp;';
      }
    } else {
      out += ch;
    }
  }
  return out;
}

function escapeAttrValue(val: string): string {
  return val
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function sanitizeHrefUrl(raw: string): string | null {
  const decoded = decodeHtmlEntities(raw)
    .replace(/[\u0000-\u0020\u007f]+/g, '')
    .trim();
  if (!decoded) {
    return null;
  }

  // Allow relative paths and in-page anchors, but reject protocol-relative //urls
  if (decoded.startsWith('#') || (decoded.startsWith('/') && !decoded.startsWith('//'))) {
    return decoded;
  }

  const colonIdx = decoded.indexOf(':');
  const slashIdx = decoded.indexOf('/');
  const queryIdx = decoded.indexOf('?');
  const hashIdx = decoded.indexOf('#');
  const firstDelimiter = [slashIdx, queryIdx, hashIdx]
    .filter((idx) => idx >= 0)
    .reduce((min, idx) => Math.min(min, idx), Number.POSITIVE_INFINITY);

  // If a colon precedes path/query/hash, enforce the protocol allowlist
  if (colonIdx !== -1 && colonIdx < firstDelimiter) {
    const scheme = decoded.slice(0, colonIdx + 1).toLowerCase();
    if (!SAFE_URL_PROTOCOLS.has(scheme)) {
      return null;
    }
  }

  try {
    const parsed = new URL(decoded, 'https://invited.local');
    if (!SAFE_URL_PROTOCOLS.has(parsed.protocol)) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

function parseAttributes(attrSource: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrRegex =
    /([a-zA-Z_:][\w:.-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

  let match: RegExpExecArray | null;
  while ((match = attrRegex.exec(attrSource)) !== null) {
    const name = match[1].toLowerCase();
    if (name.startsWith('on')) {
      continue;
    }
    const value = match[2] ?? match[3] ?? match[4] ?? '';
    if (!(name in attrs)) {
      attrs[name] = value;
    }
  }
  return attrs;
}

function findTagEnd(html: string, start: number): number {
  let quote: '"' | "'" | null = null;
  for (let i = start; i < html.length; i++) {
    const ch = html[i];
    if (quote) {
      if (ch === quote) {
        quote = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === '>') {
      return i;
    }
  }
  return -1;
}

/**
 * Deterministic server-side HTML allowlist sanitizer.
 * Strips dangerous tags and their contents, removes event handlers and unsafe URLs,
 * and emits well-balanced safe prose HTML.
 */
export function sanitizeRichHtml(html: string): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  let output = '';
  const openStack: string[] = [];
  let skipTag: string | null = null;
  let skipDepth = 0;

  let i = 0;
  while (i < html.length) {
    const ltIdx = html.indexOf('<', i);
    if (ltIdx === -1) {
      if (!skipTag) {
        output += escapeTextNode(html.slice(i));
      }
      break;
    }

    if (ltIdx > i && !skipTag) {
      output += escapeTextNode(html.slice(i, ltIdx));
    }

    if (html.startsWith('<!--', ltIdx)) {
      const commentEnd = html.indexOf('-->', ltIdx + 4);
      i = commentEnd === -1 ? html.length : commentEnd + 3;
      continue;
    }

    if (html.startsWith('<!', ltIdx) || html.startsWith('<?', ltIdx)) {
      const declEnd = html.indexOf('>', ltIdx + 2);
      i = declEnd === -1 ? html.length : declEnd + 1;
      continue;
    }

    const gtIdx = findTagEnd(html, ltIdx + 1);
    if (gtIdx === -1) {
      if (!skipTag) {
        output += escapeTextNode(html.slice(ltIdx));
      }
      break;
    }

    const rawTag = html.slice(ltIdx + 1, gtIdx).trim();
    i = gtIdx + 1;

    if (!rawTag) {
      continue;
    }

    const tagMatch = /^(\/?)\s*([a-zA-Z][a-zA-Z0-9:-]*)([\s\S]*)$/.exec(rawTag);
    if (!tagMatch) {
      if (!skipTag) {
        output += escapeTextNode(`<${rawTag}>`);
      }
      continue;
    }

    const isClosing = tagMatch[1] === '/';
    const tagName = tagMatch[2].toLowerCase();
    let rest = tagMatch[3] ?? '';
    const isSelfClosing = !isClosing && /\/\s*$/.test(rest);
    if (isSelfClosing) {
      rest = rest.replace(/\/\s*$/, '');
    }

    if (skipTag) {
      if (tagName === skipTag) {
        if (isClosing) {
          skipDepth -= 1;
          if (skipDepth <= 0) {
            skipTag = null;
            skipDepth = 0;
          }
        } else if (!isSelfClosing) {
          skipDepth += 1;
        }
      }
      continue;
    }

    if (!isClosing && DROP_CONTENT_TAGS.has(tagName)) {
      if (!isSelfClosing) {
        skipTag = tagName;
        skipDepth = 1;
      }
      continue;
    }

    if (!ALLOWED_TAGS.has(tagName)) {
      continue;
    }

    if (isClosing) {
      if (VOID_TAGS.has(tagName)) {
        continue;
      }
      const stackIdx = openStack.lastIndexOf(tagName);
      if (stackIdx !== -1) {
        while (openStack.length > stackIdx) {
          const popped = openStack.pop()!;
          output += `</${popped}>`;
        }
      }
      continue;
    }

    if (tagName === 'a') {
      const attrs = parseAttributes(rest);
      const safeHref = attrs.href ? sanitizeHrefUrl(attrs.href) : null;
      const safeTarget = attrs.target === '_blank' ? '_blank' : null;
      const parts = ['<a'];
      if (safeHref) {
        parts.push(`href="${escapeAttrValue(safeHref)}"`);
      }
      if (safeTarget) {
        parts.push(`target="${safeTarget}"`);
      }
      parts.push('rel="noopener noreferrer nofollow"');
      output += `${parts.join(' ')}>`;
      openStack.push('a');
      continue;
    }

    output += `<${tagName}>`;
    if (!VOID_TAGS.has(tagName) && !isSelfClosing) {
      openStack.push(tagName);
    }
  }

  while (openStack.length > 0) {
    output += `</${openStack.pop()!}>`;
  }

  return output.trim();
}

/**
 * Cleans user-entered plain text (names, notes, comments) by removing unsafe
 * control characters, normalizing line breaks, and enforcing an optional max length.
 */
export function sanitizePlainText(
  text: string,
  maxLen?: number,
  options?: { singleLine?: boolean },
): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  let cleaned = text
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');

  if (options?.singleLine) {
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
  } else {
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();
  }

  if (typeof maxLen === 'number' && maxLen > 0 && cleaned.length > maxLen) {
    cleaned = cleaned.slice(0, maxLen).trim();
  }

  return cleaned;
}
