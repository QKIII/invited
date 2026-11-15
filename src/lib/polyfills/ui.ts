/**
 * Progressive-enhancement polyfill loader for modern HTML UI primitives:
 * Invoker Commands (`commandfor`/`command`) and the Popover API (`popover`).
 */
export async function initModernUiPolyfills(): Promise<{
  setupDialogLightDismiss: typeof setupDialogLightDismiss;
}> {
  if (typeof window === 'undefined') {
    return { setupDialogLightDismiss };
  }

  const loads: Promise<unknown>[] = [];

  if (
    typeof HTMLButtonElement !== 'undefined' &&
    !('commandForElement' in HTMLButtonElement.prototype)
  ) {
    loads.push(import('invokers-polyfill'));
  }

  if (
    typeof HTMLElement !== 'undefined' &&
    !Object.hasOwn(HTMLElement.prototype, 'popover')
  ) {
    if (typeof globalThis.CSS === 'undefined') {
      (globalThis as { CSS?: { escape: (value: string) => string } }).CSS = {
        escape: (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, '\\$&'),
      };
    } else if (typeof globalThis.CSS.escape !== 'function') {
      globalThis.CSS.escape = (value: string) =>
        value.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
    }
    loads.push(import('@oddbird/popover-polyfill'));
  }

  if (loads.length > 0) {
    await Promise.all(loads);
  }

  return { setupDialogLightDismiss };
}

function isPointInsideRect(x: number, y: number, rect: DOMRect): boolean {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

/**
 * Attaches bounding-rect backdrop light-dismiss for modal `<dialog>` elements
 * when native `closedBy` is unsupported by the browser.
 */
export function setupDialogLightDismiss(
  dialog: HTMLDialogElement | null,
): () => void {
  if (!dialog || typeof HTMLDialogElement === 'undefined') {
    return () => {};
  }

  if ('closedBy' in HTMLDialogElement.prototype) {
    return () => {};
  }

  let pointerStartedInside = false;

  const handlePointerDown = (event: PointerEvent) => {
    if (!dialog.open) return;
    const rect = dialog.getBoundingClientRect();
    pointerStartedInside = isPointInsideRect(event.clientX, event.clientY, rect);
  };

  const handleClick = (event: MouseEvent) => {
    if (pointerStartedInside) {
      pointerStartedInside = false;
      return;
    }
    if (!dialog.open || event.target !== dialog) {
      return;
    }
    if (event.detail === 0 && event.clientX === 0 && event.clientY === 0) {
      return;
    }

    const rect = dialog.getBoundingClientRect();
    if (!isPointInsideRect(event.clientX, event.clientY, rect)) {
      dialog.close();
    }
  };

  dialog.addEventListener('pointerdown', handlePointerDown);
  dialog.addEventListener('click', handleClick);

  return () => {
    dialog.removeEventListener('pointerdown', handlePointerDown);
    dialog.removeEventListener('click', handleClick);
  };
}
