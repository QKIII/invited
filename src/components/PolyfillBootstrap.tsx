'use client';

import { useEffect } from 'react';
import { initModernUiPolyfills } from '@/lib/polyfills/ui';

export function PolyfillBootstrap() {
  useEffect(() => {
    void initModernUiPolyfills();
  }, []);

  return null;
}
