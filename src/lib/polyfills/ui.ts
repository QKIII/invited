/**
 * Progressive-enhancement polyfill loader & top-layer animation helpers for
 * Invoker Commands (`commandfor`/`command`), Popover (`popover`), and `<dialog>`.
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

let cachedSupportsDisplayTransition: boolean | undefined;

/**
 * Probes actual discrete `display` transition capability rather than trusting `CSS.supports()`,
 * since Firefox 129+ parses `allow-discrete` without keeping `display` visible on exit.
 */
export function canTransitionDisplay(): boolean {
  if (cachedSupportsDisplayTransition !== undefined) {
    return cachedSupportsDisplayTransition;
  }
  if (
    typeof window === 'undefined' ||
    typeof document === 'undefined' ||
    !window.CSS?.supports?.('transition-behavior', 'allow-discrete') ||
    !document.body
  ) {
    return false;
  }
  const probe = document.createElement('div');
  probe.style.cssText = 'transition: display 1s allow-discrete !important; display: block;';
  document.body.appendChild(probe);
  void getComputedStyle(probe).display;
  probe.style.display = 'none';
  cachedSupportsDisplayTransition = getComputedStyle(probe).display === 'block';
  probe.remove();
  return cachedSupportsDisplayTransition;
}

export function supportsTopLayerExit(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(window.CSS?.supports?.('overlay', 'auto')) && canTransitionDisplay();
}

/**
 * Smoothly animates a top-layer `<dialog>` or popover closed using `[data-closing]` fallback
 * whenever `overlay` + discrete `display` exit transitions are unsupported.
 */
export async function closeTopLayer(element: HTMLElement | null): Promise<void> {
  if (!element) return;

  const isDialog =
    typeof HTMLDialogElement !== 'undefined' && element instanceof HTMLDialogElement;
  const isModalOrDialogOpen = isDialog ? element.open : element.hasAttribute('open');
  let isPopoverOpen = false;
  if (element.hasAttribute('popover')) {
    try {
      isPopoverOpen = element.matches(':popover-open') || element.classList.contains(':popover-open');
    } catch {
      isPopoverOpen = element.classList.contains(':popover-open');
    }
  }

  if (!isModalOrDialogOpen && !isPopoverOpen) {
    element.removeAttribute('data-closing');
    return;
  }

  const performClose = () => {
    if (isPopoverOpen && typeof element.hidePopover === 'function') {
      try {
        element.hidePopover();
        return;
      } catch {
        // Fall through
      }
    }
    if (isDialog && typeof element.close === 'function') {
      if (element.open) element.close();
      return;
    }
    element.removeAttribute('open');
  };

  if (typeof element.getAnimations !== 'function') {
    performClose();
    element.removeAttribute('data-closing');
    return;
  }

  if (!supportsTopLayerExit()) {
    element.setAttribute('data-closing', '');
    const animations = element.getAnimations({ subtree: true });
    if (animations.length > 0) {
      await Promise.race([
        Promise.allSettled(animations.map((a) => a.finished)),
        new Promise((resolve) => setTimeout(resolve, 420)),
      ]);
    }
    if (!element.hasAttribute('data-closing')) return;
    element.removeAttribute('data-closing');
  }

  performClose();
}

/**
 * Attaches bounding-rect backdrop light-dismiss + animated cancel interception for modal `<dialog>` elements.
 */
export function setupDialogLightDismiss(
  dialog: HTMLDialogElement | null,
): () => void {
  if (!dialog || typeof HTMLDialogElement === 'undefined') {
    return () => {};
  }

  const handleCancel = (event: Event) => {
    event.preventDefault();
    void closeTopLayer(dialog);
  };
  dialog.addEventListener('cancel', handleCancel);

  if ('closedBy' in HTMLDialogElement.prototype) {
    return () => {
      dialog.removeEventListener('cancel', handleCancel);
    };
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
      void closeTopLayer(dialog);
    }
  };

  dialog.addEventListener('pointerdown', handlePointerDown);
  dialog.addEventListener('click', handleClick);

  return () => {
    dialog.removeEventListener('cancel', handleCancel);
    dialog.removeEventListener('pointerdown', handlePointerDown);
    dialog.removeEventListener('click', handleClick);
  };
}
