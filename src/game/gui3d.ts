import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { TorqSaveBlob } from './cloudSave';
import type { NewToolAnnouncement } from './ftue';
import {
  SOUNDSCAPE_PACK_ORDER,
  SOUNDSCAPE_PACKS,
  SoundscapePackId,
  SoundSettingsState,
} from './sound';
import { DayStreakState } from './streak';
import {
  BoardState,
  GamePhase,
  RunSnapshot,
  SCREW_COLOR_META,
  ScrewColor,
} from './types';

export type Gui3DAction =
  | { type: 'start_game'; levelIdx?: number }
  | { type: 'hammer' }
  | { type: 'extra_slot' }
  | { type: 'toggle_explode' }
  | { type: 'cycle_camera' }
  | { type: 'toggle_mute' }
  | { type: 'restart_level' }
  | { type: 'pause_toggle' }
  | { type: 'return_title' }
  | { type: 'auto_play' }
  | { type: 'open_sound_settings' }
  | { type: 'close_sound_settings' }
  | { type: 'select_sound_pack'; packId: SoundscapePackId }
  | { type: 'cycle_sound_pack' }
  | { type: 'cycle_volume' }
  | { type: 'test_sound_pack' }
  | { type: 'revive_ad' }
  | { type: 'refill_hammer_ad' }
  | { type: 'fuel_autoplay_ad' }
  | { type: 'double_streak_ad' }
  | { type: 'side_ad_click'; side: 'left' | 'right' }
  | { type: 'link_play_games' }
  | { type: 'pgs_save_prompt' }
  | { type: 'pgs_later_prompt' }
  | { type: 'close_session_recap' }
  | { type: 'resolve_conflict'; choice: 'smart_merge' | 'keep_cloud' | 'keep_local' };

export type ModalOverlay3DState =
  | { kind: 'none' }
  | { kind: 'session_recap'; levelNumber: number; score: number; maxCombo: number }
  | { kind: 'cloud_conflict'; cloud: TorqSaveBlob; local: TorqSaveBlob };

const UI_TEX_SUPERSAMPLE = 2;
const BUTTON_TEX_SUPERSAMPLE = 2;

function configureCrispUITexture(
  texture: THREE.CanvasTexture,
  maxAnisotropy: number
): THREE.CanvasTexture {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.max(1, maxAnisotropy);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  return texture;
}

export interface Button3DHandle {
  group: THREE.Group;
  capMesh: THREE.Mesh;
  topDecalMesh: THREE.Mesh;
  canvas: HTMLCanvasElement;
  logicalW: number;
  logicalH: number;
  texScale: number;
  texture: THREE.CanvasTexture;
  action: Gui3DAction;
  baseZ: number;
  currZ: number;
  lastCacheKey: string;
}

/**
 * Helper to create a smooth 2D rounded-rectangle ShapeGeometry with UV coordinates [0..1]
 * so top-face decals match the rounded 3D button and tablet silhouettes with zero sharp corners.
 */
function createRoundedPlaneGeometry(
  width: number,
  height: number,
  radius: number,
  curveSegments = 16
): THREE.ShapeGeometry {
  const hw = width / 2;
  const hh = height / 2;
  const r = Math.min(radius, hw * 0.48, hh * 0.48);

  const shape = new THREE.Shape();
  shape.moveTo(-hw + r, -hh);
  shape.lineTo(hw - r, -hh);
  shape.quadraticCurveTo(hw, -hh, hw, -hh + r);
  shape.lineTo(hw, hh - r);
  shape.quadraticCurveTo(hw, hh, hw - r, hh);
  shape.lineTo(-hw + r, hh);
  shape.quadraticCurveTo(-hw, hh, -hw, hh - r);
  shape.lineTo(-hw, -hh + r);
  shape.quadraticCurveTo(-hw, -hh, -hw + r, -hh);

  const geo = new THREE.ShapeGeometry(shape, curveSegments);
  // Normalize UVs to [0..1] across [-hw..hw, -hh..hh]
  const pos = geo.attributes.position;
  const uvs = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i);
    const py = pos.getY(i);
    uvs[i * 2] = (px + hw) / width;
    uvs[i * 2 + 1] = (py + hh) / height;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  return geo;
}

/**
 * Helper to draw a rounded rectangle path on a 2D canvas context
 */
function traceRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
}

/**
 * Helper to draw a crisp rounded-edge 3D button cap label + optional count badge onto a CanvasTexture
 */
