'use client';

import React, { useEffect, useRef } from 'react';
import type { AmbientEffectId } from '@/types/invite';
import styles from './AmbientBackdrop.module.css';

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
  shape: 'circle' | 'star' | 'leaf' | 'petal' | 'heart' | 'confetti' | 'bat' | 'bokeh';
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

const POSITION_RE = /\b(?:fixed|absolute|relative|sticky|static)\b/;

function getPalette(effectId: AmbientEffectId, accentColor?: string, isLight?: boolean): string[] {
  const accent = accentColor || '#34d399';
  switch (effectId) {
    case 'snowfall':
      return isLight ? ['#93c5fd', '#bae6fd', '#60a5fa'] : ['#ffffff', '#e0f2fe', '#bae6fd'];
    case 'christmas-lights':
      return ['#fde68a', '#fb7185', '#6ee7b7', '#ffffff'];
    case 'starlight-radiance':
      return ['#fde68a', '#f5c451', '#fef3c7', '#ffffff'];
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
    case 'none':
    default:
      return [accent];
  }
}

function drawFourPointStar(ctx: CanvasRenderingContext2D, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4;
    const rad = i % 2 === 0 ? r : r * 0.34;
    const px = Math.cos(angle) * rad;
    const py = Math.sin(angle) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
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
    snowfall: 54,
    'christmas-lights': 28,
    'starlight-radiance': 36,
    'halloween-bats': 16,
    'autumn-leaves': 26,
    confetti: 44,
    'botanical-petals': 32,
    'lullaby-stars': 36,
    'floating-hearts': 26,
    'champagne-sparkle': 48,
    'warm-bokeh': 18,
    aurora: 28,
  };

  const count = countByEffect[effectId] ?? 0;
  const particles: Particle[] = [];

  for (let i = 0; i < count; i++) {
    if (effectId === 'halloween-bats') {
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
      particles.push({
        x: rand(0, width),
        y: rand(0, height),
        vx: rand(-0.18, 0.18),
        vy: rand(-0.22, -0.05),
        size: rand(18, 46),
        alpha: rand(0.08, 0.22),
        phase: rand(0, Math.PI * 2),
        rotation: 0,
        vRot: 0,
        color: pick(),
        shape: 'bokeh',
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
        vy: effectId === 'champagne-sparkle' ? rand(-1.0, -0.35) : rand(-0.55, -0.18),
        size:
          effectId === 'floating-hearts'
            ? rand(5, 10)
            : effectId === 'starlight-radiance'
              ? rand(2.5, 6)
              : rand(1.8, 4.5),
        alpha: rand(0.3, 0.78),
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
              : i % 5 === 0
                ? 'star'
                : 'circle',
      });
    } else if (effectId === 'lullaby-stars' || effectId === 'aurora' || effectId === 'christmas-lights') {
      particles.push({
        x: rand(0, width),
        y: rand(0, height),
        vx: rand(-0.06, 0.06),
        vy: rand(-0.08, 0.04),
        size: rand(2, 5.2),
        alpha: rand(0.25, 0.8),
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
      // snowfall: 30% dreamy out-of-focus bokeh snow orbs + 70% crisp drifting flakes
      const isBokehOrb = i % 3 === 0;
      particles.push({
        x: rand(0, width),
        y: rand(0, height),
        vx: rand(-0.18, 0.22),
        vy: isBokehOrb ? rand(0.18, 0.55) : rand(0.35, 1.1),
        size: isBokehOrb ? rand(10, 26) : rand(1.6, 4.2),
        alpha: isBokehOrb ? rand(0.08, 0.19) : rand(0.28, 0.68),
        phase: rand(0, Math.PI * 2),
        rotation: 0,
        vRot: 0,
        color: pick(),
        shape: isBokehOrb ? 'bokeh' : 'circle',
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
  accentColor,
  colorMode = 'dark',
  fixedViewport = false,
  className = '',
}: {
  effectId: AmbientEffectId;
  accentColor?: string;
  colorMode?: 'dark' | 'light';
  fixedViewport?: boolean;
  className?: string;
}): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isLight = colorMode === 'light';
  const accent = accentColor || (isLight ? '#2c6b4a' : '#34d399');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || effectId === 'none') {
      return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    const mediaQuery =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null;

    let reducedMotion = mediaQuery?.matches ?? false;
    let initialized = false;
    let width = canvas.clientWidth || 960;
    let height = canvas.clientHeight || 640;

    const palette = getPalette(effectId, accent, isLight);
    let particles: Particle[] = [];
    let sparks: FireworkSpark[] = [];
    let rafId = 0;
    let tick = 0;
    let lastBurst = 0;

    const spawnFireworkBurst = (cx: number, cy: number) => {
      const burstColor = palette[Math.floor(Math.random() * palette.length)];
      const secondary = palette[Math.floor(Math.random() * palette.length)];
      const count = 26;
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.2;
        const speed = 1.1 + Math.random() * 2.1;
        sparks.push({
          x: cx,
          y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0,
          maxLife: 46 + Math.random() * 24,
          color: i % 3 === 0 ? secondary : burstColor,
          size: 1.6 + Math.random() * 1.6,
        });
      }
    };

    const resize = (force = false) => {
      const parent = canvas.parentElement;
      const nextWidth = parent?.clientWidth || window.innerWidth || 960;
      const nextHeight = parent?.clientHeight || window.innerHeight || 640;

      // Ignore minor vertical chrome/address-bar transitions on mobile scroll so animations never flash or reset
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

      if (!initialized || particles.length === 0) {
        particles = createParticles(effectId, width, height, palette);
        initialized = true;
      } else if (prevWidth > 0 && prevHeight > 0) {
        for (const p of particles) {
          p.x = (p.x / prevWidth) * width;
          p.y = (p.y / prevHeight) * height;
        }
      }

      if (effectId === 'fireworks' && sparks.length === 0) {
        spawnFireworkBurst(width * 0.25, height * 0.26);
        spawnFireworkBurst(width * 0.74, height * 0.22);
      }
    };

    const drawParticle = (p: Particle, timeTick: number) => {
      ctx.save();
      const twinkle =
        p.shape === 'star' || effectId === 'lullaby-stars' || effectId === 'aurora'
          ? 0.55 + 0.45 * Math.sin(timeTick * 0.04 + p.phase)
          : 1;
      ctx.globalAlpha = Math.max(0.05, Math.min(1, p.alpha * twinkle));
      ctx.fillStyle = p.color;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);

      switch (p.shape) {
        case 'star':
          drawFourPointStar(ctx, p.size);
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

    const renderFrame = (animate: boolean) => {
      ctx.clearRect(0, 0, width, height);
      tick += 1;

      if (effectId === 'fireworks') {
        if (animate && tick - lastBurst > 58) {
          lastBurst = tick;
          spawnFireworkBurst(
            width * (0.18 + Math.random() * 0.64),
            height * (0.14 + Math.random() * 0.38),
          );
        }
        const nextSparks: FireworkSpark[] = [];
        for (const s of sparks) {
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
            ctx.globalAlpha = Math.max(0, (1 - progress) * 0.85);
            ctx.fillStyle = s.color;
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            nextSparks.push(s);
          }
        }
        sparks = nextSparks;
        if (!animate) {
          return;
        }
      }

      for (const p of particles) {
        if (animate) {
          const sway =
            effectId === 'snowfall' || effectId === 'botanical-petals' || effectId === 'autumn-leaves'
              ? Math.sin(tick * 0.02 + p.phase) * 0.35
              : 0;
          p.x += p.vx + sway;
          p.y += p.vy;
          p.rotation += p.vRot;

          if (p.y > height + 24) {
            p.y = -20;
            p.x = Math.random() * width;
          } else if (p.y < -24) {
            p.y = height + 20;
            p.x = Math.random() * width;
          }
          if (p.x > width + 24) {
            p.x = -20;
          } else if (p.x < -24) {
            p.x = width + 20;
          }
        }
        drawParticle(p, tick);
      }

      if (animate) {
        rafId = window.requestAnimationFrame(() => renderFrame(true));
      }
    };

    resize(true);
    if (reducedMotion) {
      renderFrame(false);
    } else {
      rafId = window.requestAnimationFrame(() => renderFrame(true));
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

    const onMotionChange = (e: MediaQueryListEvent) => {
      reducedMotion = e.matches;
      window.cancelAnimationFrame(rafId);
      if (reducedMotion) {
        renderFrame(false);
      } else {
        rafId = window.requestAnimationFrame(() => renderFrame(true));
      }
    };
    mediaQuery?.addEventListener('change', onMotionChange);

    return () => {
      window.cancelAnimationFrame(rafId);
      ro?.disconnect();
      window.removeEventListener('resize', onResize);
      mediaQuery?.removeEventListener('change', onMotionChange);
    };
  }, [effectId, accent, isLight]);

  const hasPosition = fixedViewport || POSITION_RE.test(className);
  const positioningClass = fixedViewport
    ? styles.fixedViewport
    : hasPosition
      ? ''
      : 'absolute inset-0';
  const baseClass = `${positioningClass} pointer-events-none select-none overflow-hidden ${className}`.trim();

  return (
    <div
      aria-hidden="true"
      className={baseClass}
      data-effect-id={effectId}
      style={fixedViewport ? { backgroundColor: 'var(--theme-page-bg)' } : undefined}
    >
      {/* Ambient base radial wash */}
      <div
        className="absolute inset-0"
        style={{
          background: isLight
            ? `radial-gradient(ellipse 80% 55% at 50% 0%, ${accent}18, transparent 70%)`
            : `radial-gradient(ellipse 85% 60% at 50% 0%, ${accent}26, transparent 72%)`,
        }}
      />

      {/* Aurora Borealis ribbons */}
      {effectId === 'aurora' && (
        <div className="absolute inset-0">
          <div
            className={`${styles.auroraRibbonA} absolute -top-1/4 -left-1/4 h-[70%] w-[125%] rounded-full blur-3xl`}
            style={{
              background: isLight
                ? `linear-gradient(125deg, ${accent}26 0%, #38bdf822 48%, #a855f71c 100%)`
                : `linear-gradient(125deg, ${accent}52 0%, #22d3ee40 48%, #a855f73d 100%)`,
            }}
          />
          <div
            className={`${styles.auroraRibbonB} absolute top-[10%] -right-1/4 h-[60%] w-[115%] rounded-full blur-3xl`}
            style={{
              background: isLight
                ? `linear-gradient(235deg, #a855f71c 0%, ${accent}20 55%, #38bdf818 100%)`
                : `linear-gradient(235deg, #c084fc42 0%, ${accent}38 55%, #06b6d436 100%)`,
            }}
          />
          <div
            className={`${styles.auroraRibbonC} absolute bottom-[-20%] left-[10%] h-[50%] w-[85%] rounded-full blur-3xl`}
            style={{
              background: isLight
                ? `radial-gradient(circle, ${accent}14 0%, transparent 70%)`
                : `radial-gradient(circle, ${accent}2b 0%, #3b82f61a 45%, transparent 75%)`,
            }}
          />
        </div>
      )}

      {/* Sacred Star of Bethlehem radiating beams */}
      {effectId === 'starlight-radiance' && (
        <div className="absolute inset-0">
          <div
            className={`${styles.starlightBeam} absolute -top-24 left-1/2 h-[460px] w-[460px] -translate-x-1/2 rounded-full blur-3xl`}
            style={{
              background: isLight
                ? 'radial-gradient(circle, rgba(245, 196, 81, 0.25) 0%, transparent 70%)'
                : 'radial-gradient(circle, rgba(245, 196, 81, 0.34) 0%, rgba(251, 191, 36, 0.1) 42%, transparent 72%)',
            }}
          />
        </div>
      )}

      {/* Halloween twilight mist */}
      {effectId === 'halloween-bats' && (
        <div className="absolute inset-0">
          <div
            className={`${styles.mistLayer} absolute bottom-0 -left-1/4 h-1/2 w-[150%] blur-3xl`}
            style={{
              background: isLight
                ? 'radial-gradient(ellipse at 50% 100%, rgba(126, 34, 206, 0.12), transparent 70%)'
                : 'radial-gradient(ellipse at 50% 100%, rgba(168, 85, 247, 0.2), rgba(251, 146, 60, 0.08) 45%, transparent 72%)',
            }}
          />
        </div>
      )}

      {/* Festive Christmas string lights along top edge */}
      {effectId === 'christmas-lights' && (
        <svg
          className="absolute top-0 left-0 h-14 w-full opacity-75"
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
              <circle cx={bulb.x} cy={bulb.y} r="13" fill={bulb.color} opacity="0.24" />
              <circle cx={bulb.x} cy={bulb.y} r="4.5" fill={bulb.color} />
            </g>
          ))}
        </svg>
      )}

      {/* GPU Canvas particles */}
      {effectId !== 'none' && (
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      )}
    </div>
  );
}
