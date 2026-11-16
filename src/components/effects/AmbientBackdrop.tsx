'use client';

import React, { useEffect, useRef } from 'react';
import type { AmbientEffectId } from '@/types/invite';
import styles from './AmbientBackdrop.module.css';
import {
  initWebGLBackdrop,
  shouldUse2DParticleLayer,
  type WebGLBackdropController,
} from './webglBackdrop';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  phase: number;
  rotation: number;
  vRot: number;
  color: string;
  shape:
    | 'circle'
    | 'star'
    | 'crystal'
    | 'leaf'
    | 'petal'
    | 'heart'
    | 'confetti'
    | 'bat'
    | 'bokeh'
    | 'lantern'
    | 'raindrop';
}

interface FireworkSpark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface ShootingStar {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
}

interface ParticleLayer {
  effectId: AmbientEffectId;
  palette: string[];
  particles: Particle[];
  sparks: FireworkSpark[];
  shootingStar: ShootingStar | null;
  fade: number;
  tick: number;
  lastBurst: number;
  lastShootingStar: number;
}

interface ParticleLayerController {
  updateLayer: (next: {
    effectId: AmbientEffectId;
    accent: string;
    isLight: boolean;
  }) => void;
}

const POSITION_RE = /\b(?:fixed|absolute|relative|sticky|static)\b/;

function isStaticEffect(effectId: AmbientEffectId): boolean {
  return (
    effectId === 'none' ||
    effectId === 'static-glow' ||
    effectId === 'static-grain' ||
    effectId === 'static-linen' ||
    effectId === 'static-watercolor'
  );
}

function getPalette(effectId: AmbientEffectId, accentColor?: string, isLight?: boolean): string[] {
  const accent = accentColor || '#34d399';
  switch (effectId) {
    case 'snowfall':
      return isLight ? ['#93c5fd', '#bae6fd', '#60a5fa'] : ['#ffffff', '#e0f2fe', '#bae6fd'];
    case 'rain-glass':
      return isLight
        ? ['#64748b', '#94a3b8', '#38bdf8', accent]
        : ['#bae6fd', '#7dd3fc', '#94a3b8', accent];
    case 'prism-gradient':
    case 'liquid-chrome':
    case 'cyber-grid':
    case 'stained-glass':
    case 'disco-prism':
      return isLight
        ? ['#ffffff', accent, '#38bdf8', '#f472b6']
        : ['#ffffff', '#e0f2fe', accent, '#fde68a'];
    case 'christmas-lights':
      return ['#fde68a', '#fb7185', '#6ee7b7', '#ffffff'];
    case 'starlight-radiance':
    case 'shooting-stars':
      return ['#fde68a', '#f5c451', '#fef3c7', '#ffffff'];
    case 'fireflies':
      return ['#fde047', '#bef264', '#fcd34d', '#d9f99d'];
    case 'paper-lanterns':
      return ['#fb923c', '#f59e0b', '#fb7185', '#fde68a'];
    case 'halloween-bats':
      return isLight ? ['#3b0764', '#581c87', '#c2410c'] : ['#1f102e', '#2e1065', '#fb923c'];
    case 'autumn-leaves':
      return ['#f59e0b', '#ea580c', '#dc2626', '#d97706', '#fbbf24'];
    case 'fireworks':
      return ['#ff6b7a', '#fde047', '#60a5fa', '#ffffff', accent];
    case 'confetti':
      return ['#fb7185', '#fbbf24', '#34d399', '#60a5fa', '#c084fc', accent];
    case 'botanical-petals':
      return isLight
        ? ['#f9a8d4', '#fbcfe8', '#a7f3d0', '#fda4af']
        : ['#fbcfe8', '#fce7f3', '#fda4af', '#d9f99d'];
    case 'lullaby-stars':
      return isLight
        ? ['#60a5fa', '#f59e0b', '#93c5fd', '#fbbf24']
        : ['#fef08a', '#bae6fd', '#ffffff', '#fde68a'];
    case 'floating-hearts':
      return ['#fb7185', '#f43f5e', '#fda4af', '#f472b6'];
    case 'champagne-sparkle':
      return ['#fde68a', '#f4ce6a', '#fef9c3', '#ffffff'];
    case 'warm-bokeh':
      return ['#fbbf24', '#f97316', '#fb7185', '#fde68a', accent];
    case 'aurora':
      return ['#a7f3d0', '#bae6fd', '#e9d5ff', '#ffffff'];
    default:
      return [accent];
  }
}

function drawFourPointStar(ctx: CanvasRenderingContext2D, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4;
    const rad = i % 2 === 0 ? r : r * 0.32;
    const px = Math.cos(angle) * rad;
    const py = Math.sin(angle) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

function drawSnowflakeCrystal(ctx: CanvasRenderingContext2D, r: number, color: string) {
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(0.9, r * 0.18);
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    ctx.moveTo(0, 0);
    ctx.lineTo(cos * r, sin * r);
    const bx = cos * r * 0.62;
    const by = sin * r * 0.62;
    const twig = r * 0.28;
    ctx.moveTo(bx, by);
    ctx.lineTo(bx + Math.cos(angle - 0.6) * twig, by + Math.sin(angle - 0.6) * twig);
    ctx.moveTo(bx, by);
    ctx.lineTo(bx + Math.cos(angle + 0.6) * twig, by + Math.sin(angle + 0.6) * twig);
  }
  ctx.stroke();
}

