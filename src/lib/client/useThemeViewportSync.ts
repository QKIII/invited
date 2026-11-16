'use client';

import { useEffect } from 'react';

/**
 * Keeps root html/body background colors and color-scheme aligned with the active invite
 * theme so mobile pull-down rubber-banding and Safari's full-bleed Liquid Glass edge bars
 * extend seamlessly over the live backdrop without a solid theme-color cap.
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

    // Remove static theme-color meta so Safari extends the live canvas behind top & bottom bars
    document.querySelector('meta[name="theme-color"]')?.remove();
  }, [pageBg, backdropMode]);
}
