import { hexToRgb } from '@/lib/themes/contrast';
import type { AmbientEffectId } from '@/types/invite';

const VERTEX_SHADER_SOURCE = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER_SOURCE = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

varying vec2 v_uv;
uniform vec2 u_resolution;
uniform float u_time;
uniform vec3 u_bg;
uniform vec3 u_accent;
uniform vec3 u_secondary;
uniform float u_isLight;
uniform float u_mode;
uniform float u_turbulence;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float value = 0.0;
  float amp = 0.5;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 4; i++) {
    value += amp * noise(p);
    p = rot * p * 2.02;
    amp *= 0.5;
  }
  return value;
}

vec3 hslIridescent(float t) {
  return 0.5 + 0.5 * cos(6.28318 * (t + vec3(0.0, 0.33, 0.67)));
}

void main() {
  vec2 uv = v_uv;
  float aspect = max(0.5, u_resolution.x / max(1.0, u_resolution.y));
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
  float t = u_time;

  // Live liquid domain displacement while user types or swaps themes
  if (u_turbulence > 0.005) {
    vec2 warp = vec2(
      fbm(p * 1.9 + vec2(t * 0.25, -t * 0.18)) - 0.5,
      fbm(p * 1.9 + vec2(-t * 0.2, t * 0.22) + 4.7) - 0.5
    );
    p += warp * (0.28 * u_turbulence);
  }

  vec3 col = u_bg;
  float lightStrength = mix(1.0, 0.42, u_isLight);

  if (u_mode < 0.5) {
    // 0: Northern Lights (aurora)
    float wave1 = sin(p.x * 2.6 + t * 0.35 + fbm(vec2(p.x * 1.6, t * 0.14)) * 2.4);
    float band1 = exp(-abs(p.y - 0.12 - wave1 * 0.16) * 6.5);
    float wave2 = cos(p.x * 1.9 - t * 0.25 + fbm(vec2(p.x * 2.1 + 4.0, t * 0.1)) * 2.2);
    float band2 = exp(-abs(p.y + 0.04 - wave2 * 0.18) * 5.2);
    float shimmer = 0.65 + 0.35 * sin(uv.x * 18.0 + t * 0.9);
    col = mix(col, u_accent, clamp(band1 * 0.72 * shimmer * lightStrength, 0.0, 0.88));
    col = mix(col, u_secondary, clamp(band2 * 0.58 * lightStrength, 0.0, 0.82));
    float mist = fbm(p * 2.0 + vec2(t * 0.05, -t * 0.03));
    col += mix(u_accent, u_secondary, 0.5) * mist * 0.12 * lightStrength;
  } else if (u_mode < 1.5) {
    // 1: Color Waves fluid mesh gradient (prism-gradient)
    vec2 q = vec2(
      fbm(p * 1.4 + vec2(t * 0.09, t * 0.05)),
      fbm(p * 1.4 + vec2(-t * 0.07, t * 0.08) + 3.1)
    );
    float f = fbm(p * 1.6 + q * 1.9 + t * 0.04);
    vec3 highlight = mix(u_accent, u_secondary, smoothstep(0.25, 0.8, q.x));
    vec3 prism = mix(highlight, hslIridescent(f * 0.5 + t * 0.025), 0.18 + 0.12 * u_turbulence);
    col = mix(col, prism, smoothstep(0.18, 0.86, f) * mix(0.76, 0.36, u_isLight));
  } else if (u_mode < 2.5) {
    // 2: Y2K Liquid Chrome / Iridescent Ripple (liquid-chrome)
    vec2 z = p * 2.1;
    for (int i = 0; i < 3; i++) {
      z += 0.38 * sin(z.yx * 2.2 + t * 0.48 + float(i));
    }
    float ripple = 0.5 + 0.5 * sin(length(z) * 3.4 - t * 0.85);
    float spec = pow(clamp(0.5 + 0.5 * cos(z.x * 2.4 - z.y * 2.1 + t * 0.5), 0.0, 1.0), 4.0);
    vec3 foil = mix(hslIridescent(ripple * 0.45 + 0.12), mix(u_accent, u_secondary, ripple), 0.58);
    col = mix(col, foil, mix(0.62, 0.32, u_isLight));
    col += vec3(0.95, 0.97, 1.0) * spec * mix(0.32, 0.14, u_isLight);
  } else if (u_mode < 3.5) {
    // 3: Neon Silk (replaces harsh perspective grid with silky glowing bioluminescent folds)
    vec2 sUv = p * vec2(1.3, 1.6);
    float foldA = sin(sUv.x * 2.4 + fbm(sUv * 1.4 + t * 0.12) * 3.2 - t * 0.28);
    float foldB = cos(sUv.x * 1.7 - sUv.y * 2.1 + fbm(sUv * 1.1 - t * 0.09) * 2.8 + t * 0.2);
    float ribbonA = exp(-abs(sUv.y - foldA * 0.24) * 5.8);
    float ribbonB = exp(-abs(sUv.y + 0.18 - foldB * 0.22) * 4.6);
    float sheen = smoothstep(0.15, 0.92, fbm(sUv * 2.2 + vec2(t * 0.08, -t * 0.06)));
    col = mix(col, u_secondary, clamp((ribbonB * 0.52 + sheen * 0.22) * lightStrength, 0.0, 0.78));
    col += u_accent * (ribbonA * 0.56 + sheen * 0.08) * lightStrength;
  } else if (u_mode < 4.5) {
    // 4: Dreamy Bokeh Glow (warm-bokeh / lights / starlight / sparkle)
    float accum = 0.0;
    vec3 orbMix = col;
    for (int i = 0; i < 6; i++) {
      float fi = float(i);
      vec2 center = vec2(
        sin(t * (0.12 + fi * 0.025) + fi * 1.7) * 0.52 * aspect,
        cos(t * (0.10 + fi * 0.02) + fi * 2.3) * 0.36
      );
      float radius = 0.18 + 0.05 * sin(fi * 2.1 + t * 0.2);
      float d = length(p - center);
      float orb = smoothstep(radius, radius * 0.25, d) * (0.28 + 0.12 * sin(t * 0.5 + fi));
      vec3 tint = mod(fi, 2.0) < 0.5 ? u_accent : u_secondary;
      orbMix = mix(orbMix, tint, clamp(orb * mix(0.85, 0.36, u_isLight), 0.0, 0.65));
      accum += orb;
    }
    float crown = exp(-length(uv - vec2(0.5, 0.14)) * 2.2) * 0.32 * lightStrength;
    col = orbMix + mix(u_accent, u_secondary, 0.35) * crown * (0.3 + accum * 0.2);
  } else if (u_mode < 5.5) {
    // 5: Atmospheric Twilight Wash behind particles
    float cloud = fbm(p * 1.45 + vec2(t * 0.035, t * 0.02));
    float topGlow = exp(-length(uv - vec2(0.5, 0.0)) * 1.85);
    float bottomGlow = exp(-length(uv - vec2(0.82, 0.96)) * 2.1);
    col = mix(col, mix(u_bg, u_accent, 0.45), clamp((cloud * 0.28 + topGlow * 0.34) * lightStrength, 0.0, 0.65));
    col = mix(col, mix(u_bg, u_secondary, 0.45), clamp(bottomGlow * 0.28 * lightStrength, 0.0, 0.5));
  } else if (u_mode < 6.5) {
    // 6: Velvet Orbs (lava-lamp) — slow organic rising & fusing heat blobs
    float fieldA = 0.0;
    float fieldB = 0.0;
    for (int i = 0; i < 5; i++) {
      float fi = float(i);
      vec2 c = vec2(
        sin(t * (0.14 + fi * 0.03) + fi * 2.1) * 0.44 * aspect,
        sin(t * (0.18 - fi * 0.02) + fi * 1.3) * 0.36
      );
      float r = 0.16 + 0.04 * cos(fi + t * 0.25);
      float contrib = (r * r) / max(0.015, dot(p - c, p - c) + 0.015);
      if (mod(fi, 2.0) < 0.5) fieldA += contrib;
      else fieldB += contrib;
    }
    float maskA = smoothstep(0.55, 1.35, fieldA);
    float maskB = smoothstep(0.55, 1.35, fieldB);
    col = mix(col, u_accent, maskA * mix(0.62, 0.28, u_isLight));
    col = mix(col, u_secondary, maskB * mix(0.54, 0.24, u_isLight));
  } else if (u_mode < 7.5) {
    // 7: Poolside Ripple (water-caustics) — sunlit cellular water shimmer
    vec2 wp = p * 3.1;
    float c1 = sin(wp.x * 1.4 + t * 0.6 + sin(wp.y * 1.8 - t * 0.45));
    float c2 = cos(wp.y * 1.5 - t * 0.5 + cos(wp.x * 1.6 + t * 0.4));
    float caustic = pow(1.0 - min(1.0, abs(c1 + c2) * 0.48), 3.0);
    float swell = fbm(p * 1.5 + vec2(t * 0.06, -t * 0.05));
    col = mix(col, u_secondary, swell * mix(0.45, 0.22, u_isLight));
    col += mix(u_accent, vec3(0.95, 0.99, 1.0), 0.35) * caustic * mix(0.36, 0.24, u_isLight);
  } else if (u_mode < 8.5) {
    // 8: Drifting Clouds (twilight-clouds) — soft backlit atmospheric cloud banks
    float wind = t * 0.045;
    float baseCloud = fbm(p * vec2(1.1, 1.65) + vec2(wind, 0.0));
    float detailCloud = fbm(p * vec2(2.2, 3.0) + vec2(wind * 1.6, 1.4));
    float density = smoothstep(0.32, 0.78, baseCloud * 0.72 + detailCloud * 0.28);
    float sunBand = exp(-abs(uv.y - 0.68) * 3.2);
    vec3 rim = mix(u_accent, u_secondary, sunBand);
    col = mix(col, rim, density * mix(0.56, 0.3, u_isLight));
    col += rim * (1.0 - density) * sunBand * 0.22 * lightStrength;
  } else if (u_mode < 9.5) {
    // 9: Prism Glass (stained-glass) — soft pearlescent Voronoi crystal facets
    vec2 gUv = p * 2.6 + vec2(t * 0.03, -t * 0.02);
    vec2 n = floor(gUv);
    vec2 f = fract(gUv);
    float md1 = 8.0;
    float md2 = 8.0;
    float cellId = 0.0;
    for (int j = -1; j <= 1; j++) {
      for (int i = -1; i <= 1; i++) {
        vec2 g = vec2(float(i), float(j));
        vec2 o = hash22(n + g);
        o = 0.5 + 0.4 * sin(t * 0.25 + 6.2831 * o);
        vec2 r = g + o - f;
        float d = dot(r, r);
        if (d < md1) {
          md2 = md1;
          md1 = d;
          cellId = hash21(n + g);
        } else if (d < md2) {
          md2 = d;
        }
      }
    }
    vec3 shard = mix(u_accent, u_secondary, cellId);
    float edgeGlow = exp(-(sqrt(md2) - sqrt(md1)) * 7.5);
    col = mix(col, shard, (0.28 + cellId * 0.3) * mix(0.75, 0.34, u_isLight));
    col += mix(vec3(1.0), u_accent, 0.5) * edgeGlow * mix(0.24, 0.14, u_isLight);
  } else {
    // 10: Mirrorball Rays (disco-prism) — calm rotating volumetric light shafts & soft prism glow
    float ang = atan(p.y - 0.18, p.x);
    float dist = length(p - vec2(0.0, 0.18));
    float rays = 0.5 + 0.5 * sin(ang * 8.0 + t * 0.38);
    float subRays = 0.5 + 0.5 * cos(ang * 5.0 - t * 0.24);
    float beam = pow(rays * subRays, 1.8) * exp(-dist * 1.15);
    vec3 spectrum = mix(u_accent, u_secondary, 0.5 + 0.5 * sin(ang * 3.0 + t * 0.2));
    col = mix(col, spectrum, clamp(beam * mix(0.78, 0.38, u_isLight), 0.0, 0.72));
    col += vec3(1.0, 0.98, 0.94) * exp(-dist * 4.5) * mix(0.22, 0.14, u_isLight);
  }

  // Extra subtle chromatic shimmer when user types actively in NLP composer
  if (u_turbulence > 0.05) {
    float rippleGlow = fbm(p * 2.5 - t * 0.35);
    col += mix(u_accent, u_secondary, rippleGlow) * (0.12 * u_turbulence * lightStrength);
  }

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

export function effectToShaderMode(effectId: AmbientEffectId): number {
  switch (effectId) {
    case 'aurora':
      return 0;
    case 'prism-gradient':
      return 1;
    case 'liquid-chrome':
      return 2;
    case 'cyber-grid':
      return 3;
    case 'warm-bokeh':
    case 'christmas-lights':
    case 'starlight-radiance':
    case 'lullaby-stars':
    case 'champagne-sparkle':
      return 4;
    case 'lava-lamp':
      return 6;
    case 'water-caustics':
      return 7;
    case 'twilight-clouds':
      return 8;
    case 'stained-glass':
      return 9;
    case 'disco-prism':
      return 10;
    default:
      return 5;
  }
}

export function shouldUse2DParticleLayer(effectId: AmbientEffectId): boolean {
  switch (effectId) {
    case 'liquid-chrome':
    case 'cyber-grid':
    case 'aurora':
    case 'prism-gradient':
    case 'warm-bokeh':
    case 'lava-lamp':
    case 'water-caustics':
    case 'twilight-clouds':
    case 'stained-glass':
    case 'disco-prism':
    case 'static-glow':
    case 'static-grain':
    case 'static-linen':
    case 'static-watercolor':
    case 'none':
      return false;
    default:
      return true;
  }
}

function isRealWebGLContext(ctx: unknown): ctx is WebGLRenderingContext {
  return (
    typeof ctx === 'object' &&
    ctx !== null &&
    typeof (ctx as WebGLRenderingContext).createShader === 'function' &&
    typeof (ctx as WebGLRenderingContext).createProgram === 'function' &&
    typeof (ctx as WebGLRenderingContext).compileShader === 'function'
  );
}

function hexToNormalizedVec3(
  hex: string,
  fallback: [number, number, number],
): [number, number, number] {
  try {
    const rgb = hexToRgb(hex);
    return [rgb.r / 255, rgb.g / 255, rgb.b / 255];
  } catch {
    return fallback;
  }
}

export interface WebGLBackdropParams {
  bgHex: string;
  accentHex: string;
  secondaryHex: string;
  isLight: boolean;
  effectId: AmbientEffectId;
  reducedMotion: boolean;
  turbulence?: number;
}

export interface WebGLBackdropController {
  updateParams: (next: WebGLBackdropParams) => void;
  resize: (width: number, height: number) => void;
  pause: () => void;
  resume: () => void;
  destroy: () => void;
}

export function initWebGLBackdrop(
  canvas: HTMLCanvasElement,
  initial: WebGLBackdropParams,
): WebGLBackdropController | null {
  let rawCtx: unknown = null;
  try {
    rawCtx = canvas.getContext('webgl', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'low-power',
      preserveDrawingBuffer: false,
    });
  } catch {
    return null;
  }

  if (!isRealWebGLContext(rawCtx)) {
    return null;
  }
  const gl = rawCtx;

  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  };

  const vs = compile(gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
  const fs = compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);
  if (!vs || !fs) {
    if (vs) gl.deleteShader(vs);
    if (fs) gl.deleteShader(fs);
    return null;
  }

  const program = gl.createProgram();
  if (!program) {
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return null;
  }

  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return null;
  }

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW,
  );

  const posLoc = gl.getAttribLocation(program, 'a_pos');
  const uRes = gl.getUniformLocation(program, 'u_resolution');
  const uTime = gl.getUniformLocation(program, 'u_time');
  const uBg = gl.getUniformLocation(program, 'u_bg');
  const uAccent = gl.getUniformLocation(program, 'u_accent');
  const uSecondary = gl.getUniformLocation(program, 'u_secondary');
  const uIsLight = gl.getUniformLocation(program, 'u_isLight');
  const uMode = gl.getUniformLocation(program, 'u_mode');
  const uTurbulence = gl.getUniformLocation(program, 'u_turbulence');

  let state: WebGLBackdropParams = { ...initial };
  const startTime = performance.now();
  let lastFrameMs = startTime;
  let rafId = 0;
  let paused = false;
  let destroyed = false;

  // Current smoothly-interpolated uniforms so theme swaps dissolve seamlessly
  let curBg = hexToNormalizedVec3(initial.bgHex, [0.04, 0.1, 0.24]);
  let curAccent = hexToNormalizedVec3(initial.accentHex, [0.2, 0.82, 0.6]);
  let curSecondary = hexToNormalizedVec3(initial.secondaryHex, [0.06, 0.65, 0.91]);
  let curIsLight = initial.isLight ? 1.0 : 0.0;
  let curTurbulence = Math.max(0, Math.min(1, initial.turbulence ?? 0));

  const lerpVec3 = (
    cur: [number, number, number],
    target: [number, number, number],
    alpha: number,
  ): [number, number, number] => [
    cur[0] + (target[0] - cur[0]) * alpha,
    cur[1] + (target[1] - cur[1]) * alpha,
    cur[2] + (target[2] - cur[2]) * alpha,
  ];

  const drawFrame = (nowMs: number) => {
    if (destroyed) return;
    const dt = Math.max(0.001, Math.min(0.1, (nowMs - lastFrameMs) * 0.001));
    lastFrameMs = nowMs;

    const alpha = state.reducedMotion ? 1.0 : Math.min(1, 1 - Math.exp(-dt * 4.8));
    const targetBg = hexToNormalizedVec3(state.bgHex, [0.04, 0.1, 0.24]);
    const targetAccent = hexToNormalizedVec3(state.accentHex, [0.2, 0.82, 0.6]);
    const targetSecondary = hexToNormalizedVec3(state.secondaryHex, [0.06, 0.65, 0.91]);
    const targetIsLight = state.isLight ? 1.0 : 0.0;
    const targetTurbulence = Math.max(0, Math.min(1, state.turbulence ?? 0));

    curBg = lerpVec3(curBg, targetBg, alpha);
    curAccent = lerpVec3(curAccent, targetAccent, alpha);
    curSecondary = lerpVec3(curSecondary, targetSecondary, alpha);
    curIsLight = curIsLight + (targetIsLight - curIsLight) * alpha;
    curTurbulence = curTurbulence + (targetTurbulence - curTurbulence) * alpha;

    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const elapsedSec = state.reducedMotion ? 1.5 : (nowMs - startTime) * 0.001;

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, elapsedSec);
    gl.uniform3f(uBg, curBg[0], curBg[1], curBg[2]);
    gl.uniform3f(uAccent, curAccent[0], curAccent[1], curAccent[2]);
    gl.uniform3f(uSecondary, curSecondary[0], curSecondary[1], curSecondary[2]);
    gl.uniform1f(uIsLight, curIsLight);
    gl.uniform1f(uMode, effectToShaderMode(state.effectId));
    if (uTurbulence) {
      gl.uniform1f(uTurbulence, state.reducedMotion ? 0.0 : curTurbulence);
    }

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  const loop = (nowMs: number) => {
    if (destroyed || paused || state.reducedMotion) {
      rafId = 0;
      return;
    }
    drawFrame(nowMs);
    rafId = window.requestAnimationFrame(loop);
  };

  const syncLoop = () => {
    window.cancelAnimationFrame(rafId);
    rafId = 0;
    drawFrame(performance.now());
    if (!paused && !state.reducedMotion && !destroyed) {
      rafId = window.requestAnimationFrame(loop);
    }
  };

  const resize = (width: number, height: number) => {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const nextW = Math.max(1, Math.floor(width * dpr));
    const nextH = Math.max(1, Math.floor(height * dpr));
    if (canvas.width !== nextW || canvas.height !== nextH) {
      canvas.width = nextW;
      canvas.height = nextH;
    }
    drawFrame(performance.now());
  };

  const updateParams = (next: WebGLBackdropParams) => {
    const motionChanged = state.reducedMotion !== next.reducedMotion;
    state = { ...next };
    if (motionChanged) {
      syncLoop();
    } else {
      drawFrame(performance.now());
    }
  };

  const pause = () => {
    paused = true;
    window.cancelAnimationFrame(rafId);
    rafId = 0;
  };

  const resume = () => {
    paused = false;
    lastFrameMs = performance.now();
    syncLoop();
  };

  const destroy = () => {
    destroyed = true;
    window.cancelAnimationFrame(rafId);
    rafId = 0;
    if (buffer) gl.deleteBuffer(buffer);
    gl.deleteProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
  };

  syncLoop();

  return {
    updateParams,
    resize,
    pause,
    resume,
    destroy,
  };
}