function drawHeart(ctx: CanvasRenderingContext2D, r: number) {
  ctx.beginPath();
  const s = r * 0.6;
  ctx.moveTo(0, s);
  ctx.bezierCurveTo(-s * 1.6, -s * 0.2, -s * 1.2, -s * 1.6, 0, -s * 0.7);
  ctx.bezierCurveTo(s * 1.2, -s * 1.6, s * 1.6, -s * 0.2, 0, s);
  ctx.closePath();
  ctx.fill();
}

function drawLeaf(ctx: CanvasRenderingContext2D, r: number) {
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.bezierCurveTo(r * 0.9, -r * 0.5, r * 0.9, r * 0.5, 0, r);
  ctx.bezierCurveTo(-r * 0.9, r * 0.5, -r * 0.9, -r * 0.5, 0, -r);
  ctx.closePath();
  ctx.fill();
}

function drawBat(ctx: CanvasRenderingContext2D, r: number, wingFlap: number) {
  const flapY = Math.sin(wingFlap) * r * 0.55;
  ctx.beginPath();
  ctx.moveTo(0, r * 0.25);
  ctx.quadraticCurveTo(-r * 0.5, -r * 0.5 + flapY, -r * 1.35, -r * 0.15 + flapY);
  ctx.quadraticCurveTo(-r * 0.8, r * 0.35, -r * 0.35, r * 0.22);
  ctx.lineTo(0, r * 0.5);
  ctx.lineTo(r * 0.35, r * 0.22);
  ctx.quadraticCurveTo(r * 0.8, r * 0.35, r * 1.35, -r * 0.15 + flapY);
  ctx.quadraticCurveTo(r * 0.5, -r * 0.5 + flapY, 0, r * 0.25);
  ctx.closePath();
  ctx.fill();
}

