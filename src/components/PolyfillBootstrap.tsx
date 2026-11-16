'use client';

import { useEffect } from 'react';
import { initModernUiPolyfills } from '@/lib/polyfills/ui';

export function PolyfillBootstrap() {
  useEffect(() => {
    void initModernUiPolyfills();

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
  }, []);

  return null;
}
