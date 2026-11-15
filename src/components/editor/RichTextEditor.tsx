'use client';

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
} from 'react';
import {
  Bold,
  Heading2,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
} from 'lucide-react';
import {
  safeSetElementHtml,
  sanitizeRichTextHtml,
} from '@/components/editor/SafePreviewHtml';

interface RichTextEditorProps {
  id?: string;
  label: string;
  value: string;
  onChange: (nextHtml: string) => void;
  placeholder?: string;
  hint?: string;
}

interface ActiveFormats {
  bold: boolean;
  italic: boolean;
  heading: boolean;
  ul: boolean;
  ol: boolean;
  quote: boolean;
}

function normalizeEditorHtml(rawHtml: string): string {
  if (!rawHtml.trim()) return '';
  const container = document.createElement('div');
  container.innerHTML = rawHtml;

  // Convert bare <div> lines produced by contentEditable into <p>
  const children = Array.from(container.childNodes);
  for (const node of children) {
    if (node.nodeType === Node.ELEMENT_NODE && node.nodeName === 'DIV') {
      const p = document.createElement('p');
      while (node.firstChild) {
        p.appendChild(node.firstChild);
      }
      container.replaceChild(p, node);
    }
  }

  // Strip empty tags except <br> and <hr>
  const result = container.innerHTML.trim();
  if (result === '<br>' || result === '<p><br></p>' || result === '<p></p>') {
    return '';
  }
  return result;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function plainTextToHtml(text: string): string {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) return '';
  return normalized
    .split(/\n{2,}/)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

function isValidSafeUrl(url: string): boolean {
  const trimmed = url.trim();
  return /^(?:https?:\/\/|mailto:|\/(?!\/))/i.test(trimmed);
}

export function RichTextEditor({
  id,
  label,
  value,
  onChange,
  placeholder = 'Share the vibe, schedule, dress code, or what to bring...',
  hint,
}: RichTextEditorProps) {
  const generatedId = useId();
  const editorId = id ?? `rich-editor-${generatedId}`;
  const labelId = `${editorId}-label`;

  const editorRef = useRef<HTMLDivElement>(null);
  const lastEmittedHtmlRef = useRef<string>('');
  const savedRangeRef = useRef<Range | null>(null);

  const [isEmpty, setIsEmpty] = useState(!value.trim());
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('https://');
  const [linkText, setLinkText] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);
  const [formats, setFormats] = useState<ActiveFormats>({
    bold: false,
    italic: false,
    heading: false,
    ul: false,
    ol: false,
    quote: false,
  });

  const emitCurrentHtml = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const normalized = normalizeEditorHtml(el.innerHTML);
    lastEmittedHtmlRef.current = normalized;
    setIsEmpty(!el.textContent?.trim() && !/<(hr|ul|ol)/i.test(normalized));
    onChange(normalized);
  }, [onChange]);

  const refreshActiveFormats = useCallback(() => {
    if (typeof document === 'undefined') return;
    const el = editorRef.current;
    const selection = window.getSelection();
    if (!el || !selection || selection.rangeCount === 0) return;
    if (!el.contains(selection.anchorNode)) return;

    let blockTag = '';
    let node: Node | null = selection.anchorNode;
    while (node && node !== el) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const tag = node.nodeName.toUpperCase();
        if (['H2', 'H3', 'BLOCKQUOTE', 'P'].includes(tag)) {
          blockTag = tag;
          break;
        }
      }
      node = node.parentNode;
    }

    try {
      setFormats({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        heading: blockTag === 'H2' || blockTag === 'H3',
        ul: document.queryCommandState('insertUnorderedList'),
        ol: document.queryCommandState('insertOrderedList'),
        quote: blockTag === 'BLOCKQUOTE',
      });
    } catch {
      // queryCommandState may throw in non-DOM test environments
    }
  }, []);

  // Sync external `value` updates (e.g., NLP autofill or initial load in edit mode)
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (value === lastEmittedHtmlRef.current) return;

    let cancelled = false;
    const syncExternal = async () => {
      await safeSetElementHtml(el, value);
      if (cancelled) return;
      lastEmittedHtmlRef.current = value;
      setIsEmpty(!el.textContent?.trim() && !value.trim());
    };
    void syncExternal();

    return () => {
      cancelled = true;
    };
  }, [value]);

  useEffect(() => {
    const handleSelectionChange = () => {
      refreshActiveFormats();
    };
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [refreshActiveFormats]);

  const focusEditor = () => {
    editorRef.current?.focus();
  };

  const execFormat = (command: string, commandValue?: string) => {
    focusEditor();
    try {
      document.execCommand(command, false, commandValue);
    } catch {
      // Fallback ignored in headless environments
    }
    emitCurrentHtml();
    refreshActiveFormats();
  };

  const toggleBlockFormat = (targetTag: 'H2' | 'BLOCKQUOTE') => {
    focusEditor();
    const isCurrentlyActive =
      targetTag === 'H2' ? formats.heading : formats.quote;
    try {
      document.execCommand(
        'formatBlock',
        false,
        isCurrentlyActive ? '<P>' : `<${targetTag}>`,
      );
    } catch {
      // Fallback ignored
    }
    emitCurrentHtml();
    refreshActiveFormats();
  };

  const openLinkBar = () => {
    const selection = window.getSelection();
    const el = editorRef.current;
    if (selection && selection.rangeCount > 0 && el?.contains(selection.anchorNode)) {
      const range = selection.getRangeAt(0);
      savedRangeRef.current = range.cloneRange();
      const selected = selection.toString().trim();
      setLinkText(selected);
    } else {
      savedRangeRef.current = null;
      setLinkText('');
    }
    setLinkUrl('https://');
    setLinkError(null);
    setShowLinkInput((prev) => !prev);
  };

  const applyLink = () => {
    const cleanUrl = linkUrl.trim();
    if (!isValidSafeUrl(cleanUrl)) {
      setLinkError('Enter a valid link starting with https://, http://, or mailto:');
      return;
    }

    focusEditor();
    const selection = window.getSelection();
    if (savedRangeRef.current && selection) {
      selection.removeAllRanges();
      selection.addRange(savedRangeRef.current);
    }

    const anchor = document.createElement('a');
    anchor.href = cleanUrl;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer nofollow';
    anchor.textContent = linkText.trim() || cleanUrl;

    if (selection && selection.rangeCount > 0 && editorRef.current?.contains(selection.anchorNode)) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(anchor);
      range.setStartAfter(anchor);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    } else if (editorRef.current) {
      const p = document.createElement('p');
      p.appendChild(anchor);
      editorRef.current.appendChild(p);
    }

    setShowLinkInput(false);
    setLinkError(null);
    savedRangeRef.current = null;
    emitCurrentHtml();
  };

  const handleLinkInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      applyLink();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setShowLinkInput(false);
    }
  };

  const handlePaste = async (e: ClipboardEvent<HTMLDivElement>) => {
    const htmlData = e.clipboardData.getData('text/html');
    const textData = e.clipboardData.getData('text/plain');
    if (!htmlData && !textData) return;

    e.preventDefault();
    let cleanHtml = '';
    if (htmlData) {
      cleanHtml = await sanitizeRichTextHtml(htmlData);
    }
    if (!cleanHtml && textData) {
      cleanHtml = plainTextToHtml(textData);
    }
    if (!cleanHtml) return;

    focusEditor();
    try {
      document.execCommand('insertHTML', false, cleanHtml);
    } catch {
      if (editorRef.current) {
        const current = editorRef.current.innerHTML;
        await safeSetElementHtml(editorRef.current, `${current}${cleanHtml}`);
      }
    }
    emitCurrentHtml();
  };

  type ToolbarAction =
    | 'bold'
    | 'italic'
    | 'heading'
    | 'ul'
    | 'ol'
    | 'quote'
    | 'link';

  const handleToolbarAction = (action: ToolbarAction) => {
    switch (action) {
      case 'bold':
        execFormat('bold');
        break;
      case 'italic':
        execFormat('italic');
        break;
      case 'heading':
        toggleBlockFormat('H2');
        break;
      case 'ul':
        execFormat('insertUnorderedList');
        break;
      case 'ol':
        execFormat('insertOrderedList');
        break;
      case 'quote':
        toggleBlockFormat('BLOCKQUOTE');
        break;
      case 'link':
        openLinkBar();
        break;
    }
  };

  const toolbarButtons: Array<{
    action: ToolbarAction;
    label: string;
    icon: typeof Bold;
    active: boolean;
  }> = [
    {
      action: 'bold',
      label: 'Bold',
      icon: Bold,
      active: formats.bold,
    },
    {
      action: 'italic',
      label: 'Italic',
      icon: Italic,
      active: formats.italic,
    },
    {
      action: 'heading',
      label: 'Subheading',
      icon: Heading2,
      active: formats.heading,
    },
    {
      action: 'ul',
      label: 'Bullet list',
      icon: List,
      active: formats.ul,
    },
    {
      action: 'ol',
      label: 'Numbered list',
      icon: ListOrdered,
      active: formats.ol,
    },
    {
      action: 'quote',
      label: 'Quote / Highlight',
      icon: Quote,
      active: formats.quote,
    },
    {
      action: 'link',
      label: 'Add link',
      icon: Link2,
      active: showLinkInput,
    },
  ];

  return (
    <div className="space-y-1.5">
      {label || hint ? (
        <div className="flex items-baseline justify-between gap-2">
          {label ? (
            <span
              id={labelId}
              onClick={focusEditor}
              className="block text-xs font-medium cursor-pointer opacity-80"
              style={{ color: 'var(--theme-text-muted, #cbd5e1)' }}
            >
              {label}
            </span>
          ) : (
            <span id={labelId} className="sr-only">
              Event description
            </span>
          )}
          {hint ? (
            <span
              className="text-xs opacity-70"
              style={{ color: 'var(--theme-text-muted, #94a3b8)' }}
            >
              {hint}
            </span>
          ) : null}
        </div>
      ) : (
        <span id={labelId} className="sr-only">
          Event description
        </span>
      )}

      <div
        className="rounded-xl border transition focus-within:ring-2"
        style={{
          backgroundColor: 'var(--theme-surface-bg, rgba(15, 23, 42, 0.7))',
          borderColor: 'var(--theme-hairline, rgba(255, 255, 255, 0.14))',
        }}
      >
        <div
          role="toolbar"
          aria-label="Description formatting"
          className="flex flex-wrap items-center gap-0.5 border-b px-2 py-1.5"
          style={{ borderColor: 'var(--theme-hairline, rgba(255, 255, 255, 0.1))' }}
        >
          {toolbarButtons.map((btn) => {
            const Icon = btn.icon;
            return (
              <button
                key={btn.action}
                type="button"
                aria-label={btn.label}
                aria-pressed={btn.active}
                title={btn.label}
                onClick={() => handleToolbarAction(btn.action)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border text-xs font-medium transition cursor-pointer"
                style={
                  btn.active
                    ? {
                        backgroundColor: 'var(--theme-accent, #34d399)',
                        borderColor: 'var(--theme-accent, #34d399)',
                        color: 'var(--theme-on-accent, #0f172a)',
                      }
                    : {
                        backgroundColor: 'transparent',
                        borderColor: 'transparent',
                        color: 'var(--theme-text-muted, #cbd5e1)',
                      }
                }
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            );
          })}
        </div>

        {showLinkInput ? (
          <div
            className="border-b p-3 space-y-2"
            style={{
              borderColor: 'var(--theme-hairline, rgba(255, 255, 255, 0.1))',
              backgroundColor: 'var(--theme-card-bg, rgba(15, 23, 42, 0.5))',
            }}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label
                  htmlFor={`${editorId}-link-text`}
                  className="block text-xs font-medium mb-1"
                  style={{ color: 'var(--theme-text-muted, #cbd5e1)' }}
                >
                  Link text
                </label>
                <input
                  id={`${editorId}-link-text`}
                  type="text"
                  value={linkText}
                  onChange={(e) => setLinkText(e.target.value)}
                  onKeyDown={handleLinkInputKeyDown}
                  placeholder="Registry or parking link"
                  className="w-full rounded-lg border px-2.5 py-1.5 text-sm outline-none"
                  style={{
                    backgroundColor: 'var(--theme-surface-bg, #0f172a)',
                    borderColor: 'var(--theme-border, rgba(255,255,255,0.16))',
                    color: 'var(--theme-text-primary, #f8fafc)',
                  }}
                />
              </div>
              <div>
                <label
                  htmlFor={`${editorId}-link-url`}
                  className="block text-xs font-medium mb-1"
                  style={{ color: 'var(--theme-text-muted, #cbd5e1)' }}
                >
                  Destination URL
                </label>
                <input
                  id={`${editorId}-link-url`}
                  type="url"
                  value={linkUrl}
                  onChange={(e) => {
                    setLinkUrl(e.target.value);
                    setLinkError(null);
                  }}
                  onKeyDown={handleLinkInputKeyDown}
                  placeholder="https://example.com"
                  className="w-full rounded-lg border px-2.5 py-1.5 text-sm outline-none"
                  style={{
                    backgroundColor: 'var(--theme-surface-bg, #0f172a)',
                    borderColor: 'var(--theme-border, rgba(255,255,255,0.16))',
                    color: 'var(--theme-text-primary, #f8fafc)',
                  }}
                />
              </div>
            </div>
            {linkError ? (
              <p className="text-xs text-rose-400" role="alert">
                {linkError}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={applyLink}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer"
                style={{
                  backgroundColor: 'var(--theme-accent, #34d399)',
                  color: 'var(--theme-on-accent, #0f172a)',
                }}
              >
                Insert Link
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLinkInput(false);
                  setLinkError(null);
                }}
                className="rounded-lg border px-3 py-1.5 text-xs font-medium transition cursor-pointer"
                style={{
                  borderColor: 'var(--theme-hairline, rgba(255,255,255,0.15))',
                  color: 'var(--theme-text-muted, #cbd5e1)',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        <div className="relative">
          {isEmpty ? (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-3.5 top-2.5 text-sm opacity-55 select-none"
              style={{ color: 'var(--theme-text-muted, #94a3b8)' }}
            >
              {placeholder}
            </div>
          ) : null}
          <div
            id={editorId}
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            role="textbox"
            aria-multiline="true"
            aria-labelledby={labelId}
            onInput={emitCurrentHtml}
            onBlur={emitCurrentHtml}
            onKeyUp={refreshActiveFormats}
            onMouseUp={refreshActiveFormats}
            onPaste={handlePaste}
            className="invite-prose min-h-[108px] max-h-[340px] overflow-y-auto resize-y px-3.5 py-2.5 text-sm leading-relaxed outline-none"
            style={{ color: 'var(--theme-text-primary, #f8fafc)' }}
          />
        </div>
      </div>
    </div>
  );
}