export function updateButton3DCapTexture(
  handle: Button3DHandle,
  label: string,
  subLabel: string,
  accentHex: string,
  badgeText?: string,
  active?: boolean,
  disabled?: boolean
) {
  const cacheKey = `${label}|${subLabel}|${accentHex}|${badgeText ?? ''}|${!!active}|${!!disabled}`;
  if (handle.lastCacheKey === cacheKey) return;
  handle.lastCacheKey = cacheKey;

  const ctx = handle.canvas.getContext('2d')!;
  const w = handle.logicalW;
  const h = handle.logicalH;
  ctx.setTransform(handle.texScale, 0, 0, handle.texScale, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.clearRect(0, 0, w, h);

  const cornerR = Math.min(w, h) * 0.24;

  // Satin metallic gradient button face
  const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
  if (disabled) {
    bgGrad.addColorStop(0, '#1B202C');
    bgGrad.addColorStop(1, '#11151E');
  } else if (active) {
    bgGrad.addColorStop(0, '#5A340C');
    bgGrad.addColorStop(0.5, '#3E2206');
    bgGrad.addColorStop(1, '#261403');
  } else {
    bgGrad.addColorStop(0, '#283246');
    bgGrad.addColorStop(0.45, '#1B2231');
    bgGrad.addColorStop(1, '#121722');
  }

  traceRoundRect(ctx, 2, 2, w - 4, h - 4, cornerR);
  ctx.fillStyle = bgGrad;
  ctx.fill();

  // Top studio specular highlight arc
  const sheenGrad = ctx.createLinearGradient(0, 4, 0, h * 0.45);
  sheenGrad.addColorStop(0, 'rgba(255, 255, 255, 0.16)');
  sheenGrad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
  traceRoundRect(ctx, 8, 6, w - 16, h * 0.42, cornerR * 0.8);
  ctx.fillStyle = sheenGrad;
  ctx.fill();

  // Inner rounded glowing rim
  traceRoundRect(ctx, 8, 8, w - 16, h - 16, Math.max(8, cornerR - 6));
  ctx.strokeStyle = disabled ? '#2E374B' : active ? '#FBBF24' : accentHex;
  ctx.lineWidth = active ? 7 : 4.5;
  ctx.stroke();

  // Main Icon / Title Text
  if (label === '🎬') {
    ctx.fillStyle = disabled ? '#475569' : accentHex;
    const midY = subLabel ? h * 0.42 : h * 0.52;
    traceRoundRect(ctx, w / 2 - 20, midY - 13, 22, 24, 3);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(w / 2 + 3, midY - 8);
    ctx.lineTo(w / 2 + 15, midY - 13);
    ctx.lineTo(w / 2 + 15, midY + 13);
    ctx.lineTo(w / 2 + 3, midY + 8);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.72)';
    ctx.shadowBlur = 3;
    ctx.shadowOffsetY = 1.5;
    ctx.fillStyle = disabled ? '#475569' : '#F8FAFC';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const maxTextW = Math.max(60, w - 28);
    let labelPx = 34;
    ctx.font = `700 ${labelPx}px "Chakra Petch", sans-serif`;
    while (labelPx > 22 && ctx.measureText(label).width > maxTextW) {
      labelPx -= 2;
      ctx.font = `700 ${labelPx}px "Chakra Petch", sans-serif`;
    }
    ctx.fillText(label, w / 2, subLabel ? h * 0.42 : h * 0.52, maxTextW);
    ctx.restore();
  }

  if (subLabel) {
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
    ctx.shadowBlur = 2.5;
    ctx.shadowOffsetY = 1;
    ctx.fillStyle = disabled ? '#475569' : active ? '#FDE68A' : accentHex;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const maxSubW = Math.max(60, w - 28);
    ctx.font = '700 22px "JetBrains Mono", monospace';
    ctx.fillText(subLabel, w / 2, h * 0.74, maxSubW);
    ctx.restore();
  }

  // Optional corner badge circle
  if (badgeText) {
    const isVideoBadge = badgeText === '🎬' || badgeText === 'VIDEO';
    ctx.fillStyle = disabled ? '#334155' : isVideoBadge ? '#10B981' : accentHex;
    ctx.beginPath();
    ctx.arc(w - 28, 28, 20, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#090B10';
    if (isVideoBadge) {
      // Draw crisp physical video camera glyph
      traceRoundRect(ctx, w - 38, 21, 13, 14, 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(w - 24, 24);
      ctx.lineTo(w - 18, 20);
      ctx.lineTo(w - 18, 36);
      ctx.lineTo(w - 24, 32);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.font = '700 22px "JetBrains Mono", monospace';
      ctx.fillText(badgeText, w - 28, 29);
    }
  }

  handle.texture.needsUpdate = true;
}

/**
 * Creates a physical 3D mechanical push-button switch with smooth rounded CNC edges
 * and clearcoated physical materials mounted on the workbench
 */
export function create3DControlButton(
  x: number,
  y: number,
  z: number,
  width: number,
  height: number,
  action: Gui3DAction,
  maxAnisotropy: number
): Button3DHandle {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.userData = { guiAction: action };

  const cornerR = Math.min(width, height) * 0.25;

  // 1. Outer rounded steel & brass bezel housing
  const bezelGeo = new RoundedBoxGeometry(
    width + 0.16,
    height + 0.16,
    0.2,
    5,
    Math.min(0.16, cornerR + 0.04)
  );
  const bezelMat = new THREE.MeshPhysicalMaterial({
    color: 0x151b26,
    roughness: 0.28,
    metalness: 0.84,
    clearcoat: 0.35,
    clearcoatRoughness: 0.2,
    envMapIntensity: 1.25,
  });
  const bezelMesh = new THREE.Mesh(bezelGeo, bezelMat);
  bezelMesh.position.z = -0.04;
  bezelMesh.castShadow = true;
  bezelMesh.receiveShadow = true;
  bezelMesh.userData = { guiAction: action };
  group.add(bezelMesh);

  // 2. Depressible 3D tactile rounded plunger cap with satin clearcoat finish
  const capGeo = new RoundedBoxGeometry(
    width,
    height,
    0.24,
    5,
    Math.min(0.14, cornerR)
  );
  const capMat = new THREE.MeshPhysicalMaterial({
    color: 0x2a3448,
    roughness: 0.26,
    metalness: 0.78,
    clearcoat: 0.4,
    clearcoatRoughness: 0.18,
    envMapIntensity: 1.3,
  });
  const capMesh = new THREE.Mesh(capGeo, capMat);
  capMesh.position.z = 0.08;
  capMesh.castShadow = true;
  capMesh.receiveShadow = true;
  capMesh.userData = { guiAction: action };
  group.add(capMesh);

  // 3. Crisp 3x-supersampled rounded-corner top face decal with zero specular glare & toneMapped: false
  const canvas = document.createElement('canvas');
  const aspect = Math.max(1, width / Math.max(0.1, height));
  const logicalW = Math.round(140 * aspect);
  const logicalH = 140;
  const texScale = BUTTON_TEX_SUPERSAMPLE;
  canvas.width = logicalW * texScale;
  canvas.height = logicalH * texScale;
  const texture = configureCrispUITexture(
    new THREE.CanvasTexture(canvas),
    maxAnisotropy
  );

  const topGeo = createRoundedPlaneGeometry(
    width * 0.92,
    height * 0.9,
    cornerR * 0.82,
    14
  );
  const topMat = new THREE.MeshBasicMaterial({
    map: texture,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const topDecalMesh = new THREE.Mesh(topGeo, topMat);
  topDecalMesh.position.z = 0.122;
  topDecalMesh.userData = { guiAction: action };
  capMesh.add(topDecalMesh);

  return {
    group,
    capMesh,
    topDecalMesh,
    canvas,
    logicalW,
    logicalH,
    texScale,
    texture,
    action,
    baseZ: 0.08,
    currZ: 0.08,
    lastCacheKey: '',
  };
}

/**
 * Creates the 3D Rounded Digital Score & Level Readout Plaque mounted on the top-left of the workbench
 */
export function create3DReadoutPlaque(maxAnisotropy: number) {
  const group = new THREE.Group();
  group.position.set(-3.45, 3.65, 0.06);

  // Polished rounded brass outer bezel
  const rimGeo = new RoundedBoxGeometry(2.78, 1.06, 0.24, 5, 0.16);
  const rimMat = new THREE.MeshPhysicalMaterial({
    color: 0xe0a234,
    roughness: 0.24,
    metalness: 0.86,
    clearcoat: 0.4,
    clearcoatRoughness: 0.18,
    envMapIntensity: 1.35,
  });
  const rim = new THREE.Mesh(rimGeo, rimMat);
  rim.position.z = -0.02;
  rim.castShadow = true;
  group.add(rim);

  // Brushed titanium inner housing with rounded edges
  const housingGeo = new RoundedBoxGeometry(2.64, 0.94, 0.28, 5, 0.14);
  const housingMat = new THREE.MeshPhysicalMaterial({
    color: 0x1a2130,
    roughness: 0.28,
    metalness: 0.82,
    clearcoat: 0.35,
    clearcoatRoughness: 0.2,
    envMapIntensity: 1.25,
  });
  const housing = new THREE.Mesh(housingGeo, housingMat);
  housing.castShadow = true;
  group.add(housing);

  const canvas = document.createElement('canvas');
  canvas.width = 512 * UI_TEX_SUPERSAMPLE;
  canvas.height = 176 * UI_TEX_SUPERSAMPLE;
  const texture = configureCrispUITexture(
    new THREE.CanvasTexture(canvas),
    maxAnisotropy
  );

  const screenGeo = createRoundedPlaneGeometry(2.48, 0.8, 0.11, 16);
  const screenMat = new THREE.MeshBasicMaterial({
    map: texture,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  const screen = new THREE.Mesh(screenGeo, screenMat);
  screen.position.z = 0.144;
  group.add(screen);

  let lastKey = '';
  function update(
    levelIndex: number,
    score: number,
    boltsLeft: number,
    difficultyFill = 0.18,
    difficultyAccentHex = '#38BDF8',
    difficultyTierLabel = 'TORQ I',
    levelName = ''
  ) {
    const levelNum = levelIndex + 1;
    const clampedFill = Math.max(0.12, Math.min(1.0, difficultyFill));
    const fillQuantized = Math.round(clampedFill * 100);
    const objectTitle = levelName
      .replace(/^Level\s+\d+\s*[:·-]?\s*/i, '')
      .replace(/^\d+\.\s*/, '')
      .trim()
      .toUpperCase();

    const key = `${levelNum}|${Math.round(score)}|${boltsLeft}|${fillQuantized}|${difficultyAccentHex}|${difficultyTierLabel}|${objectTitle}`;
    if (key === lastKey) return;
    lastKey = key;

    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(UI_TEX_SUPERSAMPLE, 0, 0, UI_TEX_SUPERSAMPLE, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.clearRect(0, 0, 512, 176);

    const bgGrad = ctx.createLinearGradient(0, 0, 0, 176);
    bgGrad.addColorStop(0, '#161E2E');
    bgGrad.addColorStop(1, '#0B0F18');
    traceRoundRect(ctx, 2, 2, 508, 172, 26);
    ctx.fillStyle = bgGrad;
    ctx.fill();

    traceRoundRect(ctx, 7, 7, 498, 162, 22);
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.55)';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Column dividers for top readout section
    ctx.fillStyle = 'rgba(148, 163, 184, 0.2)';
    ctx.fillRect(142, 18, 3, 94);
    ctx.fillRect(346, 18, 3, 94);

    // 1. Progressive Level Counter
    ctx.fillStyle = '#94A3B8';
    ctx.font = '700 19px "Chakra Petch", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('LEVEL', 74, 38);
    ctx.fillStyle = '#F8FAFC';
    ctx.font = '700 46px "JetBrains Mono", monospace';
    const lvlStr = levelNum < 10 ? `0${levelNum}` : `${levelNum}`;
    ctx.fillText(lvlStr, 74, 96);

    // 2. Score
    ctx.fillStyle = '#F59E0B';
    ctx.font = '700 19px "Chakra Petch", sans-serif';
    ctx.fillText('SCORE', 244, 38);
    ctx.fillStyle = '#FDE047';
    ctx.font = '700 44px "JetBrains Mono", monospace';
    ctx.fillText(`${Math.round(score)}`, 244, 96);

    // 3. Bolts Left
    ctx.fillStyle = '#38BDF8';
    ctx.font = '700 19px "Chakra Petch", sans-serif';
    ctx.fillText('BOLTS', 428, 38);
    ctx.fillStyle = '#F8FAFC';
    ctx.font = '700 46px "JetBrains Mono", monospace';
    ctx.fillText(`${boltsLeft}`, 428, 96);

    // 4. Horizontal Separator & Object Title + Difficulty Gauge Strip (y = 116..162)
    ctx.fillStyle = 'rgba(148, 163, 184, 0.16)';
    ctx.fillRect(20, 116, 472, 2);

    if (objectTitle) {
      ctx.fillStyle = '#FDE047';
      ctx.font = '700 18px "Chakra Petch", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`⚙ ${objectTitle}`, 24, 146, 252);

      // Compact Recessed Difficulty Gauge Track on right
      const trackX = 290;
      const trackY = 129;
      const trackW = 136;
      const trackH = 20;
      traceRoundRect(ctx, trackX, trackY, trackW, trackH, 8);
      ctx.fillStyle = '#070A10';
      ctx.fill();
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.32)';
      ctx.lineWidth = 2;
      ctx.stroke();

      const fillW = Math.max(12, Math.round((trackW - 6) * clampedFill));
      const barGrad = ctx.createLinearGradient(trackX + 3, 0, trackX + trackW - 3, 0);
      barGrad.addColorStop(0, '#38BDF8');
      barGrad.addColorStop(0.42, '#10B981');
      barGrad.addColorStop(0.74, '#F59E0B');
      barGrad.addColorStop(1.0, '#EF4444');

      ctx.save();
      traceRoundRect(ctx, trackX + 3, trackY + 3, fillW, trackH - 6, 5);
      ctx.clip();
      ctx.fillStyle = barGrad;
      ctx.fillRect(trackX + 3, trackY + 3, trackW - 6, trackH - 6);
      ctx.restore();

      ctx.fillStyle = difficultyAccentHex;
      ctx.font = '700 16px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${fillQuantized}%`, 486, 146);
    } else {
      ctx.fillStyle = '#94A3B8';
      ctx.font = '700 16px "Chakra Petch", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('DIFF', 26, 146);

      const trackX = 82;
      const trackY = 129;
      const trackW = 336;
      const trackH = 20;
      traceRoundRect(ctx, trackX, trackY, trackW, trackH, 8);
      ctx.fillStyle = '#070A10';
      ctx.fill();
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.32)';
      ctx.lineWidth = 2;
      ctx.stroke();

      const fillW = Math.max(16, Math.round((trackW - 6) * clampedFill));
      const barGrad = ctx.createLinearGradient(trackX + 3, 0, trackX + trackW - 3, 0);
      barGrad.addColorStop(0, '#38BDF8');
      barGrad.addColorStop(0.42, '#10B981');
      barGrad.addColorStop(0.74, '#F59E0B');
      barGrad.addColorStop(1.0, '#EF4444');

      ctx.save();
      traceRoundRect(ctx, trackX + 3, trackY + 3, fillW, trackH - 6, 5);
      ctx.clip();
      ctx.fillStyle = barGrad;
      ctx.fillRect(trackX + 3, trackY + 3, trackW - 6, trackH - 6);
      ctx.restore();

      ctx.fillStyle = difficultyAccentHex;
      ctx.font = '700 16px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${fillQuantized}%`, 486, 146);
    }

    texture.needsUpdate = true;
  }

  function invalidateCache() {
    lastKey = '';
  }

  return { group, update, invalidateCache };
}

interface BannerPlaqueSurface {
  group: THREE.Group;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
  canvasW: number;
  canvasH: number;
}

/**
 * Shared machined brass + dark anodized titanium 3D banner plaque builder
 * used by floating workbench notification plates (FTUE hints, tool unlock badges).
 */
function create3DBannerPlaque(options: {
  width: number;
  height: number;
  depth: number;
  cornerRadius: number;
  rimHex: number;
  canvasW: number;
  canvasH: number;
  maxAnisotropy: number;
}): BannerPlaqueSurface {
  const { width, height, depth, cornerRadius, rimHex, canvasW, canvasH, maxAnisotropy } = options;
  const group = new THREE.Group();

  // Polished chamfered metallic outer bezel
  const rimGeo = new RoundedBoxGeometry(width, height, depth, 5, cornerRadius);
  const rimMat = new THREE.MeshPhysicalMaterial({
    color: rimHex,
    roughness: 0.22,
    metalness: 0.88,
    clearcoat: 0.45,
    clearcoatRoughness: 0.16,
    envMapIntensity: 1.35,
  });
  const rim = new THREE.Mesh(rimGeo, rimMat);
  rim.position.z = -0.015;
  rim.castShadow = true;
  group.add(rim);

  // Dark anodized titanium inner core
  const innerGeo = new RoundedBoxGeometry(
    width - 0.12,
    height - 0.1,
    depth + 0.035,
    5,
    Math.max(0.05, cornerRadius - 0.03)
  );
  const innerMat = new THREE.MeshPhysicalMaterial({
    color: 0x18202f,
    roughness: 0.28,
    metalness: 0.82,
    clearcoat: 0.35,
    clearcoatRoughness: 0.2,
    envMapIntensity: 1.25,
  });
  const inner = new THREE.Mesh(innerGeo, innerMat);
  inner.castShadow = true;
  group.add(inner);

  // Machined brass corner hex rivets on left & right wings
  const studGeo = new THREE.CylinderGeometry(0.032, 0.032, 0.03, 6);
  studGeo.rotateX(Math.PI / 2);
  const studMat = new THREE.MeshStandardMaterial({
    color: 0xe5a93c,
    roughness: 0.22,
    metalness: 0.92,
  });
  const sxOff = width * 0.5 - 0.13;
  const syOff = height * 0.5 - 0.12;
  for (const [sx, sy] of [
    [-sxOff, syOff],
    [sxOff, syOff],
    [-sxOff, -syOff],
    [sxOff, -syOff],
  ]) {
    const stud = new THREE.Mesh(studGeo, studMat);
    stud.position.set(sx, sy, depth * 0.5 + 0.016);
    group.add(stud);
  }

  const canvas = document.createElement('canvas');
  canvas.width = canvasW * UI_TEX_SUPERSAMPLE;
  canvas.height = canvasH * UI_TEX_SUPERSAMPLE;
  const ctx = canvas.getContext('2d')!;
  const texture = configureCrispUITexture(
    new THREE.CanvasTexture(canvas),
    maxAnisotropy
  );

  const screenGeo = createRoundedPlaneGeometry(
    width - 0.26,
    height - 0.18,
    Math.max(0.05, cornerRadius - 0.05),
    16
  );
  const screenMat = new THREE.MeshBasicMaterial({
    map: texture,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  const screen = new THREE.Mesh(screenGeo, screenMat);
  screen.position.z = depth * 0.5 + 0.022;
  group.add(screen);

  return { group, canvas, ctx, texture, canvasW, canvasH };
}

function drawBannerBasePlate(
  surface: BannerPlaqueSurface,
  accentHex: string
): void {
  const { ctx, canvasW: w, canvasH: h } = surface;
  ctx.setTransform(UI_TEX_SUPERSAMPLE, 0, 0, UI_TEX_SUPERSAMPLE, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.clearRect(0, 0, w, h);

  const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
  bgGrad.addColorStop(0, '#161F31');
  bgGrad.addColorStop(1, '#0A0E17');
  traceRoundRect(ctx, 2, 2, w - 4, h - 4, 24);
  ctx.fillStyle = bgGrad;
  ctx.fill();

  const sheenGrad = ctx.createLinearGradient(0, 4, 0, h * 0.48);
  sheenGrad.addColorStop(0, 'rgba(255, 255, 255, 0.12)');
  sheenGrad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
  traceRoundRect(ctx, 8, 5, w - 16, h * 0.44, 18);
  ctx.fillStyle = sheenGrad;
  ctx.fill();

  traceRoundRect(ctx, 6, 6, w - 12, h - 12, 20);
  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 3.5;
  ctx.stroke();
}

/**
 * 3D Diegetic Contextual FTUE Hint Plaque mounted above the bottom power-up deck
 * (replaces flat 2D CSS hint pill with a brass/titanium workbench OLED strip).
 */
export function create3DFtueHintPlinth(maxAnisotropy: number) {
  const surface = create3DBannerPlaque({
    width: 6.1,
    height: 0.52,
    depth: 0.14,
    cornerRadius: 0.13,
    rimHex: 0xe0a234,
    canvasW: 1024,
    canvasH: 88,
    maxAnisotropy,
  });
  surface.group.visible = false;

  let lastKey = '';
  function update(hintText: string | null) {
    if (!hintText) return;
    const key = hintText.trim();
    if (key === lastKey) return;
    lastKey = key;

    const { ctx, canvasW: w, canvasH: h, texture } = surface;
    const isObjectBrief = /^OBJECT:/i.test(key);
    const displayCopy = isObjectBrief ? key.replace(/^OBJECT:\s*/i, '') : key;
    drawBannerBasePlate(
      surface,
      isObjectBrief ? 'rgba(56, 189, 248, 0.7)' : 'rgba(245, 158, 11, 0.65)'
    );

    // Left badge pill (OBJECT or GUIDE)
    traceRoundRect(ctx, 18, 18, 114, h - 36, 14);
    ctx.fillStyle = isObjectBrief
      ? 'rgba(56, 189, 248, 0.22)'
      : 'rgba(245, 158, 11, 0.22)';
    ctx.fill();
    ctx.strokeStyle = isObjectBrief ? '#38BDF8' : '#F59E0B';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.fillStyle = isObjectBrief ? '#BAE6FD' : '#FDE68A';
    ctx.font = '700 19px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(isObjectBrief ? 'OBJECT' : 'GUIDE', 75, h / 2 + 1);

    // Centered instruction copy with safe horizontal clamping
    const textCenterX = 142 + (w - 162) / 2;
    const maxCopyW = w - 174;
    let px = 29;
    ctx.font = `600 ${px}px "Chakra Petch", "Plus Jakarta Sans", sans-serif`;
    while (px > 19 && ctx.measureText(displayCopy).width > maxCopyW) {
      px -= 2;
      ctx.font = `600 ${px}px "Chakra Petch", "Plus Jakarta Sans", sans-serif`;
    }
    ctx.fillStyle = '#F8FAFC';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(displayCopy, textCenterX, h / 2 + 1, maxCopyW);

    texture.needsUpdate = true;
  }

  function invalidateCache() {
    lastKey = '';
  }

  return { group: surface.group, update, invalidateCache };
}

/**
 * 3D Diegetic New-Tool Unlock Toast Plaque displayed at the top center workbench rail.
 */
export function create3DNewToolPlaque(maxAnisotropy: number) {
  const surface = create3DBannerPlaque({
    width: 6.1,
    height: 0.54,
    depth: 0.14,
    cornerRadius: 0.13,
    rimHex: 0x10b981,
    canvasW: 1024,
    canvasH: 96,
    maxAnisotropy,
  });
  surface.group.visible = false;

  let lastKey = '';
  function update(toast: NewToolAnnouncement | null) {
    if (!toast) return;
    const key = `${toast.key}|${toast.title}|${toast.subtitle}`;
    if (key === lastKey) return;
    lastKey = key;

    const { ctx, canvasW: w, canvasH: h, texture } = surface;
    drawBannerBasePlate(surface, '#10B981');

    // Left emerald badge pill
    traceRoundRect(ctx, 18, 18, 168, h - 36, 14);
    ctx.fillStyle = 'rgba(16, 185, 129, 0.24)';
    ctx.fill();
    ctx.strokeStyle = '#34D399';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.fillStyle = '#6EE7B7';
    ctx.font = '700 20px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('NEW TOOL', 102, h / 2 + 1);

    const cleanTitle = toast.title.replace(/^NEW TOOL:\s*/i, '').trim().toUpperCase();
    const headline = `${cleanTitle} — ${toast.subtitle}`;
    const textCenterX = 200 + (w - 220) / 2;
    const maxCopyW = w - 232;
    let px = 30;
    ctx.font = `700 ${px}px "Chakra Petch", sans-serif`;
    while (px > 20 && ctx.measureText(headline).width > maxCopyW) {
      px -= 2;
      ctx.font = `700 ${px}px "Chakra Petch", sans-serif`;
    }
    ctx.fillStyle = '#F8FAFC';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(headline, textCenterX, h / 2 + 1, maxCopyW);

    texture.needsUpdate = true;
  }

  function invalidateCache() {
    lastKey = '';
  }

  return { group: surface.group, update, invalidateCache };
}

/**
 * Creates a 3D Rounded Anodized Target Collector Box on the top workbench shelf (holds 3 bolts in 3D sockets)
 */
export function create3DTargetBoxTray(slotIndex: number): {
  group: THREE.Group;
  setColor: (color: ScrewColor, visible: boolean) => void;
  getSocketWorldPos: (socketIdx: number) => { x: number; y: number; z: number };
} {
  const baseX = slotIndex === 0 ? -0.95 : 1.05;
  const baseY = 3.65;
  const group = new THREE.Group();
  group.position.set(baseX, baseY, 0.06);

  // Outer rounded anodized aluminum tray hull with balanced satin clearcoat
  const hullGeo = new RoundedBoxGeometry(1.92, 0.9, 0.3, 5, 0.16);
  const hullMat = new THREE.MeshPhysicalMaterial({
    color: 0xf59e0b,
    roughness: 0.26,
    metalness: 0.78,
    clearcoat: 0.4,
    clearcoatRoughness: 0.2,
    envMapIntensity: 1.25,
  });
  const hull = new THREE.Mesh(hullGeo, hullMat);
  hull.castShadow = true;
  hull.receiveShadow = true;
  group.add(hull);

  // Rounded dark recessed cradle block
  const innerGeo = new RoundedBoxGeometry(1.72, 0.68, 0.18, 4, 0.11);
  const innerMat = new THREE.MeshPhysicalMaterial({
    color: 0x0c111d,
    roughness: 0.55,
    metalness: 0.35,
    clearcoat: 0.15,
  });
  const inner = new THREE.Mesh(innerGeo, innerMat);
  inner.position.z = 0.085;
  group.add(inner);

  // 3 polished chamfered socket rings
  const ringGeo = new THREE.TorusGeometry(0.22, 0.04, 16, 32);
  const ringMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.24,
    metalness: 0.84,
    clearcoat: 0.4,
    envMapIntensity: 1.3,
  });
  const holeGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.08, 24);
  holeGeo.rotateX(Math.PI / 2);
  const holeMat = new THREE.MeshBasicMaterial({ color: 0x05070b });

  for (let i = 0; i < 3; i++) {
    const sx = -0.54 + i * 0.54;
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(sx, 0, 0.175);
    group.add(ring);

    const hole = new THREE.Mesh(holeGeo, holeMat);
    hole.position.set(sx, 0, 0.14);
    group.add(hole);
  }

  let currentColor: ScrewColor | null = null;
  function setColor(color: ScrewColor, visible: boolean) {
    group.visible = visible;
    if (!visible) return;
    if (currentColor !== color) {
      currentColor = color;
      const meta = SCREW_COLOR_META[color];
      hullMat.color.set(meta.hex);
      ringMat.color.set(meta.accentHex);
    }
  }

  function getSocketWorldPos(socketIdx: number) {
    const sx = (-0.54 + (socketIdx % 3) * 0.54) * group.scale.x;
    return {
      x: group.position.x + sx,
      y: group.position.y,
      z: 0.19,
    };
  }

  return { group, setColor, getSocketWorldPos };
}

/**
 * Builds the 3D Rounded CNC Unibody Modal / Title Plinth that drops in over the workbench during
 * 'title', 'paused', 'gameover', or Sound Settings Console states so 100% of menus are rounded 3D objects in the scene!
 */
export function create3DDiegeticModalStage(maxAnisotropy: number) {
  const root = new THREE.Group();
  root.position.set(0, 0.2, 2.2);

  // 1. Polished rounded brass outer frame around the 3D tablet
  const frameGeo = new RoundedBoxGeometry(5.88, 3.68, 0.26, 6, 0.28);
  const frameMat = new THREE.MeshPhysicalMaterial({
    color: 0xe0a234,
    roughness: 0.24,
    metalness: 0.86,
    clearcoat: 0.42,
    clearcoatRoughness: 0.18,
    envMapIntensity: 1.35,
  });
  const frameMesh = new THREE.Mesh(frameGeo, frameMat);
  frameMesh.position.set(0, 0.65, -0.03);
  frameMesh.castShadow = true;
  root.add(frameMesh);

  // 2. Main 3D Rounded Brushed Titanium Display Tablet
  const boardGeo = new RoundedBoxGeometry(5.64, 3.44, 0.3, 6, 0.24);
  const boardMat = new THREE.MeshPhysicalMaterial({
    color: 0x161d2b,
    roughness: 0.28,
    metalness: 0.82,
    clearcoat: 0.38,
    clearcoatRoughness: 0.2,
    envMapIntensity: 1.25,
  });
  const boardMesh = new THREE.Mesh(boardGeo, boardMat);
  boardMesh.position.set(0, 0.65, 0);
  boardMesh.castShadow = true;
  root.add(boardMesh);

  // 4 Decorative CNC corner hex bolts on the modal bezel
  const studGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.06, 6);
  studGeo.rotateX(Math.PI / 2);
  const studMat = new THREE.MeshPhysicalMaterial({
    color: 0xe0a234,
    roughness: 0.24,
    metalness: 0.86,
    clearcoat: 0.4,
  });
  const studOffsets = [
    [-2.58, 2.12],
    [2.58, 2.12],
    [-2.58, -0.82],
    [2.58, -0.82],
  ];
  for (const [sx, sy] of studOffsets) {
    const stud = new THREE.Mesh(studGeo, studMat);
    stud.position.set(sx, sy, 0.16);
    root.add(stud);
  }

  // Rounded-corner 2x-supersampled anti-glare OLED screen on the 3D tablet
  const screenCanvas = document.createElement('canvas');
  screenCanvas.width = 768 * UI_TEX_SUPERSAMPLE;
  screenCanvas.height = 460 * UI_TEX_SUPERSAMPLE;
  const screenTex = configureCrispUITexture(
    new THREE.CanvasTexture(screenCanvas),
    maxAnisotropy
  );

  const screenGeo = createRoundedPlaneGeometry(5.34, 3.16, 0.2, 18);
  const screenMat = new THREE.MeshBasicMaterial({
    map: screenTex,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  const screenMesh = new THREE.Mesh(screenGeo, screenMat);
  screenMesh.position.set(0, 0.65, 0.154);
  root.add(screenMesh);

  // 3. Primary 3D Rounded Action Bar Button (PLAY / RETRY / RESUME)
  const primaryBtn = create3DControlButton(
    0,
    -1.65,
    0.12,
    3.6,
    0.78,
    { type: 'start_game' },
    maxAnisotropy
  );
  root.add(primaryBtn.group);

  // 3b. 3 Dedicated 3D Mechanical Soundscape Pack Toggle Buttons (visible when Sound Settings Menu is open!)
  const packBtns: Button3DHandle[] = SOUNDSCAPE_PACK_ORDER.map((packId, idx) => {
    const px = -1.86 + idx * 1.86;
    const btn = create3DControlButton(
      px,
      -1.62,
      0.12,
      1.64,
      0.74,
      { type: 'select_sound_pack', packId },
      maxAnisotropy
    );
    // Attach an invisible raycast hit plane covering the corresponding Pack Card column on the 3D OLED display above!
    const cardHitGeo = new THREE.BoxGeometry(1.66, 2.24, 0.16);
    const cardHitMat = new THREE.MeshBasicMaterial({ visible: false });
    const cardHitMesh = new THREE.Mesh(cardHitGeo, cardHitMat);
    cardHitMesh.position.set(0, 2.18, 0.08);
    cardHitMesh.userData = { guiAction: { type: 'select_sound_pack', packId } };
    btn.group.add(cardHitMesh);
    btn.group.visible = false;
    root.add(btn.group);
    return btn;
  });

  // 3c. Dual Split 3D Action Buttons (Save Progress / Later on PGS Prompt)
  const splitLeftBtn = create3DControlButton(
    -1.32,
    -1.65,
    0.12,
    2.48,
    0.78,
    { type: 'pgs_save_prompt' },
    maxAnisotropy
  );
  splitLeftBtn.group.visible = false;
  root.add(splitLeftBtn.group);

  const splitRightBtn = create3DControlButton(
    1.32,
    -1.65,
    0.12,
    2.48,
    0.78,
    { type: 'pgs_later_prompt' },
    maxAnisotropy
  );
  splitRightBtn.group.visible = false;
  root.add(splitRightBtn.group);

  // 3d. Triple 3D Conflict Resolution Buttons (Smart Merge / Keep Cloud / Keep Device)
  const conflictChoices: Array<'smart_merge' | 'keep_cloud' | 'keep_local'> = [
    'smart_merge',
    'keep_cloud',
    'keep_local',
  ];
  const conflictBtns: Button3DHandle[] = conflictChoices.map((choice, idx) => {
    const cx = -1.86 + idx * 1.86;
    const btn = create3DControlButton(
      cx,
      -1.65,
      0.12,
      1.7,
      0.78,
      { type: 'resolve_conflict', choice },
      maxAnisotropy
    );
    btn.group.visible = false;
    root.add(btn.group);
    return btn;
  });

  // 4. Secondary 3D Rounded Action Buttons
  const stageBtns: Button3DHandle[] = [];
  for (let i = 0; i < 6; i++) {
    const sx = -2.25 + i * 0.9;
    const btn = create3DControlButton(
      sx,
      -2.62,
      0.1,
      0.76,
      0.66,
      { type: 'start_game' },
      maxAnisotropy
    );
    root.add(btn.group);
    stageBtns.push(btn);
  }

  let lastScreenKey = '';

  function setButtonAction(btn: Button3DHandle, action: Gui3DAction) {
    btn.action = action;
    btn.group.userData.guiAction = action;
    btn.capMesh.userData.guiAction = action;
    btn.topDecalMesh.userData.guiAction = action;
  }

  function updateModal3D(
    phase: GamePhase,
    board: BoardState,
    bestScore: number,
    runSnapshot: RunSnapshot | null,
    dayStreak?: DayStreakState,
    soundSettingsOpen = false,
    soundState?: SoundSettingsState,
    options?: {
      showStreakCard?: boolean;
      cloudConnected?: boolean;
      overlayModal?: ModalOverlay3DState;
    }
  ) {
    const overlayModal: ModalOverlay3DState = options?.overlayModal ?? { kind: 'none' };
    if (phase === 'playing' && !soundSettingsOpen && overlayModal.kind === 'none') {
      return;
    }
    const showStreakCard = options?.showStreakCard ?? true;
    const cloudConnected = options?.cloudConnected ?? false;

    const currLevelNum = board.levelIndex + 1;
    const lvlBadge = currLevelNum < 10 ? `0${currLevelNum}` : `${currLevelNum}`;
    const activePack = soundState?.activePack ?? 'industrial';
    const activePackMeta =
      SOUNDSCAPE_PACKS[activePack] ?? SOUNDSCAPE_PACKS.industrial;
    const isMuted = soundState?.muted ?? false;
    const volPct = soundState?.volumePercent ?? 85;

    splitLeftBtn.group.visible = false;
    splitRightBtn.group.visible = false;
    for (const cb of conflictBtns) {
      cb.group.visible = false;
    }

    if (overlayModal.kind === 'session_recap') {
      primaryBtn.group.visible = true;
      for (const pb of packBtns) pb.group.visible = false;
      for (const sb of stageBtns) sb.group.visible = false;

      setButtonAction(primaryBtn, { type: 'close_session_recap' });
      updateButton3DCapTexture(
        primaryBtn,
        `▶ KEEP PLAYING`,
        `ENTER LEVEL ${overlayModal.levelNumber < 10 ? `0${overlayModal.levelNumber}` : overlayModal.levelNumber}`,
        '#10B981',
        undefined,
        true,
        false
      );
    } else if (overlayModal.kind === 'cloud_conflict') {
      primaryBtn.group.visible = false;
      for (const pb of packBtns) pb.group.visible = false;
      for (const sb of stageBtns) sb.group.visible = false;

      const cloudLvl = (overlayModal.cloud.levelIndex ?? 0) + 1;
      const localLvl = (overlayModal.local.levelIndex ?? 0) + 1;

      conflictBtns[0].group.visible = true;
      setButtonAction(conflictBtns[0], { type: 'resolve_conflict', choice: 'smart_merge' });
      updateButton3DCapTexture(
        conflictBtns[0],
        '★ SMART MERGE',
        'BEST PROGRESS',
        '#10B981',
        undefined,
        true,
        false
      );

      conflictBtns[1].group.visible = true;
      setButtonAction(conflictBtns[1], { type: 'resolve_conflict', choice: 'keep_cloud' });
      updateButton3DCapTexture(
        conflictBtns[1],
        '☁ CLOUD',
        `LEVEL ${cloudLvl}`,
        '#38BDF8',
        undefined,
        false,
        false
      );

      conflictBtns[2].group.visible = true;
      setButtonAction(conflictBtns[2], { type: 'resolve_conflict', choice: 'keep_local' });
      updateButton3DCapTexture(
        conflictBtns[2],
        '📱 DEVICE',
        `LEVEL ${localLvl}`,
        '#F59E0B',
        undefined,
        false,
        false
      );
    } else if (soundSettingsOpen) {
      primaryBtn.group.visible = false;

      const packIcons: Record<SoundscapePackId, string> = {
        industrial: '⚙ IND',
        cybernetic: '⚡ CYB',
        clockwork: '⌚ CLK',
      };
      const packSubLabels: Record<SoundscapePackId, string> = {
        industrial: 'FACTORY',
        cybernetic: 'TECH',
        clockwork: 'CLOCKWORK',
      };

      SOUNDSCAPE_PACK_ORDER.forEach((packId, idx) => {
        const btn = packBtns[idx];
        const meta = SOUNDSCAPE_PACKS[packId];
        const isSelected = activePack === packId;
        btn.group.visible = true;
        setButtonAction(btn, { type: 'select_sound_pack', packId });
        updateButton3DCapTexture(
          btn,
          packIcons[packId],
          packSubLabels[packId],
          meta.accentHex,
          isSelected ? 'ON' : `${idx + 1}`,
          isSelected,
          false
        );
      });

      // Configure bottom control strip: [0] MUTE, [1] VOL, [2] TEST, [3] CYCLE PACK, [5] DONE
      for (let i = 0; i < 6; i++) {
        const sb = stageBtns[i];
        sb.group.position.x = -2.25 + i * 0.9;
        if (i === 0) {
          sb.group.visible = true;
          setButtonAction(sb, { type: 'toggle_mute' });
          updateButton3DCapTexture(
            sb,
            isMuted ? '🔇' : '🔊',
            isMuted ? 'OFF' : 'ON',
            '#F59E0B',
            undefined,
            !isMuted,
            false
          );
        } else if (i === 1) {
          sb.group.visible = true;
          setButtonAction(sb, { type: 'cycle_volume' });
          updateButton3DCapTexture(
            sb,
            'VOL',
            `${volPct}%`,
            '#38BDF8',
            undefined,
            false,
            false
          );
        } else if (i === 2) {
          sb.group.visible = true;
          setButtonAction(sb, { type: 'test_sound_pack' });
          updateButton3DCapTexture(
            sb,
            '♪',
            'TEST',
            activePackMeta.accentHex,
            undefined,
            false,
            false
          );
        } else if (i === 3) {
          sb.group.visible = true;
          setButtonAction(sb, { type: 'cycle_sound_pack' });
          updateButton3DCapTexture(
            sb,
            '⇄',
            'PACK',
            '#10B981',
            undefined,
            false,
            false
          );
        } else if (i === 5) {
          sb.group.visible = true;
          setButtonAction(sb, { type: 'close_sound_settings' });
          updateButton3DCapTexture(
            sb,
            '✓',
            'DONE',
            '#10B981',
            undefined,
            true,
            false
          );
        } else {
          sb.group.visible = false;
        }
      }
    } else {
      primaryBtn.group.visible = true;
      for (const pb of packBtns) {
        pb.group.visible = false;
      }

      // Update 3D buttons based on phase (shows current level counter, no previous level selector, never says "Endless")
      if (phase === 'title') {
        setButtonAction(primaryBtn, {
          type: 'start_game',
          levelIdx: board.levelIndex,
        });
        updateButton3DCapTexture(
          primaryBtn,
          `▶ PLAY · LEVEL ${lvlBadge}`,
          'START WORKBENCH',
          '#F59E0B',
          undefined,
          true,
          false
        );

        for (let i = 0; i < 6; i++) {
          stageBtns[i].group.position.x = -2.25 + i * 0.9;
          if (i === 4 && showStreakCard && !dayStreak?.isDoubled) {
            stageBtns[i].group.visible = true;
            setButtonAction(stageBtns[i], { type: 'double_streak_ad' });
            updateButton3DCapTexture(
              stageBtns[i],
              '2X',
              'STREAK',
              '#10B981',
              '▶'
            );
          } else if (i === 5) {
            stageBtns[i].group.visible = true;
            setButtonAction(stageBtns[i], { type: 'open_sound_settings' });
            updateButton3DCapTexture(
              stageBtns[i],
              '♫',
              activePackMeta.shortCode,
              activePackMeta.accentHex
            );
          } else {
            stageBtns[i].group.visible = false;
          }
        }
      } else if (phase === 'paused') {
        setButtonAction(primaryBtn, { type: 'pause_toggle' });
        updateButton3DCapTexture(
          primaryBtn,
          '▶ RESUME',
          'CONTINUE PUZZLE',
          '#10B981',
          undefined,
          true,
          false
        );

        const pausePositions = [-1.35, -0.45, 0.45, 1.35];
        for (let i = 0; i < 6; i++) {
          if (i < 4) {
            stageBtns[i].group.visible = true;
            stageBtns[i].group.position.x = pausePositions[i];
          } else {
            stageBtns[i].group.visible = false;
          }
          if (i === 0) {
            setButtonAction(stageBtns[i], { type: 'toggle_mute' });
            updateButton3DCapTexture(
              stageBtns[i],
              isMuted ? 'MUTE' : 'AUDIO',
              isMuted ? 'OFF' : 'ON',
              '#F59E0B',
              undefined,
              !isMuted
            );
          } else if (i === 1) {
            setButtonAction(stageBtns[i], { type: 'open_sound_settings' });
            updateButton3DCapTexture(
              stageBtns[i],
              '♫',
              activePackMeta.shortCode,
              activePackMeta.accentHex
            );
          } else if (i === 2) {
            setButtonAction(stageBtns[i], { type: 'restart_level' });
            updateButton3DCapTexture(stageBtns[i], '↻', 'RETRY', '#F59E0B');
          } else if (i === 3) {
            setButtonAction(stageBtns[i], { type: 'return_title' });
            updateButton3DCapTexture(stageBtns[i], '⌂', 'HOME', '#38BDF8');
          }
        }
      } else if (phase === 'gameover' && runSnapshot) {
        const snapLvl = runSnapshot.levelIndex + 1;
        const snapBadge = snapLvl < 10 ? `0${snapLvl}` : `${snapLvl}`;
        // Primary button is the high-value Rewarded Second Chance REVIVE!
        setButtonAction(primaryBtn, {
          type: 'revive_ad',
        });
        updateButton3DCapTexture(
          primaryBtn,
          '⚡ REVIVE · ▶ AD',
          'WATCH AD: CLEAR 2 BOLTS + SLOT',
          '#10B981',
          undefined,
          true,
          false
        );

        for (let i = 0; i < 6; i++) {
          stageBtns[i].group.position.x = -2.25 + i * 0.9;
          if (i === 1) {
            stageBtns[i].group.visible = true;
            setButtonAction(stageBtns[i], {
              type: 'start_game',
              levelIdx: runSnapshot.levelIndex,
            });
            updateButton3DCapTexture(stageBtns[i], '↻', 'RETRY', '#F59E0B');
          } else if (i === 2) {
            stageBtns[i].group.visible = true;
            setButtonAction(stageBtns[i], { type: 'open_sound_settings' });
            updateButton3DCapTexture(
              stageBtns[i],
              '♫',
              activePackMeta.shortCode,
              activePackMeta.accentHex
            );
          } else if (i === 3) {
            stageBtns[i].group.visible = true;
            setButtonAction(stageBtns[i], { type: 'return_title' });
            updateButton3DCapTexture(stageBtns[i], '⌂', 'HOME', '#38BDF8');
          } else {
            stageBtns[i].group.visible = false;
          }
        }
      }
    }

    // Update 3D Rounded Tablet Screen Canvas
    const streakCount = dayStreak?.currentStreak ?? 1;
    const streakTier = dayStreak?.rewardLabel ?? 'IGNITION +100 PTS';
    const streakAccent = dayStreak?.accentHex ?? '#F59E0B';
    const overlayKey =
      overlayModal.kind === 'session_recap'
        ? `recap|${overlayModal.levelNumber}|${Math.round(overlayModal.score)}|${overlayModal.maxCombo}`
        : overlayModal.kind === 'cloud_conflict'
          ? `conflict|${overlayModal.cloud.levelIndex}|${overlayModal.cloud.cumulativeScore}|${overlayModal.local.levelIndex}|${overlayModal.local.cumulativeScore}`
          : 'none';
    const screenKey = `${overlayKey}|${phase}|${soundSettingsOpen}|${activePack}|${isMuted}|${volPct}|${board.levelIndex}|${Math.round(board.score)}|${Math.round(bestScore)}|${runSnapshot?.outcome ?? ''}|${runSnapshot?.score ?? 0}|${streakCount}|${streakTier}|${showStreakCard}|${cloudConnected}`;
    if (screenKey === lastScreenKey) return;
    lastScreenKey = screenKey;

    const ctx = screenCanvas.getContext('2d')!;
    ctx.setTransform(UI_TEX_SUPERSAMPLE, 0, 0, UI_TEX_SUPERSAMPLE, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.clearRect(0, 0, 768, 460);

    const screenGrad = ctx.createRadialGradient(384, 140, 40, 384, 230, 460);
    screenGrad.addColorStop(0, '#172033');
    screenGrad.addColorStop(1, '#090D16');
    traceRoundRect(ctx, 2, 2, 764, 456, 36);
    ctx.fillStyle = screenGrad;
    ctx.fill();

    // Top studio glass reflection arc
    const glassGrad = ctx.createLinearGradient(0, 6, 0, 180);
    glassGrad.addColorStop(0, 'rgba(255, 255, 255, 0.11)');
    glassGrad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
    traceRoundRect(ctx, 14, 10, 740, 170, 28);
    ctx.fillStyle = glassGrad;
    ctx.fill();

    // Rounded inner border (tinted to modal theme or active soundscape pack)
    traceRoundRect(ctx, 12, 12, 744, 436, 30);
    ctx.strokeStyle =
      overlayModal.kind === 'session_recap'
        ? '#10B981'
        : overlayModal.kind === 'cloud_conflict'
          ? '#F59E0B'
          : soundSettingsOpen
            ? activePackMeta.accentHex
            : '#F59E0B';
    ctx.lineWidth = 5;
    ctx.stroke();

    ctx.textAlign = 'center';
    if (overlayModal.kind === 'session_recap') {
      ctx.fillStyle = '#10B981';
      ctx.font = '700 21px "JetBrains Mono", monospace';
      ctx.fillText('SESSION 1 COMPLETE · MILESTONE', 384, 60);

      ctx.fillStyle = '#F8FAFC';
      ctx.font = '700 50px "Chakra Petch", sans-serif';
      ctx.fillText('WORKBENCH MASTERED', 384, 122);

      // 3 Rounded Stat Cards
      const recapStats = [
        { label: 'LEVELS', val: '3+' },
        { label: 'SCORE', val: `${Math.round(overlayModal.score).toLocaleString()}` },
        { label: 'MAX COMBO', val: `x${Math.max(1, overlayModal.maxCombo)}` },
      ];
      recapStats.forEach((st, idx) => {
        const bx = 148 + idx * 236;
        traceRoundRect(ctx, bx - 95, 162, 190, 128, 18);
        ctx.fillStyle = '#141D2E';
        ctx.fill();
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        ctx.fillStyle = '#94A3B8';
        ctx.font = '700 19px "Chakra Petch", sans-serif';
        ctx.fillText(st.label, bx, 200);

        ctx.fillStyle = idx === 0 ? '#6EE7B7' : idx === 1 ? '#FDE047' : '#38BDF8';
        ctx.font = '700 40px "JetBrains Mono", monospace';
        ctx.fillText(st.val, bx, 256, 172);
      });

      // Day 2 Comeback Bonus Strip
      traceRoundRect(ctx, 64, 312, 640, 82, 18);
      ctx.fillStyle = 'rgba(245, 158, 11, 0.14)';
      ctx.fill();
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.fillStyle = '#FDE68A';
      ctx.font = '700 17px "JetBrains Mono", monospace';
      ctx.fillText('★ RETURN TOMORROW: DAY 2 BONUS ★', 384, 342);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '700 24px "Chakra Petch", sans-serif';
      ctx.fillText('+1 FREE HAMMER CHARGE UNLOCKED ON RETURN', 384, 376, 610);

      ctx.fillStyle = '#94A3B8';
      ctx.font = '700 16px "JetBrains Mono", monospace';
      ctx.fillText(
        `TAP KEEP PLAYING BELOW TO CONTINUE LEVEL ${overlayModal.levelNumber}`,
        384,
        424
      );
    } else if (overlayModal.kind === 'cloud_conflict') {
      const { cloud, local } = overlayModal;
      ctx.fillStyle = '#F59E0B';
      ctx.font = '700 20px "JetBrains Mono", monospace';
      ctx.fillText('MULTI-DEVICE CLOUD SYNC', 384, 56);

      ctx.fillStyle = '#F8FAFC';
      ctx.font = '700 44px "Chakra Petch", sans-serif';
      ctx.fillText('SAVE CONFLICT DETECTED', 384, 112);

      const drawSaveCard = (
        cx: number,
        title: string,
        accent: string,
        blob: TorqSaveBlob
      ) => {
        const cardX = cx - 155;
        const cardY = 148;
        traceRoundRect(ctx, cardX, cardY, 310, 224, 18);
        ctx.fillStyle = '#111A2B';
        ctx.fill();
        ctx.strokeStyle = accent;
        ctx.lineWidth = 2.5;
        ctx.stroke();

        ctx.fillStyle = accent;
        ctx.font = '700 18px "JetBrains Mono", monospace';
        ctx.fillText(title, cx, cardY + 34);

        ctx.fillStyle = '#F8FAFC';
        ctx.font = '700 38px "Chakra Petch", sans-serif';
        ctx.fillText(`LEVEL ${(blob.levelIndex ?? 0) + 1}`, cx, cardY + 84);

        ctx.fillStyle = '#CBD5E1';
        ctx.font = '700 18px "JetBrains Mono", monospace';
        ctx.fillText(
          `SCORE: ${Math.round(blob.cumulativeScore ?? 0).toLocaleString()}`,
          cx,
          cardY + 128,
          284
        );
        ctx.fillStyle = '#94A3B8';
        ctx.font = '600 16px "JetBrains Mono", monospace';
        ctx.fillText(
          `HAMMERS: ${blob.hammersRemaining ?? 0}  ·  SLOTS: ${blob.maxDockSlots ?? 5}`,
          cx,
          cardY + 162,
          284
        );
        ctx.fillText(
          new Date(blob.updatedAtMs || Date.now()).toLocaleDateString(),
          cx,
          cardY + 194,
          284
        );
      };

      drawSaveCard(210, '☁ CLOUD SAVE', '#38BDF8', cloud);
      drawSaveCard(558, '📱 THIS DEVICE', '#F59E0B', local);

      ctx.fillStyle = '#6EE7B7';
      ctx.font = '700 16px "JetBrains Mono", monospace';
      ctx.fillText(
        'RECOMMENDED: SMART MERGE KEEPS HIGHEST LEVEL & COMBINED TOOLS',
        384,
        412,
        700
      );
    } else if (soundSettingsOpen) {
      // Top Header Bar
      ctx.fillStyle = activePackMeta.accentHex;
      ctx.font = '700 18px "JetBrains Mono", monospace';
      ctx.fillText('3D ACOUSTIC SYNTHESIS WORKSTATION', 384, 46);

      ctx.fillStyle = '#F8FAFC';
      ctx.font = '700 34px "Chakra Petch", sans-serif';
      ctx.fillText('SOUNDSCAPE SETTINGS', 384, 84);

      // Top-Right Audio Status Pill
      traceRoundRect(ctx, 594, 28, 142, 36, 10);
      ctx.fillStyle = isMuted
        ? 'rgba(239, 68, 68, 0.18)'
        : 'rgba(16, 185, 129, 0.18)';
      ctx.fill();
      ctx.strokeStyle = isMuted ? '#EF4444' : '#10B981';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = isMuted ? '#FCA5A5' : '#6EE7B7';
      ctx.font = '700 14px "JetBrains Mono", monospace';
      ctx.fillText(isMuted ? 'AUDIO MUTED' : `VOL ${volPct}% ON`, 665, 51);

      // Render 3 Side-by-Side Mechanical Soundscape Pack Cards (y = 104..376)
      const cardW = 218;
      const cardH = 272;
      const cardY = 104;
      const cardXPositions = [36, 275, 514];

      SOUNDSCAPE_PACK_ORDER.forEach((packId, idx) => {
        const meta = SOUNDSCAPE_PACKS[packId];
        const cx = cardXPositions[idx];
        const centerX = cx + cardW / 2;
        const isSelected = activePack === packId;

        const cGrad = ctx.createLinearGradient(0, cardY, 0, cardY + cardH);
        if (isSelected) {
          cGrad.addColorStop(0, '#1E293B');
          cGrad.addColorStop(1, '#0F172A');
        } else {
          cGrad.addColorStop(0, '#111827');
          cGrad.addColorStop(1, '#090D16');
        }
        traceRoundRect(ctx, cx, cardY, cardW, cardH, 20);
        ctx.fillStyle = cGrad;
        ctx.fill();

        ctx.strokeStyle = isSelected ? meta.accentHex : '#334155';
        ctx.lineWidth = isSelected ? 4 : 2;
        ctx.stroke();

        // Top Selection Status Badge inside Card
        traceRoundRect(ctx, cx + 22, cardY + 14, cardW - 44, 28, 8);
        ctx.fillStyle = isSelected ? meta.accentHex : '#1E293B';
        ctx.fill();
        ctx.fillStyle = isSelected ? '#090D16' : '#94A3B8';
        ctx.font = '700 13px "JetBrains Mono", monospace';
        ctx.fillText(
          isSelected ? '● ACTIVE PACK' : `PACK 0${idx + 1}`,
          centerX,
          cardY + 33
        );

        // Pack Title (2 lines)
        const words = meta.name.toUpperCase().split(' ');
        ctx.fillStyle = isSelected ? '#F8FAFC' : '#CBD5E1';
        ctx.font = '700 22px "Chakra Petch", sans-serif';
        ctx.fillText(words[0] ?? '', centerX, cardY + 74);
        ctx.fillStyle = isSelected ? meta.secondaryHex : '#94A3B8';
        ctx.font = '700 20px "Chakra Petch", sans-serif';
        ctx.fillText(words.slice(1).join(' '), centerX, cardY + 99);

        // Tagline
        ctx.fillStyle = meta.accentHex;
        ctx.font = '700 12px "JetBrains Mono", monospace';
        ctx.fillText(meta.tagline, centerX, cardY + 124);

        // Recessed 8-Bar Acoustic Spectrum Analyzer Window (y = cardY + 140 .. cardY + 218)
        const specX = cx + 18;
        const specY = cardY + 140;
        const specW = cardW - 36;
        const specH = 76;
        traceRoundRect(ctx, specX, specY, specW, specH, 10);
        ctx.fillStyle = '#060911';
        ctx.fill();
        ctx.strokeStyle = isSelected ? meta.accentHex : '#1E293B';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        const barCount = meta.specBars.length;
        const barGap = 6;
        const totalBarsW = specW - 24;
        const barW = Math.floor(
          (totalBarsW - (barCount - 1) * barGap) / barCount
        );
        meta.specBars.forEach((amp, bIdx) => {
          const bh = Math.max(10, Math.round((specH - 20) * amp));
          const bx = specX + 12 + bIdx * (barW + barGap);
          const by = specY + specH - 10 - bh;
          traceRoundRect(ctx, bx, by, barW, bh, 3);
          ctx.fillStyle = isSelected ? meta.accentHex : '#475569';
          ctx.fill();
        });

        // Bottom Waveform & Base Pitch Readout
        ctx.fillStyle = isSelected ? '#E2E8F0' : '#64748B';
        ctx.font = '700 13px "JetBrains Mono", monospace';
        ctx.fillText(meta.waveformTag, centerX, cardY + 240);
        ctx.fillStyle = meta.accentHex;
        ctx.font = '700 12px "JetBrains Mono", monospace';
        ctx.fillText(`${meta.baseFreqHz} HZ PROFILE`, centerX, cardY + 258);
      });

      // Footer Active Pack Summary Strip
      ctx.fillStyle = '#E2E8F0';
      ctx.font = '700 17px "JetBrains Mono", monospace';
      ctx.fillText(
        `ACTIVE: ${activePackMeta.name.toUpperCase()} · CLICK PACK CARD OR 3D SWITCH BELOW`,
        384,
        416
      );
    } else if (phase === 'title') {
      ctx.fillStyle = '#F59E0B';
      ctx.font = '700 22px "JetBrains Mono", monospace';
      ctx.fillText('3D MECHANICAL WORKBENCH', 384, 64);

      ctx.fillStyle = '#F8FAFC';
      ctx.font = '700 102px "Chakra Petch", sans-serif';
      ctx.fillText('TORQ', 384, 162);

      ctx.fillStyle = '#94A3B8';
      ctx.font = '600 24px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(
        `LEVEL ${lvlBadge} · ${board.screws.length} ANODIZED BOLTS · SFX: ${activePackMeta.name.toUpperCase()}`,
        384,
        220
      );

      if (showStreakCard) {
        // Machinist's Daily Streak & Visual Reward Indicator Card (y = 246..374)
        const cardX = 54;
        const cardY = 246;
        const cardW = 660;
        const cardH = 128;
        const cardGrad = ctx.createLinearGradient(0, cardY, 0, cardY + cardH);
        cardGrad.addColorStop(0, '#121B2E');
        cardGrad.addColorStop(1, '#090E18');
        traceRoundRect(ctx, cardX, cardY, cardW, cardH, 20);
        ctx.fillStyle = cardGrad;
        ctx.fill();
        ctx.strokeStyle = streakAccent;
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Left Column: Day Streak Counter + Returning Player Bonus Badge
        const leftCenterX = 186;
        ctx.fillStyle = '#FDE047';
        ctx.font = '700 28px "Chakra Petch", sans-serif';
        ctx.textAlign = 'center';
        const dayWord = streakCount === 1 ? 'DAY STREAK' : 'DAY STREAK';
        ctx.fillText(`🔥 ${streakCount} ${dayWord}`, leftCenterX, 294);

        // Reward bonus pill
        traceRoundRect(ctx, 74, 316, 224, 38, 11);
        ctx.fillStyle = 'rgba(245, 158, 11, 0.14)';
        ctx.fill();
        ctx.strokeStyle = streakAccent;
        ctx.lineWidth = 1.8;
        ctx.stroke();

        ctx.fillStyle = streakAccent;
        ctx.font = '700 15px "JetBrains Mono", monospace';
        ctx.fillText(`★ ${streakTier}`, leftCenterX, 340);

        // Vertical divider inside card
        ctx.fillStyle = 'rgba(148, 163, 184, 0.22)';
        ctx.fillRect(314, cardY + 18, 2, cardH - 36);

        // Right Column: 7-Day Visual Reward Stamp Track (D1..D7)
        ctx.fillStyle = '#94A3B8';
        ctx.font = '700 14px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('DAILY REWARD INDICATOR · 7-DAY CYCLE', 512, 276);

        const cycleIdx = ((Math.max(1, streakCount) - 1) % 7) + 1;
        for (let d = 1; d <= 7; d++) {
          const nodeW = 44;
          const nodeH = 62;
          const nodeX = 332 + (d - 1) * 51;
          const nodeY = 292;
          const isCompleted = d <= cycleIdx;
          const isCurrent = d === cycleIdx;
          const isMilestone = d === 3 || d === 7;

          traceRoundRect(ctx, nodeX, nodeY, nodeW, nodeH, 10);
          if (isCompleted) {
            const nodeGrad = ctx.createLinearGradient(0, nodeY, 0, nodeY + nodeH);
            nodeGrad.addColorStop(0, isCurrent ? '#FBBF24' : '#D97706');
            nodeGrad.addColorStop(1, isCurrent ? '#D97706' : '#92400E');
            ctx.fillStyle = nodeGrad;
            ctx.fill();
            ctx.strokeStyle = isCurrent ? '#FEF08A' : '#F59E0B';
            ctx.lineWidth = isCurrent ? 3 : 2;
            ctx.stroke();
          } else {
            ctx.fillStyle = '#070A10';
            ctx.fill();
            ctx.strokeStyle = isMilestone
              ? 'rgba(245, 158, 11, 0.5)'
              : '#334155';
            ctx.lineWidth = 1.8;
            ctx.stroke();
          }

          ctx.fillStyle = isCompleted ? '#090D16' : '#94A3B8';
          ctx.font = '700 14px "JetBrains Mono", monospace';
          ctx.fillText(`D${d}`, nodeX + nodeW / 2, nodeY + 21);

          ctx.fillStyle = isCompleted
            ? '#090D16'
            : isMilestone
              ? '#F59E0B'
              : '#475569';
          ctx.font = '700 20px "Chakra Petch", sans-serif';
          const stampChar = isCurrent
            ? '★'
            : isCompleted
              ? '✓'
              : isMilestone
                ? '★'
                : '·';
          ctx.fillText(stampChar, nodeX + nodeW / 2, nodeY + 46);
        }
      } else {
        traceRoundRect(ctx, 114, 258, 540, 104, 20);
        ctx.fillStyle = '#121B2E';
        ctx.fill();
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 2.2;
        ctx.stroke();
        ctx.fillStyle = '#E2E8F0';
        ctx.font = '700 24px "Chakra Petch", sans-serif';
        ctx.fillText(`WORKBENCH READY · LEVEL ${lvlBadge}`, 384, 304);
        ctx.fillStyle = '#94A3B8';
        ctx.font = '700 16px "JetBrains Mono", monospace';
        ctx.fillText('UNBOLT ALL TARGET PLATES TO ADVANCE', 384, 338);
      }

      if (cloudConnected) {
        ctx.fillStyle = '#10B981';
        ctx.font = '700 15px "JetBrains Mono", monospace';
        ctx.fillText('☁ GOOGLE PLAY GAMES: AUTO CLOUD SYNC ACTIVE', 384, 395);
      }

      ctx.fillStyle = '#38BDF8';
      ctx.font = '700 19px "JetBrains Mono", monospace';
      ctx.fillText(
        'CLICK 3D BOLTS OR PRESS PLAY BELOW',
        384,
        cloudConnected ? 424 : 412
      );
    } else if (phase === 'paused') {
      ctx.fillStyle = '#F59E0B';
      ctx.font = '700 28px "JetBrains Mono", monospace';
      ctx.fillText(`LEVEL ${lvlBadge}`, 384, 95);

      ctx.fillStyle = '#F8FAFC';
      ctx.font = '700 84px "Chakra Petch", sans-serif';
      ctx.fillText('PAUSED', 384, 200);

      ctx.fillStyle = '#FDE047';
      ctx.font = '700 40px "JetBrains Mono", monospace';
      ctx.fillText(
        `SCORE: ${Math.round(board.score)}   ·   TRAYS: ${board.completedBoxCount}/${board.totalBoxes}`,
        384,
        295
      );

      ctx.fillStyle = activePackMeta.accentHex;
      ctx.font = '700 20px "JetBrains Mono", monospace';
      ctx.fillText(
        `SOUNDSCAPE PACK: ${activePackMeta.name.toUpperCase()} (${activePackMeta.shortCode})`,
        384,
        355
      );

      if (cloudConnected) {
        ctx.fillStyle = '#10B981';
        ctx.font = '700 16px "JetBrains Mono", monospace';
        ctx.fillText('☁ GOOGLE PLAY GAMES: AUTO CLOUD SYNC ACTIVE', 384, 405);
      }
    } else if (phase === 'gameover' && runSnapshot) {
      const isWin = runSnapshot.outcome === 'victory';
      const snapLvl = runSnapshot.levelIndex + 1;
      const snapBadge = snapLvl < 10 ? `0${snapLvl}` : `${snapLvl}`;
      ctx.fillStyle = isWin ? '#10B981' : '#EF4444';
      ctx.font = '700 30px "JetBrains Mono", monospace';
      ctx.fillText(`LEVEL ${snapBadge}`, 384, 85);

      ctx.fillStyle = '#F8FAFC';
      ctx.font = '700 78px "Chakra Petch", sans-serif';
      ctx.fillText(isWin ? 'LEVEL CLEAR!' : 'DOCK FULL!', 384, 185);

      // 3 Rounded Stat Cards
      const stats = [
        { label: 'LEVEL', val: `${snapBadge}` },
        { label: 'SCORE', val: `${Math.round(runSnapshot.score)}` },
        {
          label: 'BEST',
          val: `${Math.round(Math.max(bestScore, runSnapshot.score))}`,
        },
      ];
      stats.forEach((st, idx) => {
        const bx = 148 + idx * 236;
        traceRoundRect(ctx, bx - 95, 240, 190, 145, 20);
        ctx.fillStyle = '#151E2E';
        ctx.fill();
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.fillStyle = '#94A3B8';
        ctx.font = '700 22px "Chakra Petch", sans-serif';
        ctx.fillText(st.label, bx, 285);

        ctx.fillStyle = '#FDE047';
        ctx.font = '700 46px "JetBrains Mono", monospace';
        ctx.fillText(st.val, bx, 350);
      });
    }

    screenTex.needsUpdate = true;
  }

  const allModalButtons = [
    primaryBtn,
    splitLeftBtn,
    splitRightBtn,
    ...conflictBtns,
    ...packBtns,
    ...stageBtns,
  ];
  function invalidateCache() {
    lastScreenKey = '';
  }

  return { root, allModalButtons, updateModal3D, invalidateCache };
}

/**
 * Creates the Right-Side 3D Radioactive Liquid Auto-Play Reactor Vessel & Activator Switch.
 * - Mounted on the right side of the 3D workbench (`x = 4.36, y = -0.12, z = 0.12`).
 * - Features a transparent borosilicate containment tube, brass guard rods, graduation rings,
 *   an internal 3D Radioactive Liquid column with procedural isotope plasma texture, rising
 *   3D gas bubbles, a sloshing glowing meniscus cap, a dynamic Cherenkov green PointLight,
 *   a top OLED charge header, and a bottom 3D tactile activator button.
 * - Fills up after each bolt comes out; once it reaches 100% (`isReady`), the player can
 *   trigger it to autonomously solve the current level!
 */
export function create3DRadioactiveAutoPlayRig(maxAnisotropy: number) {
  const group = new THREE.Group();
  group.position.set(4.36, -0.12, 0.12);

  // 1. Heavy Brushed Titanium & Brass Reactor Spine Housing
  const spineRimGeo = new RoundedBoxGeometry(1.18, 3.96, 0.18, 5, 0.16);
  const spineRimMat = new THREE.MeshPhysicalMaterial({
    color: 0xe0a234,
    roughness: 0.26,
    metalness: 0.86,
    clearcoat: 0.4,
    envMapIntensity: 1.3,
  });
  const spineRim = new THREE.Mesh(spineRimGeo, spineRimMat);
  spineRim.position.z = -0.04;
  spineRim.castShadow = true;
  group.add(spineRim);

  const spineBodyGeo = new RoundedBoxGeometry(1.06, 3.82, 0.22, 5, 0.14);
  const spineBodyMat = new THREE.MeshPhysicalMaterial({
    color: 0x141b28,
    roughness: 0.3,
    metalness: 0.82,
    clearcoat: 0.35,
    envMapIntensity: 1.2,
  });
  const spineBody = new THREE.Mesh(spineBodyGeo, spineBodyMat);
  spineBody.castShadow = true;
  group.add(spineBody);

  // 2. Top 2x-Supersampled OLED Charge Status Readout Screen (y = +1.46)
  const headerCanvas = document.createElement('canvas');
  headerCanvas.width = 220 * UI_TEX_SUPERSAMPLE;
  headerCanvas.height = 110 * UI_TEX_SUPERSAMPLE;
  const headerTex = configureCrispUITexture(
    new THREE.CanvasTexture(headerCanvas),
    maxAnisotropy
  );

  const headerGeo = createRoundedPlaneGeometry(0.92, 0.46, 0.08, 12);
  const headerMat = new THREE.MeshBasicMaterial({
    map: headerTex,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  const headerMesh = new THREE.Mesh(headerGeo, headerMat);
  headerMesh.position.set(0, 1.52, 0.115);
  group.add(headerMesh);

  // 3. Cylindrical Borosilicate Containment Tube Assembly (y = +0.12, height = 1.82)
  const tubeCenterY = 0.12;
  const tubeHeight = 1.82;
  const liquidMaxHeight = 1.66;
  const liquidBottomY = tubeCenterY - liquidMaxHeight * 0.5; // -0.71

  // Dark recessed reactor chamber behind the glass tube
  const chamberGeo = new RoundedBoxGeometry(
    0.76,
    tubeHeight + 0.16,
    0.12,
    4,
    0.08
  );
  const chamberMat = new THREE.MeshBasicMaterial({ color: 0x050907 });
  const chamberMesh = new THREE.Mesh(chamberGeo, chamberMat);
  chamberMesh.position.set(0, tubeCenterY, 0.08);
  group.add(chamberMesh);

  // Top & Bottom Machined Brass Containment End-Caps
  const capGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.12, 28);
  const capMat = new THREE.MeshPhysicalMaterial({
    color: 0xd99b26,
    roughness: 0.24,
    metalness: 0.88,
    clearcoat: 0.45,
    envMapIntensity: 1.4,
  });
  const topCap = new THREE.Mesh(capGeo, capMat);
  topCap.position.set(0, tubeCenterY + tubeHeight * 0.5 + 0.03, 0.26);
  group.add(topCap);

  const botCap = new THREE.Mesh(capGeo, capMat);
  botCap.position.set(0, tubeCenterY - tubeHeight * 0.5 - 0.03, 0.26);
  group.add(botCap);

  // 2 Front-Side Brass Guard Rods & 5 Graduation Rings
  const rodGeo = new THREE.CylinderGeometry(0.026, 0.026, tubeHeight, 12);
  for (const rx of [-0.36, 0.36]) {
    const rod = new THREE.Mesh(rodGeo, capMat);
    rod.position.set(rx, tubeCenterY, 0.32);
    group.add(rod);
  }

  const gradRingGeo = new THREE.TorusGeometry(0.335, 0.015, 10, 28);
  gradRingGeo.rotateX(Math.PI / 2);
  for (let i = 1; i <= 4; i++) {
    const gy = liquidBottomY + (liquidMaxHeight * i) / 5;
    const gradRing = new THREE.Mesh(gradRingGeo, capMat);
    gradRing.position.set(0, gy, 0.26);
    group.add(gradRing);
  }

  // Top "PLAYER READY" Neon Target Ring at 100% mark
  const readyRingGeo = new THREE.TorusGeometry(0.35, 0.024, 12, 32);
  readyRingGeo.rotateX(Math.PI / 2);
  const readyRingMat = new THREE.MeshBasicMaterial({ color: 0x39ff14 });
  const readyRing = new THREE.Mesh(readyRingGeo, readyRingMat);
  readyRing.position.set(0, liquidBottomY + liquidMaxHeight, 0.26);
  group.add(readyRing);

  // 4. Procedural 3D Radioactive Liquid Material & Animated Column
  const liqCanvas = document.createElement('canvas');
  liqCanvas.width = 128;
  liqCanvas.height = 256;
  const liqCtx = liqCanvas.getContext('2d')!;
  const liqGrad = liqCtx.createLinearGradient(0, 0, 128, 256);
  liqGrad.addColorStop(0, '#39FF14');
  liqGrad.addColorStop(0.35, '#84CC16');
  liqGrad.addColorStop(0.7, '#22C55E');
  liqGrad.addColorStop(1, '#BEF264');
  liqCtx.fillStyle = liqGrad;
  liqCtx.fillRect(0, 0, 128, 256);
  // Add cellular radioactive plasma striations
  for (let i = 0; i < 28; i++) {
    const bx = (i * 37) % 128;
    const by = (i * 53) % 256;
    const rad = 8 + (i % 5) * 4;
    const g = liqCtx.createRadialGradient(bx, by, 1, bx, by, rad);
    g.addColorStop(0, 'rgba(236, 252, 203, 0.85)');
    g.addColorStop(1, 'rgba(57, 255, 20, 0.0)');
    liqCtx.fillStyle = g;
    liqCtx.beginPath();
    liqCtx.arc(bx, by, rad, 0, Math.PI * 2);
    liqCtx.fill();
  }
  const liqTexture = new THREE.CanvasTexture(liqCanvas);
  liqTexture.wrapS = THREE.RepeatWrapping;
  liqTexture.wrapT = THREE.RepeatWrapping;
  liqTexture.colorSpace = THREE.SRGBColorSpace;

  const liquidGeo = new THREE.CylinderGeometry(
    0.285,
    0.285,
    liquidMaxHeight,
    28
  );
  const liquidMat = new THREE.MeshStandardMaterial({
    map: liqTexture,
    color: 0x4ade80,
    emissive: 0x39ff14,
    emissiveMap: liqTexture,
    emissiveIntensity: 1.15,
    roughness: 0.16,
    metalness: 0.12,
  });
  const liquidMesh = new THREE.Mesh(liquidGeo, liquidMat);
  liquidMesh.position.set(0, liquidBottomY, 0.26);
  liquidMesh.scale.set(1, 0.02, 1);
  group.add(liquidMesh);

  // Glowing 3D Meniscus Surface Disc at the top of the rising radioactive liquid
  const meniscusGeo = new THREE.CylinderGeometry(0.288, 0.288, 0.045, 28);
  const meniscusMat = new THREE.MeshBasicMaterial({
    color: 0xd9f99d,
  });
  const meniscusMesh = new THREE.Mesh(meniscusGeo, meniscusMat);
  meniscusMesh.position.set(0, liquidBottomY + 0.02, 0.26);
  group.add(meniscusMesh);

  // 8 Rising 3D Radioactive Bubbles inside the liquid column
  const bubbleGeo = new THREE.SphereGeometry(0.042, 10, 10);
  const bubbleMat = new THREE.MeshBasicMaterial({
    color: 0xecfccb,
    transparent: true,
    opacity: 0.9,
  });
  const bubbles: {
    mesh: THREE.Mesh;
    phase: number;
    speed: number;
    radX: number;
  }[] = [];
  for (let i = 0; i < 8; i++) {
    const bMesh = new THREE.Mesh(bubbleGeo, bubbleMat);
    const angle = (i / 8) * Math.PI * 2;
    const radX = Math.cos(angle) * (0.06 + (i % 3) * 0.055);
    const radZ = 0.26 + Math.sin(angle) * 0.08;
    bMesh.position.set(radX, liquidBottomY, radZ);
    group.add(bMesh);
    bubbles.push({
      mesh: bMesh,
      phase: i * 0.13,
      speed: 0.45 + (i % 4) * 0.12,
      radX,
    });
  }

  // Outer Borosilicate Glass Cylinder (wraps around the radioactive liquid & bubbles)
  const glassGeo = new THREE.CylinderGeometry(
    0.325,
    0.325,
    tubeHeight,
    28,
    1,
    true
  );
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xd9f99d,
    transparent: true,
    opacity: 0.26,
    roughness: 0.08,
    metalness: 0.1,
    clearcoat: 1.0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const glassMesh = new THREE.Mesh(glassGeo, glassMat);
  glassMesh.position.set(0, tubeCenterY, 0.26);
  group.add(glassMesh);

  // Dynamic Cherenkov Green PointLight that rises with the radioactive liquid
  const reactorLight = new THREE.PointLight(0x39ff14, 0.4, 3.8, 1.6);
  reactorLight.position.set(-0.15, liquidBottomY, 0.55);
  group.add(reactorLight);

  // 5. Bottom Interactive 3D Tactile Auto-Play Button (y = -1.36)
  const autoPlayBtn = create3DControlButton(
    0,
    -1.36,
    0.1,
    0.92,
    0.72,
    { type: 'auto_play' },
    maxAnisotropy
  );
  glassMesh.userData = {};
  liquidMesh.userData = {};
  headerMesh.userData = {};
  group.add(glassMesh);
  group.add(headerMesh);
  group.add(autoPlayBtn.group);

  let displayedFill = 0;
  let lastHeaderKey = '';

  function update(
    targetFillRatio: number,
    chargeBolts: number,
    targetBolts: number,
    isReady: boolean,
    autoPlaying: boolean,
    dt: number,
    elapsed: number
  ) {
    const clampedTarget = Math.max(0, Math.min(1, targetFillRatio));
    displayedFill = THREE.MathUtils.damp(displayedFill, clampedTarget, 10, dt);

    const visualFill = Math.max(0.04, displayedFill);
    const currentLiqHeight = liquidMaxHeight * visualFill;

    liquidMesh.scale.set(1, visualFill, 1);
    liquidMesh.position.y = liquidBottomY + currentLiqHeight * 0.5;
    liquidMesh.rotation.y =
      elapsed * (autoPlaying ? 2.8 : isReady ? 1.5 : 0.65);

    // Scroll & pulse radioactive plasma texture
    liqTexture.offset.y = -(elapsed * (autoPlaying ? 0.55 : 0.18)) % 1;
    liqTexture.offset.x = Math.sin(elapsed * 0.8) * 0.15;
    const pulse =
      0.5 + 0.5 * Math.sin(elapsed * (isReady || autoPlaying ? 8 : 3.2));
    liquidMat.emissiveIntensity =
      isReady || autoPlaying
        ? 1.45 + pulse * 0.65
        : 0.85 + displayedFill * 0.55;

    // Position & slosh the 3D meniscus surface disc at the top of the liquid
    const meniscusY = liquidBottomY + currentLiqHeight;
    meniscusMesh.position.y = meniscusY;
    meniscusMesh.rotation.z = Math.sin(elapsed * 4.5) * 0.08;
    meniscusMesh.rotation.x = Math.cos(elapsed * 3.7) * 0.08;
    const meniscusScale = isReady || autoPlaying ? 1.0 + pulse * 0.08 : 1.0;
    meniscusMesh.scale.set(meniscusScale, 1, meniscusScale);

    // Animate rising 3D radioactive bubbles within the current liquid height
    for (let i = 0; i < bubbles.length; i++) {
      const b = bubbles[i];
      if (visualFill < 0.08) {
        b.mesh.visible = false;
        continue;
      }
      b.mesh.visible = true;
      const t = (elapsed * b.speed + b.phase) % 1;
      b.mesh.position.y =
        liquidBottomY + 0.04 + t * Math.max(0.05, currentLiqHeight - 0.08);
      b.mesh.position.x = b.radX + Math.sin(elapsed * 3.5 + i) * 0.03;
      const bScale =
        Math.sin(t * Math.PI) * (isReady || autoPlaying ? 1.25 : 0.95);
      b.mesh.scale.setScalar(Math.max(0.2, bScale));
    }

    // Update Cherenkov PointLight & top target ring
    reactorLight.position.y = meniscusY;
    reactorLight.intensity =
      isReady || autoPlaying
        ? 1.8 + pulse * 0.9
        : 0.35 + displayedFill * 1.1;
    readyRingMat.color.setHex(
      isReady || autoPlaying
        ? 0xbef264
        : displayedFill > 0.75
          ? 0x39ff14
          : 0x15803d
    );

    // Update bottom 3D tactile activator button texture & pulse
    const pct = Math.round(clampedTarget * 100);
    if (autoPlaying) {
      updateButton3DCapTexture(
        autoPlayBtn,
        '⚡ AUTO',
        'SOLVING',
        '#39FF14',
        undefined,
        true,
        false
      );
      autoPlayBtn.group.scale.setScalar(1.0 + Math.sin(elapsed * 10) * 0.05);
    } else if (isReady) {
      updateButton3DCapTexture(
        autoPlayBtn,
        '☢ AUTO',
        'READY!',
        '#39FF14',
        'GO',
        true,
        false
      );
      autoPlayBtn.group.scale.setScalar(1.0 + Math.sin(elapsed * 6.5) * 0.06);
    } else {
      updateButton3DCapTexture(
        autoPlayBtn,
        '▶ BOOST',
        `${pct}%`,
        '#10B981',
        'AD',
        false,
        false
      );
      autoPlayBtn.group.scale.setScalar(1.0);
    }

    // Update top OLED Header Screen Canvas
    const statusText = autoPlaying
      ? 'ACTIVE!'
      : isReady
        ? 'READY!'
        : `${chargeBolts}/${targetBolts} BOLTS`;
    const headerKey = `${statusText}|${isReady}|${autoPlaying}`;
    if (headerKey !== lastHeaderKey) {
      lastHeaderKey = headerKey;
      const ctx = headerCanvas.getContext('2d')!;
      ctx.setTransform(UI_TEX_SUPERSAMPLE, 0, 0, UI_TEX_SUPERSAMPLE, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.clearRect(0, 0, 220, 110);

      traceRoundRect(ctx, 2, 2, 216, 106, 18);
      ctx.fillStyle = '#09110D';
      ctx.fill();

      traceRoundRect(ctx, 6, 6, 208, 98, 14);
      ctx.strokeStyle = isReady || autoPlaying ? '#39FF14' : '#4D7C0F';
      ctx.lineWidth = isReady || autoPlaying ? 4 : 2.5;
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.fillStyle = '#84CC16';
      ctx.font = '700 20px "Chakra Petch", sans-serif';
      ctx.fillText('☢ AUTO-PLAY', 110, 38);

      ctx.fillStyle = isReady || autoPlaying ? '#ECFCCB' : '#39FF14';
      ctx.font = '700 26px "JetBrains Mono", monospace';
      ctx.fillText(statusText, 110, 78);

      headerTex.needsUpdate = true;
    }
  }

  function invalidateCache() {
    lastHeaderKey = '';
  }

  return { group, buttonHandle: autoPlayBtn, update, invalidateCache };
}

export interface NativeAdBillboardHandle {
  group: THREE.Group;
  screenMesh: THREE.Mesh;
  action: Gui3DAction;
  update: (elapsed: number) => void;
}

/**
 * Creates a diegetic 3D Native Ad Billboard mounted in the empty space
 * flanking the workbench (left or right).
 */
export function create3DNativeAdBillboard(
  side: 'left' | 'right',
  maxAnisotropy: number
): NativeAdBillboardHandle {
  const group = new THREE.Group();
  group.name = `native_ad_billboard_${side}`;
  const posX = side === 'left' ? -7.3 : 7.3;
  const rotY = side === 'left' ? 0.09 : -0.09;
  group.position.set(posX, -0.15, 0.05);
  group.rotation.y = rotY;

  // 1. Titanium Chassis
  const chassisGeo = new RoundedBoxGeometry(2.65, 5.8, 0.22, 5, 0.16);
  const chassisMat = new THREE.MeshPhysicalMaterial({
    color: 0x161d28,
    roughness: 0.28,
    metalness: 0.85,
    clearcoat: 0.35,
    clearcoatRoughness: 0.2,
    envMapIntensity: 1.25,
  });
  const chassis = new THREE.Mesh(chassisGeo, chassisMat);
  chassis.castShadow = true;
  chassis.receiveShadow = true;
  group.add(chassis);

  // 2. Brass Corner Fasteners
  const cornerGeo = new RoundedBoxGeometry(0.38, 0.38, 0.26, 4, 0.08);
  const cornerMat = new THREE.MeshPhysicalMaterial({
    color: 0xe0a234,
    roughness: 0.24,
    metalness: 0.88,
    clearcoat: 0.4,
    envMapIntensity: 1.35,
  });
  const boltGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.04, 6);
  boltGeo.rotateX(Math.PI / 2);
  const boltMat = new THREE.MeshPhysicalMaterial({
    color: 0x0f172a,
    roughness: 0.3,
    metalness: 0.9,
  });

  const cornerOffsets = [
    [-1.15, 2.72],
    [1.15, 2.72],
    [-1.15, -2.72],
    [1.15, -2.72],
  ];
  for (const [cx, cy] of cornerOffsets) {
    const corner = new THREE.Mesh(cornerGeo, cornerMat);
    corner.position.set(cx, cy, 0.02);
    const bolt = new THREE.Mesh(boltGeo, boltMat);
    bolt.position.set(cx, cy, 0.16);
    group.add(corner, bolt);
  }

  // 3. Screen Mesh & Texture
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 1024;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;

  const screenGeo = createRoundedPlaneGeometry(2.42, 5.5, 0.12, 16);
  const screenMat = new THREE.MeshBasicMaterial({
    map: texture,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  const screenMesh = new THREE.Mesh(screenGeo, screenMat);
  screenMesh.position.z = 0.115;
  group.add(screenMesh);

  // Render canvas content
  function renderAdCanvas(pulsePhase: number) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, 512, 1024);

    const isLeft = side === 'left';
    const accentColor = isLeft ? '#4285F4' : '#34A853'; // Google Blue & Google Green
    const subColor = isLeft ? '#60A5FA' : '#4ADE80';

    // 1. Outer Dark Chassis Surface
    const bgGrad = ctx.createLinearGradient(0, 0, 0, 1024);
    bgGrad.addColorStop(0, '#0F172A');
    bgGrad.addColorStop(0.4, '#151E2E');
    bgGrad.addColorStop(1, '#0A0F1D');
    ctx.fillStyle = bgGrad;
    traceRoundRect(ctx, 4, 4, 504, 1016, 24);
    ctx.fill();

    // 2. Subtle Technical Grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
    ctx.lineWidth = 1;
    for (let y = 40; y < 1000; y += 48) {
      ctx.beginPath();
      ctx.moveTo(20, y);
      ctx.lineTo(492, y);
      ctx.stroke();
    }

    // 3. Glowing Ad Border
    traceRoundRect(ctx, 8, 8, 496, 1008, 20);
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 3;
    ctx.stroke();

    // 4. Top Header Bar: Authentic Google AdMob Test Ad Badge
    ctx.save();
    // Black Test Ad Pill Badge
    traceRoundRect(ctx, 24, 24, 120, 38, 8);
    ctx.fillStyle = '#000000';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 18px "Chakra Petch", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Test Ad', 84, 49);

    // Google AdMob Logo (4 Google colored dots)
    const dotX = 168;
    const dotY = 43;
    const colors = ['#4285F4', '#EA4335', '#FBBC05', '#34A853'];
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = colors[i];
      ctx.beginPath();
      ctx.arc(dotX + i * 14, dotY, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.textAlign = 'left';
    ctx.fillStyle = '#F8FAFC';
    ctx.font = '700 19px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('Google AdMob', 230, 50);

    // AdChoices icon (top-right blue triangle with 'i')
    ctx.fillStyle = '#0284C7';
    ctx.beginPath();
    ctx.moveTo(480, 24);
    ctx.lineTo(480, 54);
    ctx.lineTo(450, 24);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 12px serif';
    ctx.textAlign = 'center';
    ctx.fillText('i', 472, 36);
    ctx.restore();

    // Divider
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(24, 76);
    ctx.lineTo(488, 76);
    ctx.stroke();

    // 5. App Identity Card (App Icon, Title, Rating)
    ctx.save();
    // App Icon Container
    traceRoundRect(ctx, 24, 94, 90, 90, 18);
    const iconGrad = ctx.createLinearGradient(24, 94, 114, 184);
    iconGrad.addColorStop(0, isLeft ? '#2563EB' : '#059669');
    iconGrad.addColorStop(1, isLeft ? '#1E3A8A' : '#064E3B');
    ctx.fillStyle = iconGrad;
    ctx.fill();
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // App Icon Graphic
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    if (isLeft) {
      // Bolt / Cog graphic
      ctx.font = '40px sans-serif';
      ctx.fillText('⚙️', 69, 152);
    } else {
      // Play / Gamepad graphic
      ctx.font = '40px sans-serif';
      ctx.fillText('🎮', 69, 152);
    }

    // App Title & Headline
    ctx.textAlign = 'left';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 22px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(isLeft ? 'Test Ad: Bolt Puzzle 3D' : 'Test Ad: Fast Play Pro', 128, 122);

    ctx.fillStyle = '#94A3B8';
    ctx.font = '600 16px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(isLeft ? 'Google AdMob Native' : 'Google Mobile Ads SDK', 128, 148);

    // Star Rating
    ctx.fillStyle = '#FBBF24';
    ctx.font = '17px sans-serif';
    ctx.fillText('★★★★★', 128, 174);

    ctx.fillStyle = '#CBD5E1';
    ctx.font = '600 14px "JetBrains Mono", monospace';
    ctx.fillText(isLeft ? '4.9 (1.2M) • FREE' : '5.0 (890K) • FREE', 218, 172);
    ctx.restore();

    // 6. Media View Area (Ad Creative Banner)
    const mediaY = 202;
    const mediaH = 340;
    traceRoundRect(ctx, 24, mediaY, 464, mediaH, 16);
    const mediaGrad = ctx.createLinearGradient(24, mediaY, 488, mediaY + mediaH);
    mediaGrad.addColorStop(0, '#090D16');
    mediaGrad.addColorStop(0.5, '#111827');
    mediaGrad.addColorStop(1, '#0B0F19');
    ctx.fillStyle = mediaGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Media Inner Content
    ctx.save();
    ctx.translate(256, mediaY + 140);
    // Rotating / pulsing test ad graphic
    const pulseScale = 1.0 + Math.sin(pulsePhase * 2.5) * 0.04;
    ctx.scale(pulseScale, pulseScale);

    if (isLeft) {
      // Blue hexagonal radar emblem
      ctx.strokeStyle = '#4285F4';
      ctx.lineWidth = 5;
      ctx.beginPath();
      for (let a = 0; a < 6; a++) {
        const rad = (a * Math.PI) / 3;
        const hx = Math.cos(rad) * 75;
        const hy = Math.sin(rad) * 75;
        if (a === 0) ctx.moveTo(hx, hy);
        else ctx.lineTo(hx, hy);
      }
      ctx.closePath();
      ctx.stroke();

      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, 40, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Emerald diamond radar emblem
      ctx.strokeStyle = '#34A853';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(0, -75);
      ctx.lineTo(75, 0);
      ctx.lineTo(0, 75);
      ctx.lineTo(-75, 0);
      ctx.closePath();
      ctx.stroke();

      ctx.strokeStyle = '#34D399';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, 40, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#4285F4';
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Media Banner Headline
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 24px "Chakra Petch", sans-serif';
    ctx.fillText(
      isLeft ? 'NICE JOB! THIS IS A TEST AD' : 'VERIFIED NATIVE TEST CREATIVE',
      256,
      mediaY + 280
    );

    ctx.fillStyle = subColor;
    ctx.font = '700 16px "JetBrains Mono", monospace';
    ctx.fillText(
      isLeft ? 'GOOGLE ADMOB NATIVE ADVANCED' : 'REAL-TIME 3D IMPRESSION TRACKING',
      256,
      mediaY + 312
    );

    // 7. Body Copy Description
    ctx.textAlign = 'left';
    ctx.fillStyle = '#E2E8F0';
    ctx.font = '500 18px "Plus Jakarta Sans", sans-serif';
    const bodyLines = isLeft
      ? [
        '⚡ High-performance native ads rendered inside 3D.',
        '💎 100% test creative with zero intrusive popups.',
        '🎯 High eCPM rewarded boosts with instant payouts.',
        '🛡️ Official Google Mobile Ads Android Integration.',
      ]
      : [
        '⚡ Official AdMob Native Advanced test ad unit.',
        '🎮 Free-to-play monetization powered by Google.',
        '🚀 Battery-efficient WebGL 60fps canvas projection.',
        '🛡️ Tap to preview rewarded test ad & claim bonus.',
      ];

    let bulletY = 590;
    for (const line of bodyLines) {
      traceRoundRect(ctx, 24, bulletY - 22, 464, 38, 8);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.fill();

      ctx.fillStyle = '#F1F5F9';
      ctx.fillText(line, 40, bulletY + 4);
      bulletY += 52;
    }

    // 8. Call-To-Action Button (Google Material Style)
    const btnY = 824;
    traceRoundRect(ctx, 28, btnY, 456, 74, 16);
    const btnGrad = ctx.createLinearGradient(28, btnY, 484, btnY + 74);
    btnGrad.addColorStop(0, isLeft ? '#2563EB' : '#059669');
    btnGrad.addColorStop(1, isLeft ? '#1D4ED8' : '#047857');
    ctx.fillStyle = btnGrad;
    ctx.fill();
    ctx.strokeStyle = isLeft ? '#60A5FA' : '#34D399';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 24px "Chakra Petch", sans-serif';
    ctx.fillText(
      isLeft ? 'INSTALL (TEST AD) • +50 PTS ▶' : 'LEARN MORE (TEST AD) • +50 ↗',
      256,
      btnY + 46
    );

    // 9. Footer Note with Official AdMob Test Ad Unit ID
    ctx.fillStyle = '#64748B';
    ctx.font = '600 15px "JetBrains Mono", monospace';
    ctx.fillText('Ad Unit: ca-app-pub-3940256099942544/2247696110', 256, 946);
    ctx.fillText('TAP BILLBOARD TO TRIGGER TEST AD & BONUS', 256, 974);

    texture.needsUpdate = true;
  }

  renderAdCanvas(0);

  let lastPulseTime = 0;
  function update(elapsed: number) {
    const floatY = -0.15 + Math.sin(elapsed * 1.3 + (side === 'left' ? 0 : Math.PI)) * 0.035;
    const tiltY = (side === 'left' ? 0.09 : -0.09) + Math.sin(elapsed * 0.9) * 0.015;
    group.position.y = floatY;
    group.rotation.y = tiltY;

    if (elapsed - lastPulseTime > 1.2) {
      lastPulseTime = elapsed;
      renderAdCanvas(elapsed);
    }
  }

  return {
    group,
    screenMesh,
    action: { type: 'side_ad_click', side },
    update,
  };
}
