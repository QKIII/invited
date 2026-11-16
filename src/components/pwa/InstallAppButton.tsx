'use client';

import { useEffect, useRef, useState } from 'react';
import { Download } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type NavigatorWithInstall = Navigator & {
  install?: () => Promise<void>;
  standalone?: boolean;
};

export function InstallAppButton({ className = '' }: { className?: string }) {
  const [canInstall, setCanInstall] = useState(false);
  const [busy, setBusy] = useState(false);
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const supportsWebInstallRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const nav = navigator as NavigatorWithInstall;
    const isStandalone =
      (typeof window.matchMedia === 'function' &&
        window.matchMedia('(display-mode: standalone)').matches) ||
      nav.standalone === true;

    if (isStandalone) {
      return;
    }

    const supportsWebInstall = typeof nav.install === 'function';
    supportsWebInstallRef.current = supportsWebInstall;
    if (supportsWebInstall) {
      queueMicrotask(() => setCanInstall(true));
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      deferredPromptRef.current = event as BeforeInstallPromptEvent;
      if (!supportsWebInstallRef.current) {
        setCanInstall(true);
      }
    };

    const handleAppInstalled = () => {
      deferredPromptRef.current = null;
      setCanInstall(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  async function handleInstallClick() {
    if (busy) return;
    setBusy(true);
    try {
      const nav = navigator as NavigatorWithInstall;
      if (supportsWebInstallRef.current && typeof nav.install === 'function') {
        await nav.install();
        setCanInstall(false);
      } else if (deferredPromptRef.current) {
        const promptEvent = deferredPromptRef.current;
        deferredPromptRef.current = null;
        await promptEvent.prompt();
        const { outcome } = await promptEvent.userChoice;
        if (outcome === 'accepted' || !deferredPromptRef.current) {
          setCanInstall(false);
        }
      }
    } catch {
      // User dismissed or installation was cancelled
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      hidden={!canInstall}
      aria-disabled={busy ? 'true' : undefined}
      onClick={() => void handleInstallClick()}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-medium transition hover:opacity-90 cursor-pointer ${className}`.trim()}
      style={{
        backgroundColor: 'var(--theme-surface-bg)',
        borderColor: 'var(--theme-border)',
        color: 'var(--theme-text-primary)',
      }}
    >
      <Download className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>Add app</span>
    </button>
  );
}