function createParticles(
  effectId: AmbientEffectId,
  width: number,
  height: number,
  palette: string[],
): Particle[] {
  const rand = (min: number, max: number) => min + Math.random() * (max - min);
  const pick = () => palette[Math.floor(Math.random() * palette.length)];

  const countByEffect: Partial<Record<AmbientEffectId, number>> = {
    snowfall: 68,
    'rain-glass': 64,
    'prism-gradient': 20,
    'liquid-chrome': 18,
    'cyber-grid': 16,
    'christmas-lights': 42,
    'starlight-radiance': 46,
    'halloween-bats': 16,
    'autumn-leaves': 28,
    confetti: 48,
    'botanical-petals': 36,
    'lullaby-stars': 44,
    'floating-hearts': 28,
    'champagne-sparkle': 54,
    'warm-bokeh': 26,
    aurora: 30,
    fireflies: 34,
    'shooting-stars': 36,
    'paper-lanterns': 18,
  };

  const count = countByEffect[effectId] ?? 0;
  const particles: Particle[] = [];

  for (let i = 0; i < count; i++) {
    if (effectId === 'fireflies') {
      const isGlow = i % 3 === 0;
      particles.push({
        x: rand(0, width),
        y: rand(height * 0.25, height * 0.95),
        vx: rand(-0.22, 0.22),
        vy: rand(-0.26, 0.08),
        size: isGlow ? rand(10, 22) : rand(2, 4),
        alpha: isGlow ? rand(0.14, 0.28) : rand(0.45, 0.92),
        phase: rand(0, Math.PI * 2),
        rotation: 0,
        vRot: 0,
        color: pick(),
        shape: isGlow ? 'bokeh' : 'circle',
      });
    } else if (effectId === 'paper-lanterns') {
      particles.push({
        x: rand(width * 0.06, width * 0.94),
        y: rand(0, height),
        vx: rand(-0.1, 0.14),
        vy: rand(-0.48, -0.18),
        size: rand(7, 13),
        alpha: rand(0.48, 0.85),
        phase: rand(0, Math.PI * 2),
        rotation: rand(-0.08, 0.08),
        vRot: 0,
        color: pick(),
        shape: 'lantern',
      });
    } else if (effectId === 'shooting-stars') {
      particles.push({
        x: rand(0, width),
        y: rand(0, height),
        vx: rand(-0.05, 0.05),
        vy: rand(-0.04, 0.04),
        size: rand(1.6, 3.8),
        alpha: rand(0.32, 0.85),
        phase: rand(0, Math.PI * 2),
        rotation: 0,
        vRot: 0,
        color: pick(),
        shape: i % 3 === 0 ? 'star' : 'circle',
      });
    } else if (effectId === 'rain-glass') {
      const isDropletOrb = i % 6 === 0;
      particles.push({
        x: rand(0, width),
        y: rand(0, height),
        vx: isDropletOrb ? rand(-0.08, 0.08) : rand(-0.35, -0.15),
        vy: isDropletOrb ? rand(0.15, 0.45) : rand(3.6, 6.4),
        size: isDropletOrb ? rand(10, 26) : rand(10, 20),
        alpha: isDropletOrb ? rand(0.08, 0.18) : rand(0.16, 0.38),
        phase: rand(0, Math.PI * 2),
        rotation: 0.14,
        vRot: 0,
        color: pick(),
        shape: isDropletOrb ? 'bokeh' : 'raindrop',
      });
    } else if (effectId === 'prism-gradient' || effectId === 'liquid-chrome' || effectId === 'cyber-grid') {
      const isSoftOrb = i % 3 === 0;
      particles.push({
        x: rand(0, width),
        y: rand(0, height),
        vx: rand(-0.14, 0.14),
        vy: rand(-0.22, -0.05),
        size: isSoftOrb ? rand(18, 42) : rand(1.8, 3.8),
        alpha: isSoftOrb ? rand(0.06, 0.14) : rand(0.28, 0.62),
        phase: rand(0, Math.PI * 2),
        rotation: 0,
        vRot: 0,
        color: pick(),
        shape: isSoftOrb ? 'bokeh' : 'star',
      });
    } else if (effectId === 'halloween-bats') {
      particles.push({
        x: rand(0, width),
        y: rand(height * 0.06, height * 0.55),
        vx: rand(0.45, 1.15) * (i % 2 === 0 ? 1 : -1),
        vy: rand(-0.12, 0.12),
        size: rand(8, 15),
        alpha: rand(0.45, 0.78),
        phase: rand(0, Math.PI * 2),
        rotation: 0,
        vRot: rand(0.12, 0.22),
        color: i % 5 === 0 ? '#fb923c' : '#12081c',
        shape: 'bat',
      });
    } else if (effectId === 'warm-bokeh') {
      const isFineMote = i % 3 === 0;
      particles.push({
        x: rand(0, width),
        y: rand(0, height),
        vx: rand(-0.18, 0.18),
        vy: isFineMote ? rand(-0.42, -0.15) : rand(-0.2, -0.04),
        size: isFineMote ? rand(1.8, 3.6) : rand(20, 62),
        alpha: isFineMote ? rand(0.35, 0.72) : rand(0.08, 0.22),
        phase: rand(0, Math.PI * 2),
        rotation: 0,
        vRot: 0,
        color: pick(),
        shape: isFineMote ? 'star' : 'bokeh',
      });
    } else if (
      effectId === 'floating-hearts' ||
      effectId === 'champagne-sparkle' ||
      effectId === 'starlight-radiance'
    ) {
      particles.push({
        x: rand(0, width),
        y: rand(0, height),
        vx: rand(-0.22, 0.22),
        vy: effectId === 'champagne-sparkle' ? rand(-1.05, -0.35) : rand(-0.5, -0.16),
        size:
          effectId === 'floating-hearts'
            ? rand(5, 10)
            : effectId === 'starlight-radiance'
              ? rand(2.5, 6.2)
              : rand(1.8, 4.5),
        alpha: rand(0.32, 0.82),
        phase: rand(0, Math.PI * 2),
        rotation: rand(-0.3, 0.3),
        vRot: rand(-0.01, 0.01),
        color: pick(),
        shape:
          effectId === 'floating-hearts'
            ? 'heart'
            : effectId === 'starlight-radiance'
              ? i % 3 === 0
                ? 'star'
                : 'circle'
              : i % 4 === 0
                ? 'star'
                : 'circle',
      });
    } else if (effectId === 'christmas-lights') {
      const isBokehGlow = i % 4 === 0;
      particles.push({
        x: rand(0, width),
        y: rand(0, height),
        vx: rand(-0.1, 0.1),
        vy: rand(-0.16, 0.08),
        size: isBokehGlow ? rand(16, 36) : rand(2, 4.5),
        alpha: isBokehGlow ? rand(0.08, 0.18) : rand(0.28, 0.78),
        phase: rand(0, Math.PI * 2),
        rotation: 0,
        vRot: 0,
        color: pick(),
        shape: isBokehGlow ? 'bokeh' : i % 2 === 0 ? 'star' : 'circle',
      });
    } else if (effectId === 'lullaby-stars' || effectId === 'aurora') {
      particles.push({
        x: rand(0, width),
        y: rand(0, height),
        vx: rand(-0.06, 0.06),
        vy: rand(-0.08, 0.04),
        size: rand(2, 5.4),
        alpha: rand(0.28, 0.82),
        phase: rand(0, Math.PI * 2),
        rotation: 0,
        vRot: 0,
        color: pick(),
        shape: i % 2 === 0 ? 'star' : 'circle',
      });
    } else if (effectId === 'autumn-leaves' || effectId === 'botanical-petals') {
      particles.push({
        x: rand(0, width),
        y: rand(0, height),
        vx: rand(-0.35, 0.45),
        vy: rand(0.38, 0.95),
        size: effectId === 'autumn-leaves' ? rand(6, 11) : rand(4.5, 8.5),
        alpha: rand(0.45, 0.85),
        phase: rand(0, Math.PI * 2),
        rotation: rand(0, Math.PI * 2),
        vRot: rand(-0.025, 0.025),
        color: pick(),
        shape: effectId === 'autumn-leaves' ? 'leaf' : 'petal',
      });
    } else if (effectId === 'confetti') {
      particles.push({
        x: rand(0, width),
        y: rand(0, height),
        vx: rand(-0.4, 0.4),
        vy: rand(0.55, 1.35),
        size: rand(4, 7.5),
        alpha: rand(0.55, 0.92),
        phase: rand(0, Math.PI * 2),
        rotation: rand(0, Math.PI * 2),
        vRot: rand(-0.05, 0.05),
        color: pick(),
        shape: 'confetti',
      });
    } else {
      const mod = i % 7;
      const shape: Particle['shape'] =
        mod === 0 ? 'bokeh' : mod === 3 ? 'crystal' : 'circle';
      particles.push({
        x: rand(0, width),
        y: rand(0, height),
        vx: rand(-0.18, 0.22),
        vy:
          shape === 'bokeh'
            ? rand(0.18, 0.48)
            : shape === 'crystal'
              ? rand(0.38, 0.85)
              : rand(0.42, 1.15),
        size:
          shape === 'bokeh'
            ? rand(12, 28)
            : shape === 'crystal'
              ? rand(4.5, 7.5)
              : rand(1.5, 4.0),
        alpha:
          shape === 'bokeh'
            ? rand(0.08, 0.2)
            : shape === 'crystal'
              ? rand(0.42, 0.78)
              : rand(0.3, 0.72),
        phase: rand(0, Math.PI * 2),
        rotation: rand(0, Math.PI),
        vRot: shape === 'crystal' ? rand(-0.012, 0.012) : 0,
        color: pick(),
        shape,
      });
    }
  }

  return particles;
}

