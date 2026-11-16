'use client';

import { useEffect } from 'react';

/**
 * Keeps root html/body background colors, color-scheme, and <meta name="theme-color">
 * aligned with the active invite theme so mobile pull-down rubber-banding and
 * installed PWA chrome never reveal mismatched background colors.
 */
export function useThemeViewportSync(
  pageBg: string | undefined,
  backdropMode: 'light' | 'dark',
): void {
  useEffect(() => {
    if (typeof document === 'undefined' || !pageBg) return;

    const root = document.documentElement;
    root.style.setProperty('--app-bg', pageBg);
    root.style.backgroundColor = pageBg;
    root.style.colorScheme = backdropMode;
    document.body.style.backgroundColor = pageBg;

    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = pageBg;
  }, [pageBg, backdropMode]);
}
