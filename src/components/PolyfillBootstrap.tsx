'use client';

import { useEffect } from 'react';
import { initModernUiPolyfills } from '@/lib/polyfills/ui';

export function PolyfillBootstrap() {
  useEffect(() => {
    void initModernUiPolyfills();

    const preventPinch = (e: Event) => {
      e.preventDefault();
    };
    const preventMultiTouch = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };

    document.addEventListener('gesturestart', preventPinch, { passive: false });
    document.addEventListener('gesturechange', preventPinch, { passive: false });
    document.addEventListener('touchmove', preventMultiTouch, { passive: false });

    if (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      window.location.protocol !== 'file:'
    ) {
      const registerSw = () => {
        navigator.serviceWorker.register('/sw.js').catch(() => {});
      };
      if (document.readyState === 'complete') {
        registerSw();
      } else {
        window.addEventListener('load', registerSw, { once: true });
      }
    }

    return () => {
      document.removeEventListener('gesturestart', preventPinch);
      document.removeEventListener('gesturechange', preventPinch);
      document.removeEventListener('touchmove', preventMultiTouch);
    };
  }, []);

  return null;
}