const STRING_LIGHT_BULBS = Array.from({ length: 14 }, (_, idx) => {
  const x = 35 + idx * 72;
  const sag = Math.sin((idx / 13) * Math.PI) * 18;
  const y = 16 + sag;
  const colors = ['#fb7185', '#fbbf24', '#34d399', '#60a5fa'];
  return { x, y, color: colors[idx % colors.length], even: idx % 2 === 0 };
});

export function AmbientBackdrop({
  effectId,
  pageBg,
  accentColor,
  secondaryColor,
  colorMode = 'dark',
  fixedViewport = false,
  turbulence = 0,
  className = '',
}: {
  effectId: AmbientEffectId;
  pageBg?: string;
  accentColor?: string;
  secondaryColor?: string;
  colorMode?: 'dark' | 'light';
  fixedViewport?: boolean;
  turbulence?: number;
  className?: string;
}): React.JSX.Element {
  const webglCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const webglControllerRef = useRef<WebGLBackdropController | null>(null);
  const particleControllerRef = useRef<ParticleLayerController | null>(null);
  const latestParticlePropsRef = useRef<{
    effectId: AmbientEffectId;
    accent: string;
    isLight: boolean;
  }>({
    effectId,
    accent: accentColor || (colorMode === 'light' ? '#2c6b4a' : '#34d399'),
    isLight: colorMode === 'light',
  });

  const isLight = colorMode === 'light';
  const accent = accentColor || (isLight ? '#2c6b4a' : '#34d399');
  const secondary = secondaryColor || accent;
  const resolvedPageBg = pageBg || (isLight ? '#f4f6f9' : '#08152d');
  const staticMode = isStaticEffect(effectId);

  // Persistent GPU WebGL shader layer across all animated effect switches (avoids shader recompilation hitch)
  useEffect(() => {
    const glCanvas = webglCanvasRef.current;
    if (!glCanvas || staticMode) {
      webglControllerRef.current?.destroy();
      webglControllerRef.current = null;
      return;
    }

    const mediaQuery =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null;

    let reducedMotion = mediaQuery?.matches ?? false;
    let isDocumentHidden = typeof document !== 'undefined' ? document.hidden : false;
    let width = glCanvas.parentElement?.clientWidth || window.innerWidth || 960;
    let height = glCanvas.parentElement?.clientHeight || window.innerHeight || 640;

    if (!webglControllerRef.current) {
      const controller = initWebGLBackdrop(glCanvas, {
        bgHex: resolvedPageBg,
        accentHex: accent,
        secondaryHex: secondary,
        isLight,
        effectId,
        reducedMotion,
        turbulence,
      });
      webglControllerRef.current = controller;
      controller?.resize(width, height);
    } else {
      webglControllerRef.current.updateParams({
        bgHex: resolvedPageBg,
        accentHex: accent,
        secondaryHex: secondary,
        isLight,
        effectId,
        reducedMotion,
        turbulence,
      });
    }

    const controller = webglControllerRef.current;
    if (!controller) return;

    const handleResize = () => {
      const nextWidth = glCanvas.parentElement?.clientWidth || window.innerWidth || 960;
      const nextHeight = glCanvas.parentElement?.clientHeight || window.innerHeight || 640;
      if (Math.abs(nextWidth - width) < 2 && Math.abs(nextHeight - height) < 140) {
        return;
      }
      width = Math.max(1, nextWidth);
      height = Math.max(1, nextHeight);
      controller.resize(width, height);
    };

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && glCanvas.parentElement) {
      ro = new ResizeObserver(handleResize);
      ro.observe(glCanvas.parentElement);
    } else {
      window.addEventListener('resize', handleResize);
    }

    const handleVisibility = () => {
      isDocumentHidden = document.hidden;
      if (isDocumentHidden) controller.pause();
      else controller.resume();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    const handleMotion = (e: MediaQueryListEvent) => {
      reducedMotion = e.matches;
      controller.updateParams({
        bgHex: resolvedPageBg,
        accentHex: accent,
        secondaryHex: secondary,
        isLight,
        effectId,
        reducedMotion,
        turbulence,
      });
    };
    mediaQuery?.addEventListener('change', onMotion);

    function onMotion(e: MediaQueryListEvent) {
      handleMotion(e);
    }

    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibility);
      mediaQuery?.removeEventListener('change', onMotion);
    };
  }, [effectId, resolvedPageBg, accent, secondary, isLight, staticMode, turbulence]);

  useEffect(() => {
    return () => {
      webglControllerRef.current?.destroy();
      webglControllerRef.current = null;
    };
  }, []);

  // Keep latest particle layer props synced and dissolve smoothly across effectId/theme swaps
  useEffect(() => {
    latestParticlePropsRef.current = { effectId, accent, isLight };
    if (!staticMode) {
      particleControllerRef.current?.updateLayer({ effectId, accent, isLight });
    }
  }, [effectId, accent, isLight, staticMode]);

  // Persistent 2D particle canvas across theme/effect swaps so old & new particles cross-dissolve smoothly
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || staticMode) {
      particleControllerRef.current = null;
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      particleControllerRef.current = null;
      return;
    }

    const mediaQuery =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null;

    let reducedMotion = mediaQuery?.matches ?? false;
    let isDocumentHidden = typeof document !== 'undefined' ? document.hidden : false;
    let initialized = false;
    let width = canvas.clientWidth || 960;
    let height = canvas.clientHeight || 640;
    let rafId = 0;

    const createEmptyLayer = (
      nextEffectId: AmbientEffectId,
      palette: string[],
      fade: number,
    ): ParticleLayer => ({
      effectId: nextEffectId,
      palette,
      particles: [],
      sparks: [],
      shootingStar: null,
      fade,
      tick: 0,
      lastBurst: 0,
      lastShootingStar: 0,
    });

    const initialProps = latestParticlePropsRef.current;
    const initialNeedsParticles =
      shouldUse2DParticleLayer(initialProps.effectId) || webglControllerRef.current === null;
    const initialPalette = getPalette(
      initialProps.effectId,
      initialProps.accent,
      initialProps.isLight,
    );

    let activeLayer: ParticleLayer = createEmptyLayer(
      initialProps.effectId,
      initialPalette,
      1,
    );
    let outgoingLayer: ParticleLayer | null = null;

    const spawnFireworkBurst = (layer: ParticleLayer, cx: number, cy: number) => {
      const burstColor = layer.palette[Math.floor(Math.random() * layer.palette.length)];
      const secondaryBurst = layer.palette[Math.floor(Math.random() * layer.palette.length)];
      const count = 28;
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.2;
        const speed = 1.1 + Math.random() * 2.2;
        layer.sparks.push({
          x: cx,
          y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0,
          maxLife: 48 + Math.random() * 24,
          color: i % 3 === 0 ? secondaryBurst : burstColor,
          size: 1.6 + Math.random() * 1.7,
        });
      }
    };

    const populateLayer = (layer: ParticleLayer, needsParticles: boolean) => {
      if (!needsParticles) {
        layer.particles = [];
        return;
      }
      layer.particles = createParticles(layer.effectId, width, height, layer.palette);
      if (layer.effectId === 'fireworks' && layer.sparks.length === 0) {
        spawnFireworkBurst(layer, width * 0.25, height * 0.26);
        spawnFireworkBurst(layer, width * 0.74, height * 0.22);
      }
    };

    const resize = (force = false) => {
      const parent = canvas.parentElement;
      const nextWidth = parent?.clientWidth || window.innerWidth || 960;
      const nextHeight = parent?.clientHeight || window.innerHeight || 640;

      if (
        initialized &&
        !force &&
        Math.abs(nextWidth - width) < 2 &&
        Math.abs(nextHeight - height) < 140
      ) {
        return;
      }

      const prevWidth = width;
      const prevHeight = height;
      width = Math.max(1, nextWidth);
      height = Math.max(1, nextHeight);

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const needsParticles =
        shouldUse2DParticleLayer(activeLayer.effectId) || webglControllerRef.current === null;

      if (!initialized) {
        populateLayer(activeLayer, needsParticles);
        initialized = true;
      } else if (prevWidth > 0 && prevHeight > 0) {
        for (const p of activeLayer.particles) {
          p.x = (p.x / prevWidth) * width;
          p.y = (p.y / prevHeight) * height;
        }
        if (outgoingLayer) {
          for (const p of outgoingLayer.particles) {
            p.x = (p.x / prevWidth) * width;
            p.y = (p.y / prevHeight) * height;
          }
        }
      }
    };

    const drawParticle = (p: Particle, timeTick: number, layerEffectId: AmbientEffectId, layerFade: number) => {
      ctx.save();
      const twinkle =
        p.shape === 'star' ||
        layerEffectId === 'lullaby-stars' ||
        layerEffectId === 'aurora' ||
        layerEffectId === 'fireflies' ||
        layerEffectId === 'shooting-stars' ||
        layerEffectId === 'christmas-lights'
          ? 0.48 + 0.52 * Math.sin(timeTick * 0.045 + p.phase)
          : 1;
      ctx.globalAlpha = Math.max(0.01, Math.min(1, p.alpha * twinkle)) * layerFade;
      ctx.fillStyle = p.color;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);

      switch (p.shape) {
        case 'star':
          drawFourPointStar(ctx, p.size);
          break;
        case 'lantern': {
          const w = p.size * 1.1;
          const h = p.size * 1.45;
          const aura = ctx.createRadialGradient(0, 0, p.size * 0.2, 0, 0, p.size * 2.2);
          aura.addColorStop(0, p.color);
          aura.addColorStop(1, 'transparent');
          ctx.fillStyle = aura;
          ctx.beginPath();
          ctx.arc(0, 0, p.size * 2.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.roundRect(-w * 0.5, -h * 0.5, w, h, w * 0.35);
          ctx.fill();
          ctx.fillStyle = '#fef9c3';
          ctx.beginPath();
          ctx.arc(0, h * 0.22, p.size * 0.24, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case 'crystal':
          drawSnowflakeCrystal(ctx, p.size, p.color);
          break;
        case 'raindrop':
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 1.25;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(0, -p.size * 0.5);
          ctx.lineTo(0, p.size * 0.5);
          ctx.stroke();
          break;
        case 'heart':
          drawHeart(ctx, p.size);
          break;
        case 'leaf':
          drawLeaf(ctx, p.size);
          break;
        case 'petal':
          ctx.beginPath();
          ctx.ellipse(0, 0, p.size * 0.55, p.size, 0.35, 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'confetti':
          ctx.scale(1, Math.cos(timeTick * 0.07 + p.phase));
          ctx.fillRect(-p.size * 0.55, -p.size * 0.35, p.size * 1.1, p.size * 0.7);
          break;
        case 'bat':
          drawBat(ctx, p.size, p.phase + timeTick * p.vRot);
          break;
        case 'bokeh': {
          const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size);
          grad.addColorStop(0, p.color);
          grad.addColorStop(0.65, p.color);
          grad.addColorStop(1, 'transparent');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case 'circle':
        default:
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.fill();
          break;
      }

      ctx.restore();
    };

    const stepLayer = (layer: ParticleLayer, animate: boolean, isOutgoing: boolean) => {
      if (layer.fade <= 0.004) return;
      layer.tick += 1;

      if (
        layer.effectId === 'starlight-radiance' ||
        layer.effectId === 'lullaby-stars' ||
        layer.effectId === 'shooting-stars'
      ) {
        const starCadence = layer.effectId === 'shooting-stars' ? 75 : 220;
        if (animate && !isOutgoing && !layer.shootingStar && layer.tick - layer.lastShootingStar > starCadence) {
          layer.lastShootingStar = layer.tick;
          layer.shootingStar = {
            x: width * (0.12 + Math.random() * 0.65),
            y: height * (0.06 + Math.random() * 0.28),
            vx: layer.effectId === 'shooting-stars' ? 8.2 : 6.5,
            vy: layer.effectId === 'shooting-stars' ? 3.4 : 2.6,
            life: 0,
            maxLife: 34,
            color: layer.effectId === 'starlight-radiance' ? '#fef3c7' : '#e0f2fe',
          };
        }
        if (layer.shootingStar) {
          if (animate) {
            layer.shootingStar.x += layer.shootingStar.vx;
            layer.shootingStar.y += layer.shootingStar.vy;
            layer.shootingStar.life += 1;
          }
          const progress = layer.shootingStar.life / layer.shootingStar.maxLife;
          if (progress >= 1) {
            layer.shootingStar = null;
          } else {
            const alpha = Math.sin(progress * Math.PI) * 0.72 * layer.fade;
            ctx.save();
            ctx.globalAlpha = Math.max(0, alpha);
            const tailGrad = ctx.createLinearGradient(
              layer.shootingStar.x - layer.shootingStar.vx * 7,
              layer.shootingStar.y - layer.shootingStar.vy * 7,
              layer.shootingStar.x,
              layer.shootingStar.y,
            );
            tailGrad.addColorStop(0, 'transparent');
            tailGrad.addColorStop(1, layer.shootingStar.color);
            ctx.strokeStyle = tailGrad;
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.moveTo(
              layer.shootingStar.x - layer.shootingStar.vx * 7,
              layer.shootingStar.y - layer.shootingStar.vy * 7,
            );
            ctx.lineTo(layer.shootingStar.x, layer.shootingStar.y);
            ctx.stroke();
            ctx.restore();
          }
        }
      }

      if (layer.effectId === 'fireworks') {
        if (animate && !isOutgoing && layer.tick - layer.lastBurst > 58) {
          layer.lastBurst = layer.tick;
          spawnFireworkBurst(
            layer,
            width * (0.18 + Math.random() * 0.64),
            height * (0.14 + Math.random() * 0.38),
          );
        }
        const nextSparks: FireworkSpark[] = [];
        for (const s of layer.sparks) {
          if (animate) {
            s.x += s.vx;
            s.y += s.vy;
            s.vy += 0.025;
            s.vx *= 0.985;
            s.life += 1;
          }
          const progress = s.life / s.maxLife;
          if (progress < 1) {
            ctx.save();
            ctx.globalAlpha = Math.max(0, (1 - progress) * 0.85 * layer.fade);
            ctx.fillStyle = s.color;
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            nextSparks.push(s);
          }
        }
        layer.sparks = nextSparks;
      }

      for (const p of layer.particles) {
        if (animate) {
          const sway =
            layer.effectId === 'snowfall' ||
            layer.effectId === 'botanical-petals' ||
            layer.effectId === 'autumn-leaves'
              ? Math.sin(layer.tick * 0.02 + p.phase) * 0.35
              : 0;
          p.x += p.vx + sway;
          p.y += p.vy;
          p.rotation += p.vRot;

          if (p.y > height + 36) {
            p.y = -28;
            p.x = Math.random() * width;
          } else if (p.y < -36) {
            p.y = height + 28;
            p.x = Math.random() * width;
          }
          if (p.x > width + 36) {
            p.x = -28;
          } else if (p.x < -36) {
            p.x = width + 28;
          }
        }
        drawParticle(p, layer.tick, layer.effectId, layer.fade);
      }
    };

    const layerNeedsFrames = (layer: ParticleLayer): boolean =>
      layer.particles.length > 0 ||
      layer.sparks.length > 0 ||
      layer.effectId === 'fireworks' ||
      layer.effectId === 'starlight-radiance' ||
      layer.effectId === 'lullaby-stars' ||
      layer.effectId === 'shooting-stars';

    const renderFrame = (animate: boolean) => {
      if (animate && isDocumentHidden) {
        rafId = 0;
        return;
      }

      ctx.clearRect(0, 0, width, height);

      if (outgoingLayer) {
        if (animate) {
          outgoingLayer.fade = reducedMotion ? 0 : Math.max(0, outgoingLayer.fade - 1 / 46);
        }
        stepLayer(outgoingLayer, animate, true);
        if (outgoingLayer.fade <= 0.005) {
          outgoingLayer = null;
        }
      }

      const activeHasWork = layerNeedsFrames(activeLayer);
      if (activeHasWork) {
        if (animate && activeLayer.fade < 1) {
          activeLayer.fade = reducedMotion ? 1 : Math.min(1, activeLayer.fade + 1 / 54);
        }
        stepLayer(activeLayer, animate, false);
      }

      const shouldContinue = Boolean(outgoingLayer) || activeHasWork;
      if (animate && !isDocumentHidden && shouldContinue) {
        rafId = window.requestAnimationFrame(() => renderFrame(true));
      } else {
        rafId = 0;
      }
    };

    const startOrResume = () => {
      window.cancelAnimationFrame(rafId);
      rafId = 0;
      if (reducedMotion) {
        renderFrame(false);
      } else if (!isDocumentHidden && (Boolean(outgoingLayer) || layerNeedsFrames(activeLayer))) {
        rafId = window.requestAnimationFrame(() => renderFrame(true));
      } else {
        ctx.clearRect(0, 0, width, height);
      }
    };

    particleControllerRef.current = {
      updateLayer: (next) => {
        const nextPalette = getPalette(next.effectId, next.accent, next.isLight);
        const needsParticles =
          shouldUse2DParticleLayer(next.effectId) || webglControllerRef.current === null;

        if (!reducedMotion && activeLayer.fade > 0.02 && layerNeedsFrames(activeLayer)) {
          outgoingLayer = activeLayer;
        }

        const nextLayer = createEmptyLayer(
          next.effectId,
          nextPalette,
          reducedMotion ? 1 : 0,
        );
        populateLayer(nextLayer, needsParticles);
        activeLayer = nextLayer;
        startOrResume();
      },
    };

    if (!initialNeedsParticles && !layerNeedsFrames(activeLayer)) {
      resize(true);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    } else {
      resize(true);
      startOrResume();
    }

    const onResize = () => {
      resize(false);
      if (reducedMotion) {
        renderFrame(false);
      }
    };

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && canvas.parentElement) {
      ro = new ResizeObserver(onResize);
      ro.observe(canvas.parentElement);
    } else {
      window.addEventListener('resize', onResize);
    }

    const onVisibilityChange = () => {
      isDocumentHidden = document.hidden;
      if (isDocumentHidden) {
        window.cancelAnimationFrame(rafId);
        rafId = 0;
      } else {
        startOrResume();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    const onMotionChange = (e: MediaQueryListEvent) => {
      reducedMotion = e.matches;
      activeLayer.fade = 1;
      outgoingLayer = null;
      startOrResume();
    };
    mediaQuery?.addEventListener('change', onMotionChange);

    return () => {
      particleControllerRef.current = null;
      window.cancelAnimationFrame(rafId);
      ro?.disconnect();
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      mediaQuery?.removeEventListener('change', onMotionChange);
    };
  }, [staticMode]);

  const hasPosition = fixedViewport || POSITION_RE.test(className);
  const positioningClass = fixedViewport
    ? styles.fixedViewport
    : hasPosition
      ? ''
      : 'absolute inset-0';
  const baseClass = `${positioningClass} ${styles.backdropRoot} pointer-events-none select-none overflow-hidden ${className}`.trim();

  const rootStyle: React.CSSProperties = {
    ...(fixedViewport ? { backgroundColor: 'var(--theme-page-bg)' } : {}),
    '--backdrop-accent': accent,
    '--backdrop-secondary': secondary,
  } as React.CSSProperties;

  return (
    <div
      aria-hidden="true"
      className={baseClass}
      data-effect-id={effectId}
      style={rootStyle}
    >
      {/* WebGL Shader Layer */}
      {!staticMode ? (
        <canvas
          ref={webglCanvasRef}
          data-webgl-backdrop="true"
          className="absolute inset-0 h-full w-full"
        />
      ) : null}

      {/* Atmospheric gradient wash fallback + Static Glow */}
      {effectId !== 'none' ? (
        <div
          className={`absolute inset-0 ${styles.overlayFadeIn}`}
          style={{
            background:
              effectId === 'static-glow'
                ? isLight
                  ? 'radial-gradient(ellipse 92% 62% at 22% 8%, color-mix(in srgb, var(--backdrop-accent) 22%, transparent), transparent 68%), radial-gradient(ellipse 84% 58% at 86% 90%, color-mix(in srgb, var(--backdrop-secondary) 20%, transparent), transparent 70%)'
                  : 'radial-gradient(ellipse 92% 62% at 22% 8%, color-mix(in srgb, var(--backdrop-accent) 34%, transparent), transparent 68%), radial-gradient(ellipse 84% 58% at 86% 90%, color-mix(in srgb, var(--backdrop-secondary) 28%, transparent), transparent 70%)'
                : isLight
                  ? 'radial-gradient(ellipse 90% 60% at 50% 0%, color-mix(in srgb, var(--backdrop-accent) 13%, transparent), transparent 70%), radial-gradient(ellipse 75% 50% at 85% 95%, color-mix(in srgb, var(--backdrop-secondary) 10%, transparent), transparent 70%)'
                  : 'radial-gradient(ellipse 95% 65% at 50% 0%, color-mix(in srgb, var(--backdrop-accent) 17%, transparent), transparent 72%), radial-gradient(ellipse 80% 55% at 85% 95%, color-mix(in srgb, var(--backdrop-secondary) 14%, transparent), transparent 75%)',
          }}
        />
      ) : null}

      {/* Static Paper Grain / Linen / Watercolor overlays */}
      {effectId === 'static-grain' && (
        <div className={`absolute inset-0 ${styles.overlayFadeIn} ${styles.paperGrainOverlay}`} />
      )}
      {effectId === 'static-linen' && (
        <div className={`absolute inset-0 ${styles.overlayFadeIn} ${styles.linenOverlay}`} />
      )}
      {effectId === 'static-watercolor' && (
        <>
          <div
            className={`absolute inset-0 ${styles.overlayFadeIn}`}
            style={{
              background: isLight
                ? 'radial-gradient(ellipse 75% 60% at 15% 20%, color-mix(in srgb, var(--backdrop-accent) 21%, transparent), transparent 70%), radial-gradient(ellipse 80% 65% at 88% 75%, color-mix(in srgb, var(--backdrop-secondary) 20%, transparent), transparent 72%)'
                : 'radial-gradient(ellipse 75% 60% at 15% 20%, color-mix(in srgb, var(--backdrop-accent) 28%, transparent), transparent 70%), radial-gradient(ellipse 80% 65% at 88% 75%, color-mix(in srgb, var(--backdrop-secondary) 27%, transparent), transparent 72%)',
            }}
          />
          <div className={`absolute inset-0 ${styles.overlayFadeIn} ${styles.watercolorOverlay}`} />
        </>
      )}

      {/* CSS atmospheric ribbons (soft complement + instant SSR first paint) */}
      {(effectId === 'prism-gradient' || effectId === 'liquid-chrome') && (
        <div className={`absolute inset-0 opacity-60 ${styles.overlayFadeIn}`}>
          <div
            className={`${styles.prismOrbA} absolute -top-[18%] -left-[12%] h-[68%] w-[85%] rounded-full blur-3xl`}
            style={{
              background: isLight
                ? 'radial-gradient(circle, color-mix(in srgb, var(--backdrop-accent) 19%, transparent) 0%, #38bdf822 55%, transparent 78%)'
                : 'radial-gradient(circle, color-mix(in srgb, var(--backdrop-accent) 29%, transparent) 0%, #38bdf832 55%, transparent 78%)',
            }}
          />
          <div
            className={`${styles.prismOrbB} absolute top-[18%] -right-[16%] h-[72%] w-[88%] rounded-full blur-3xl`}
            style={{
              background: isLight
                ? 'radial-gradient(circle, color-mix(in srgb, var(--backdrop-secondary) 17%, transparent) 0%, #f472b620 55%, transparent 78%)'
                : 'radial-gradient(circle, color-mix(in srgb, var(--backdrop-secondary) 28%, transparent) 0%, #ec489932 55%, transparent 78%)',
            }}
          />
        </div>
      )}

      {effectId === 'aurora' && (
        <div className={`absolute inset-0 opacity-55 ${styles.overlayFadeIn}`}>
          <div
            className={`${styles.auroraRibbonA} absolute -top-1/4 -left-1/4 h-[72%] w-[125%] rounded-full blur-3xl`}
            style={{
              background: isLight
                ? 'linear-gradient(125deg, color-mix(in srgb, var(--backdrop-accent) 14%, transparent) 0%, #38bdf820 48%, #a855f716 100%)'
                : 'linear-gradient(125deg, color-mix(in srgb, var(--backdrop-accent) 26%, transparent) 0%, #22d3ee36 48%, #a855f730 100%)',
            }}
          />
        </div>
      )}

      {effectId === 'starlight-radiance' && (
        <div className={`absolute inset-0 ${styles.overlayFadeIn}`}>
          <div
            className={`${styles.starlightBeam} absolute -top-24 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full blur-3xl`}
            style={{
              background: isLight
                ? 'radial-gradient(circle, rgba(245, 196, 81, 0.24) 0%, transparent 70%)'
                : 'radial-gradient(circle, rgba(245, 196, 81, 0.32) 0%, rgba(251, 191, 36, 0.12) 44%, transparent 74%)',
            }}
          />
        </div>
      )}

      {effectId === 'christmas-lights' && (
        <svg
          className={`absolute top-0 left-0 h-16 w-full opacity-85 ${styles.overlayFadeIn}`}
          viewBox="0 0 1000 80"
          preserveAspectRatio="none"
        >
          <path
            d="M 0 10 Q 500 46 1000 10"
            fill="none"
            stroke="rgba(255,255,255,0.22)"
            strokeWidth="2"
          />
          {STRING_LIGHT_BULBS.map((bulb, i) => (
            <g key={i} className={bulb.even ? styles.bulbEven : styles.bulbOdd}>
              <circle cx={bulb.x} cy={bulb.y} r="18" fill={bulb.color} opacity="0.24" />
              <circle cx={bulb.x} cy={bulb.y} r="4.5" fill={bulb.color} />
            </g>
          ))}
        </svg>
      )}

      {/* 2D Particle / Fallback Canvas */}
      {!staticMode ? (
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      ) : null}
    </div>
  );
}
