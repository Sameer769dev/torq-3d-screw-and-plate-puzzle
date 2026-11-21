import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {
  PlateMaterialType,
  PlateShape,
  SCREW_COLOR_META,
  ScrewColor,
} from './types';

/**
 * Generates a Glare-Free 360° Perimeter Studio Environment (via PMREMGenerator).
 * Light strips are positioned strictly around the grazing perimeter (top, bottom, left, right)
 * while the central camera axis (+Z) remains a dark anti-glare studio baffle.
 * This illuminates all 3D rounded bevels and chamfers evenly from 360° with zero flat-surface glare.
 */
export function createStudioHDREnvironment(
  renderer: THREE.WebGLRenderer
): THREE.Texture {
  const studioScene = new THREE.Scene();
  studioScene.background = new THREE.Color(0x141923);

  const addDiffuserPanel = (
    w: number,
    h: number,
    colorHex: number,
    intensity: number,
    x: number,
    y: number,
    z: number
  ) => {
    const geo = new THREE.PlaneGeometry(w, h);
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(colorHex).multiplyScalar(intensity),
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.lookAt(0, 0, 0);
    studioScene.add(mesh);
  };

  // Symmetrical 4-side grazing perimeter softboxes (evenly distributed top, bottom, left, right)
  addDiffuserPanel(18, 6, 0xf8fafc, 1.85, 0, 14, 3);
  addDiffuserPanel(18, 6, 0xf8fafc, 1.85, 0, -14, 3);
  addDiffuserPanel(6, 18, 0xe0f2fe, 1.75, -14, 0, 3);
  addDiffuserPanel(6, 18, 0xfef3c7, 1.75, 14, 0, 3);

  // 4 diagonal corner fill diffusers for continuous 360-degree bevel reflections
  addDiffuserPanel(10, 10, 0xf1f5f9, 1.5, -11, 11, 4);
  addDiffuserPanel(10, 10, 0xf1f5f9, 1.5, 11, 11, 4);
  addDiffuserPanel(10, 10, 0xf1f5f9, 1.5, -11, -11, 4);
  addDiffuserPanel(10, 10, 0xf1f5f9, 1.5, 11, -11, 4);

  // Dark non-reflective camera baffle directly in front (+Z) so flat faces never glare
  addDiffuserPanel(14, 14, 0x0f141d, 0.5, 0, 0, 15);

  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const envTexture = pmremGenerator.fromScene(studioScene, 0.065).texture;
  pmremGenerator.dispose();
  return envTexture;
}

/**
 * Generates tileable procedural brushed metal & workshop mat CanvasTextures
 */
export function createWorkshopTextures(maxAnisotropy: number) {
  // 1. Fine anisotropic brushed metal roughness/bump map
  const metalCanvas = document.createElement('canvas');
  metalCanvas.width = 512;
  metalCanvas.height = 512;
  const mCtx = metalCanvas.getContext('2d')!;
  mCtx.fillStyle = '#808080';
  mCtx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 1200; i++) {
    const y = (i * 17) % 512;
    const lum = 112 + ((i * 29) % 36);
    mCtx.fillStyle = `rgb(${lum},${lum},${lum})`;
    mCtx.fillRect(0, y, 512, 1 + (i % 2));
  }
  const brushedBumpMap = new THREE.CanvasTexture(metalCanvas);
  brushedBumpMap.wrapS = THREE.RepeatWrapping;
  brushedBumpMap.wrapT = THREE.RepeatWrapping;
  brushedBumpMap.repeat.set(2, 2);
  brushedBumpMap.anisotropy = maxAnisotropy;

  // 2. Uniform anti-glare precision workshop carbon-slate mat texture
  const matCanvas = document.createElement('canvas');
  matCanvas.width = 512;
  matCanvas.height = 512;
  const ctx = matCanvas.getContext('2d')!;

  ctx.fillStyle = '#181E2B';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle fine sub-grid
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.065)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 512; i += 32) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }

  // Major calibration grid lines
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.14)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i <= 512; i += 128) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }

  const workbenchTexture = new THREE.CanvasTexture(matCanvas);
  workbenchTexture.colorSpace = THREE.SRGBColorSpace;
  workbenchTexture.wrapS = THREE.RepeatWrapping;
  workbenchTexture.wrapT = THREE.RepeatWrapping;
  workbenchTexture.repeat.set(3, 2);
  workbenchTexture.anisotropy = maxAnisotropy;

  // 3. Soft radial contact shadow texture
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 128;
  shadowCanvas.height = 128;
  const sCtx = shadowCanvas.getContext('2d')!;
  const grad = sCtx.createRadialGradient(64, 64, 8, 64, 64, 60);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.65)');
  grad.addColorStop(0.6, 'rgba(0, 0, 0, 0.25)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
  sCtx.fillStyle = grad;
  sCtx.fillRect(0, 0, 128, 128);
  const contactShadowTex = new THREE.CanvasTexture(shadowCanvas);

  return { brushedBumpMap, workbenchTexture, contactShadowTex };
}

/**
 * Helper to create a smooth rounded-corner 2D hexagon shape for CNC chamfered bolt heads
 */
function createRoundedHexShape(radius: number, cornerRadius: number): THREE.Shape {
  const shape = new THREE.Shape();
  const verts: THREE.Vector2[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    verts.push(new THREE.Vector2(Math.cos(angle) * radius, Math.sin(angle) * radius));
  }
  for (let i = 0; i < 6; i++) {
    const prev = verts[(i + 5) % 6];
    const curr = verts[i];
    const next = verts[(i + 1) % 6];
    const d1 = prev.clone().sub(curr).normalize().multiplyScalar(cornerRadius);
    const d2 = next.clone().sub(curr).normalize().multiplyScalar(cornerRadius);
    const p1 = curr.clone().add(d1);
    const p2 = curr.clone().add(d2);
    if (i === 0) shape.moveTo(p1.x, p1.y);
    else shape.lineTo(p1.x, p1.y);
    shape.quadraticCurveTo(curr.x, curr.y, p2.x, p2.y);
  }
  shape.closePath();
  return shape;
}

let _cachedHexHeadGeo: THREE.ExtrudeGeometry | null = null;
function getChamferedHexHeadGeo(): THREE.ExtrudeGeometry {
  if (!_cachedHexHeadGeo) {
    const hexShape = createRoundedHexShape(0.33, 0.055);
    _cachedHexHeadGeo = new THREE.ExtrudeGeometry(hexShape, {
      depth: 0.14,
      bevelEnabled: true,
      bevelThickness: 0.038,
      bevelSize: 0.032,
      bevelSegments: 4,
      curveSegments: 12,
    });
  }
  return _cachedHexHeadGeo;
}

let _cachedUnknownBadgeTex: THREE.CanvasTexture | null = null;
let _cachedRainbowBadgeTex: THREE.CanvasTexture | null = null;
let _cachedChaoticBadgeTex: THREE.CanvasTexture | null = null;

export function getSpecialBoltBadgeTexture(
  kind: 'unknown' | 'rainbow' | 'chaotic'
): THREE.CanvasTexture {
  if (kind === 'unknown' && _cachedUnknownBadgeTex) return _cachedUnknownBadgeTex;
  if (kind === 'rainbow' && _cachedRainbowBadgeTex) return _cachedRainbowBadgeTex;
  if (kind === 'chaotic' && _cachedChaoticBadgeTex) return _cachedChaoticBadgeTex;

  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const cx = 64;
  const cy = 64;

  if (kind === 'unknown') {
    // Dark obsidian mystery disc with glowing gold/violet '?' emblem
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(cx, cy, 60, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#A855F7';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(cx, cy, 54, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#FDE047';
    ctx.font = '900 78px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', cx, cy + 4);
  } else if (kind === 'rainbow') {
    // 6-sector vivid prismatic rainbow wheel with white star core
    const colors = [
      '#EF4444',
      '#F59E0B',
      '#84CC16',
      '#06B6D4',
      '#3B82F6',
      '#EC4899',
    ];
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = colors[i];
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(
        cx,
        cy,
        60,
        (i * Math.PI) / 3,
        ((i + 1) * Math.PI) / 3
      );
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(cx, cy, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0F172A';
    ctx.font = '900 30px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('★', cx, cy + 2);
  } else {
    // Chaotic color-shifting dual-ring vortex emblem
    ctx.fillStyle = '#1E1B4B';
    ctx.beginPath();
    ctx.arc(cx, cy, 60, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.arc(cx, cy, 50, 0, Math.PI * 0.85);
    ctx.stroke();

    ctx.strokeStyle = '#EC4899';
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.arc(cx, cy, 50, Math.PI, Math.PI * 1.85);
    ctx.stroke();

    ctx.fillStyle = '#FDE047';
    ctx.font = '900 62px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⚡', cx, cy + 4);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;

  if (kind === 'unknown') _cachedUnknownBadgeTex = tex;
  if (kind === 'rainbow') _cachedRainbowBadgeTex = tex;
  if (kind === 'chaotic') _cachedChaoticBadgeTex = tex;
  return tex;
}

/**
 * Builds a 6-part composite 3D Screw (THREE.Group) with smooth filleted bevels
 * and balanced satin-anodized PBR materials:
 * 1. Primary silhouette: Rounded-corner chamfered hexagonal head (MeshPhysicalMaterial)
 * 2. Secondary read: Rounded torus-beveled chrome washer collar
 * 3. Secondary read: Threaded helical shaft (LatheGeometry with sinusoidal thread ridges)
 * 4. Accent detail: Domed anodized crown cap
 * 5. Accent detail: Recessed rounded cross-drive slot + Special Variant Badge (Unknown '?', Rainbow, Chaotic)
 * 6. Accent detail: Interactive status halo ring & special variant aura ring at base
 */
export function createCompositeScrewGroup(
  color: ScrewColor,
  screwId: string,
  brushedBumpMap: THREE.Texture
): THREE.Group {
  const meta = SCREW_COLOR_META[color];
  const group = new THREE.Group();
  group.name = `screw_${screwId}`;
  group.userData = { screwId, color };

  // 1. Primary silhouette: CNC Chamfered Rounded Hex Head
  const hexHeadGeo = getChamferedHexHeadGeo();
  const headMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(meta.hex),
    roughness: 0.28,
    metalness: 0.72,
    clearcoat: 0.35,
    clearcoatRoughness: 0.22,
    envMapIntensity: 1.15,
    bumpMap: brushedBumpMap,
    bumpScale: 0.006,
  });
  const hexHead = new THREE.Mesh(hexHeadGeo, headMat);
  hexHead.name = 'boltHead';
  hexHead.position.z = 0.07;
  hexHead.castShadow = true;
  hexHead.receiveShadow = true;
  hexHead.userData = { screwId };
  group.add(hexHead);

  // 2. Secondary read: Brushed steel washer collar + torus fillet at z = 0.04
  const washerGeo = new THREE.TorusGeometry(0.34, 0.065, 16, 32);
  const washerMat = new THREE.MeshPhysicalMaterial({
    color: 0xcbd5e1,
    roughness: 0.3,
    metalness: 0.82,
    clearcoat: 0.3,
    envMapIntensity: 1.2,
  });
  const washer = new THREE.Mesh(washerGeo, washerMat);
  washer.position.z = 0.045;
  washer.userData = { screwId };
  group.add(washer);

  // 3. Secondary read: Threaded helical shaft (LatheGeometry) extending into -Z
  const lathePoints: THREE.Vector2[] = [];
  const steps = 20;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const y = -t * 0.55;
    const threadWave = Math.sin(t * Math.PI * 10) * 0.025;
    const taper = t > 0.85 ? (1 - t) * 5 : 1;
    const r = Math.max(0.02, (0.15 + threadWave) * taper);
    lathePoints.push(new THREE.Vector2(r, y));
  }
  const shaftGeo = new THREE.LatheGeometry(lathePoints, 20);
  shaftGeo.rotateX(Math.PI / 2);
  const shaftMat = new THREE.MeshPhysicalMaterial({
    color: 0x94a3b8,
    roughness: 0.32,
    metalness: 0.85,
    envMapIntensity: 1.1,
  });
  const shaft = new THREE.Mesh(shaftGeo, shaftMat);
  shaft.position.z = 0.02;
  group.add(shaft);

  // 4. Accent detail: Smooth domed anodized crown ring on top of hex head
  const capGeo = new THREE.CylinderGeometry(0.24, 0.28, 0.05, 28);
  capGeo.rotateX(Math.PI / 2);
  const capMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(meta.accentHex),
    roughness: 0.26,
    metalness: 0.55,
    clearcoat: 0.4,
    clearcoatRoughness: 0.2,
    envMapIntensity: 1.1,
  });
  const cap = new THREE.Mesh(capGeo, capMat);
  cap.name = 'boltCrownCap';
  cap.position.z = 0.255;
  cap.userData = { screwId };
  group.add(cap);

  // 5. Accent detail: Recessed rounded cross-slot drive
  const slotMat = new THREE.MeshStandardMaterial({
    color: 0x0b0f19,
    roughness: 0.75,
    metalness: 0.4,
  });
  const slotGeoH = new RoundedBoxGeometry(0.31, 0.068, 0.045, 2, 0.02);
  const slotGeoV = new RoundedBoxGeometry(0.068, 0.31, 0.045, 2, 0.02);
  const slotH = new THREE.Mesh(slotGeoH, slotMat);
  const slotV = new THREE.Mesh(slotGeoV, slotMat);
  slotH.name = 'slotH';
  slotV.name = 'slotV';
  slotH.position.z = 0.278;
  slotV.position.z = 0.278;
  slotH.userData = { screwId };
  slotV.userData = { screwId };
  group.add(slotH, slotV);

  // 5b. Special Variant Crown Badge (Unknown '?', Rainbow Prism, or Chaotic Vortex)
  const badgeGeo = new THREE.CircleGeometry(0.235, 28);
  const badgeMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.98,
  });
  const specialBadge = new THREE.Mesh(badgeGeo, badgeMat);
  specialBadge.name = 'specialBadge';
  specialBadge.position.z = 0.286;
  specialBadge.visible = false;
  specialBadge.userData = { screwId };
  group.add(specialBadge);

  // 5c. Special Variant Aura Ring around the bolt washer
  const auraGeo = new THREE.RingGeometry(0.38, 0.46, 32);
  const auraMat = new THREE.MeshBasicMaterial({
    color: 0xfde047,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
  });
  const specialAuraRing = new THREE.Mesh(auraGeo, auraMat);
  specialAuraRing.name = 'specialAuraRing';
  specialAuraRing.position.z = 0.052;
  specialAuraRing.visible = false;
  group.add(specialAuraRing);

  // 6. Accent detail: Selection / Hint status ring around washer
  const ringGeo = new THREE.RingGeometry(0.45, 0.55, 32);
  const ringMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(meta.accentHex),
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
  });
  const statusRing = new THREE.Mesh(ringGeo, ringMat);
  statusRing.name = 'statusRing';
  statusRing.position.z = 0.04;
  group.add(statusRing);

  // Invisible slightly larger raycast proxy cylinder so clicking/tapping is effortless
  const hitProxyGeo = new THREE.CylinderGeometry(0.48, 0.48, 0.45, 12);
  hitProxyGeo.rotateX(Math.PI / 2);
  const hitProxyMat = new THREE.MeshBasicMaterial({ visible: false });
  const hitProxy = new THREE.Mesh(hitProxyGeo, hitProxyMat);
  hitProxy.position.z = 0.15;
  hitProxy.userData = { screwId };
  group.add(hitProxy);

  return group;
}

/**
 * Creates a 2D THREE.Shape for a mechanical plate with generous rounded corners
 */
function createPlate2DShape(shape: PlateShape, width: number, height: number): THREE.Shape {
  const s = new THREE.Shape();
  const hw = width / 2;
  const hh = height / 2;

  if (shape === 'hex') {
    // Machined octagonal/hexagonal chamfered plate that fully encloses corner bolt washers
    const ch = Math.min(0.24, hw * 0.28, hh * 0.28);
    s.moveTo(-hw + ch, -hh);
    s.lineTo(hw - ch, -hh);
    s.lineTo(hw, -hh + ch);
    s.lineTo(hw, hh - ch);
    s.lineTo(hw - ch, hh);
    s.lineTo(-hw + ch, hh);
    s.lineTo(-hw, hh - ch);
    s.lineTo(-hw, -hh + ch);
    s.closePath();
    return s;
  }

  // Precision rounded stadium/chassis rectangle (strictly bounded within [-hw, hw] x [-hh, hh])
  const r =
    shape === 'disc' || shape === 'arch'
      ? Math.min(0.42, hw * 0.46, hh * 0.46)
      : Math.min(0.32, hw * 0.36, hh * 0.36);

  s.moveTo(-hw + r, -hh);
  s.lineTo(hw - r, -hh);
  s.quadraticCurveTo(hw, -hh, hw, -hh + r);
  s.lineTo(hw, hh - r);
  s.quadraticCurveTo(hw, hh, hw - r, hh);
  s.lineTo(-hw + r, hh);
  s.quadraticCurveTo(-hw, hh, -hw, hh - r);
  s.lineTo(-hw, -hh + r);
  s.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
  return s;
}

/**
 * Builds a composite 3D Mechanical Plate with smooth rounded bevels and anti-glare studio materials
 */
export function createCompositePlateGroup(
  plateId: string,
  shape: PlateShape,
  materialType: PlateMaterialType,
  width: number,
  height: number,
  localHoleCoords: { x: number; y: number }[],
  isSoftwareGl: boolean,
  brushedBumpMap: THREE.Texture
): THREE.Group {
  const group = new THREE.Group();
  group.name = `plate_${plateId}`;

  const shape2D = createPlate2DShape(shape, width, height);

  // Punch circular bolt holes in the plate where screws pass through
  for (const hole of localHoleCoords) {
    const holePath = new THREE.Path();
    holePath.absarc(hole.x, hole.y, 0.22, 0, Math.PI * 2, false);
    shape2D.holes.push(holePath);
  }

  const extrudeGeo = new THREE.ExtrudeGeometry(shape2D, {
    depth: 0.13,
    bevelEnabled: true,
    bevelThickness: 0.038,
    bevelSize: 0.036,
    bevelSegments: 5,
    curveSegments: 20,
  });

  // Configure realistic glare-free studio PBR material per PlateMaterialType
  let plateMat: THREE.Material;
  if (materialType.startsWith('acrylic')) {
    const colorMap: Record<string, number> = {
      'acrylic-cyan': 0x38bdf8,
      'acrylic-amber': 0xfbbf24,
      'acrylic-rose': 0xf43f5e,
    };
    const tint = colorMap[materialType] ?? 0x38bdf8;
    plateMat = new THREE.MeshPhysicalMaterial({
      color: tint,
      roughness: 0.26,
      metalness: 0.04,
      transmission: isSoftwareGl ? 0 : 0.68,
      transparent: true,
      opacity: isSoftwareGl ? 0.56 : 0.78,
      ior: 1.48,
      thickness: 0.35,
      clearcoat: 0.25,
      clearcoatRoughness: 0.28,
      envMapIntensity: 0.75,
      depthWrite: false,
    });
  } else {
    const metalConfig: Record<
      string,
      { color: number; roughness: number; metalness: number; clearcoat: number }
    > = {
      'brushed-brass': {
        color: 0xd99b26,
        roughness: 0.34,
        metalness: 0.78,
        clearcoat: 0.28,
      },
      'blued-steel': {
        color: 0x3d5275,
        roughness: 0.36,
        metalness: 0.76,
        clearcoat: 0.26,
      },
      'anodized-slate': {
        color: 0x364356,
        roughness: 0.38,
        metalness: 0.74,
        clearcoat: 0.24,
      },
    };
    const cfg = metalConfig[materialType] ?? metalConfig['brushed-brass'];
    plateMat = new THREE.MeshPhysicalMaterial({
      color: cfg.color,
      roughness: cfg.roughness,
      metalness: cfg.metalness,
      clearcoat: cfg.clearcoat,
      clearcoatRoughness: 0.25,
      envMapIntensity: 1.05,
      bumpMap: brushedBumpMap,
      bumpScale: 0.01,
    });
  }

  const plateMesh = new THREE.Mesh(extrudeGeo, plateMat);
  plateMesh.position.z = -0.065;
  plateMesh.castShadow = !materialType.startsWith('acrylic');
  plateMesh.receiveShadow = true;
  group.add(plateMesh);

  // Subtle edge highlight for crisp mechanical plate definition
  const edgesGeo = new THREE.EdgesGeometry(extrudeGeo, 28);
  const edgeMat = new THREE.LineBasicMaterial({
    color: materialType.startsWith('acrylic') ? 0xbae6fd : 0xfde68a,
    transparent: true,
    opacity: 0.32,
  });
  const edgeLines = new THREE.LineSegments(edgesGeo, edgeMat);
  edgeLines.position.z = -0.065;
  group.add(edgeLines);

  // Polished rounded metallic grommet rings around each screw hole
  const grommetGeo = new THREE.TorusGeometry(0.24, 0.042, 16, 32);
  const grommetMat = new THREE.MeshPhysicalMaterial({
    color: materialType === 'brushed-brass' ? 0x64748b : 0xe5a93c,
    roughness: 0.26,
    metalness: 0.84,
    clearcoat: 0.35,
    envMapIntensity: 1.2,
  });
  for (const hole of localHoleCoords) {
    const grommetTop = new THREE.Mesh(grommetGeo, grommetMat);
    grommetTop.position.set(hole.x, hole.y, 0.09);
    group.add(grommetTop);
  }

  return group;
}

/**
 * Builds the 3D Workshop Workbench environment with smooth rounded CNC edges (`RoundedBoxGeometry`)
 * and uniform, glare-free satin titanium, matte slate, and brushed brass materials.
 */
export function createWorkbenchEnvironment(
  workbenchTexture: THREE.Texture,
  brushedBumpMap: THREE.Texture,
  isPortrait: boolean = false
): THREE.Group {
  const envGroup = new THREE.Group();
  envGroup.name = 'workbench_environment';

  const baseW = 10.0;
  const baseH = 10.0;

  // 1. Primary calibrated blueprint board surface (matte anti-glare cutting mat)
  const boardGeo = new RoundedBoxGeometry(baseW, baseH, 0.42, 4, 0.12);
  const boardMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: workbenchTexture,
    roughness: 0.85,
    metalness: 0.08,
    envMapIntensity: 0.35,
  });
  const boardMesh = new THREE.Mesh(boardGeo, boardMat);
  boardMesh.position.set(0, 0, -0.36);
  boardMesh.receiveShadow = true;
  envGroup.add(boardMesh);

  // 2. Heavy CNC-machined rounded titanium perimeter frame with brushed rounded brass corner bumpers
  const frameMat = new THREE.MeshPhysicalMaterial({
    color: 0x222938,
    roughness: 0.32,
    metalness: 0.8,
    clearcoat: 0.35,
    clearcoatRoughness: 0.24,
    envMapIntensity: 1.2,
    bumpMap: brushedBumpMap,
    bumpScale: 0.012,
  });
  const brassMat = new THREE.MeshPhysicalMaterial({
    color: 0xe0a234,
    roughness: 0.24,
    metalness: 0.86,
    clearcoat: 0.4,
    clearcoatRoughness: 0.18,
    envMapIntensity: 1.35,
  });

  const topRail = new THREE.Mesh(
    new RoundedBoxGeometry(baseW, 0.42, 0.6, 5, 0.14),
    frameMat
  );
  const botRail = new THREE.Mesh(
    new RoundedBoxGeometry(baseW, 0.42, 0.6, 5, 0.14),
    frameMat
  );
  const leftRail = new THREE.Mesh(
    new RoundedBoxGeometry(0.42, baseH, 0.6, 5, 0.14),
    frameMat
  );
  const rightRail = new THREE.Mesh(
    new RoundedBoxGeometry(0.42, baseH, 0.6, 5, 0.14),
    frameMat
  );
  envGroup.add(topRail, botRail, leftRail, rightRail);

  // 4 Rounded Machined Brass Corner Bumpers with decorative hex bolts
  const cornerGeo = new RoundedBoxGeometry(0.74, 0.74, 0.68, 5, 0.18);
  const boltCapGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.08, 6);
  boltCapGeo.rotateX(Math.PI / 2);
  const boltCapMat = new THREE.MeshPhysicalMaterial({
    color: 0x1e293b,
    roughness: 0.3,
    metalness: 0.85,
    clearcoat: 0.35,
  });

  const corners: THREE.Mesh[] = [];
  const boltCaps: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const corner = new THREE.Mesh(cornerGeo, brassMat);
    envGroup.add(corner);
    corners.push(corner);

    const boltCap = new THREE.Mesh(boltCapGeo, boltCapMat);
    envGroup.add(boltCap);
    boltCaps.push(boltCap);
  }

  // 3. Rounded Spare Holding Dock 3D Rail (Expanded to accommodate up to 8 slots)
  const dockOuterGeo = new RoundedBoxGeometry(6.3, 0.88, 0.3, 5, 0.16);
  const dockOuterMat = new THREE.MeshPhysicalMaterial({
    color: 0x161d29,
    roughness: 0.32,
    metalness: 0.8,
    clearcoat: 0.35,
    envMapIntensity: 1.15,
  });
  const dockOuter = new THREE.Mesh(dockOuterGeo, dockOuterMat);
  dockOuter.position.set(0, 2.45, -0.09);
  dockOuter.receiveShadow = true;
  envGroup.add(dockOuter);

  const dockRailGeo = new RoundedBoxGeometry(6.1, 0.74, 0.34, 5, 0.14);
  const dockRailMat = new THREE.MeshPhysicalMaterial({
    color: 0x242d3f,
    roughness: 0.32,
    metalness: 0.78,
    clearcoat: 0.32,
    clearcoatRoughness: 0.24,
    envMapIntensity: 1.15,
    bumpMap: brushedBumpMap,
    bumpScale: 0.008,
  });
  const dockRail = new THREE.Mesh(dockRailGeo, dockRailMat);
  dockRail.position.set(0, 2.45, -0.05);
  dockRail.receiveShadow = true;
  envGroup.add(dockRail);

  const setWorkbenchLayout = (
    visW: number,
    visH: number,
    centerY: number,
    dockY: number,
    dockScaleX: number,
    dockScaleY = 1.0
  ) => {
    const safeW = Math.max(6.8, visW);
    const safeH = Math.max(7.2, visH);
    const halfW = safeW * 0.5;
    const halfH = safeH * 0.5;

    boardMesh.scale.set(safeW / baseW, safeH / baseH, 1);
    boardMesh.position.set(0, centerY, -0.36);
    workbenchTexture.repeat.set(
      Math.max(2, Number((safeW / 3.4).toFixed(2))),
      Math.max(2, Number((safeH / 3.4).toFixed(2)))
    );

    const topY = centerY + halfH - 0.16;
    const botY = centerY - halfH + 0.16;
    const leftX = -halfW + 0.16;
    const rightX = halfW - 0.16;

    topRail.scale.set((safeW + 0.24) / baseW, 1, 1);
    topRail.position.set(0, topY, -0.26);

    botRail.scale.set((safeW + 0.24) / baseW, 1, 1);
    botRail.position.set(0, botY, -0.26);

    leftRail.scale.set(1, (safeH + 0.24) / baseH, 1);
    leftRail.position.set(leftX, centerY, -0.26);

    rightRail.scale.set(1, (safeH + 0.24) / baseH, 1);
    rightRail.position.set(rightX, centerY, -0.26);

    const cornerPositions = [
      [leftX + 0.06, topY - 0.05],
      [rightX - 0.06, topY - 0.05],
      [leftX + 0.06, botY + 0.05],
      [rightX - 0.06, botY + 0.05],
    ];
    for (let i = 0; i < 4; i++) {
      const [cx, cy] = cornerPositions[i];
      corners[i].position.set(cx, cy, -0.22);
      boltCaps[i].position.set(cx, cy, 0.13);
    }

    dockOuter.position.set(0, dockY, -0.09);
    dockOuter.scale.set(dockScaleX, dockScaleY, 1);
    dockRail.position.set(0, dockY, -0.05);
    dockRail.scale.set(dockScaleX, dockScaleY, 1);
  };

  envGroup.userData.setWorkbenchLayout = setWorkbenchLayout;
  setWorkbenchLayout(
    isPortrait ? 7.3 : 13.8,
    isPortrait ? 15.5 : 7.85,
    isPortrait ? 0.1 : -0.15,
    2.45,
    1.0,
    1.0
  );

  return envGroup;
}

/**
 * Builds a composite 5-part 3D Machinist's Brass & Steel Hammer (`THREE.Group`)
 * that hovers over targeted bolts during Hammer Mode and swings down on impact!
 */
export function create3DHammerGroup(brushedBumpMap: THREE.Texture): THREE.Group {
  const hammerPivot = new THREE.Group();
  hammerPivot.name = 'machinist_hammer_3d';

  // Inner offset group so rotation around Z/X swings from the lower grip pivot
  const model = new THREE.Group();
  model.position.set(0.35, 0.55, 0.45);
  hammerPivot.add(model);

  // 1. Ergonomic knurled titanium-slate handle shaft
  const shaftGeo = new THREE.CylinderGeometry(0.085, 0.11, 1.45, 20);
  const shaftMat = new THREE.MeshPhysicalMaterial({
    color: 0x1e293b,
    roughness: 0.38,
    metalness: 0.72,
    clearcoat: 0.3,
    bumpMap: brushedBumpMap,
    bumpScale: 0.015,
  });
  const shaft = new THREE.Mesh(shaftGeo, shaftMat);
  shaft.position.set(0, -0.35, 0);
  shaft.castShadow = true;
  model.add(shaft);

  // 2. Brass pommel cap at bottom of grip
  const pommelGeo = new THREE.CylinderGeometry(0.125, 0.11, 0.16, 20);
  const brassMat = new THREE.MeshPhysicalMaterial({
    color: 0xe5a93c,
    roughness: 0.22,
    metalness: 0.88,
    clearcoat: 0.45,
    envMapIntensity: 1.35,
  });
  const pommel = new THREE.Mesh(pommelGeo, brassMat);
  pommel.position.set(0, -1.08, 0);
  model.add(pommel);

  // 3. Heavy CNC-rounded steel hammer head block
  const headGeo = new RoundedBoxGeometry(0.92, 0.38, 0.38, 4, 0.08);
  const headMat = new THREE.MeshPhysicalMaterial({
    color: 0x334155,
    roughness: 0.26,
    metalness: 0.85,
    clearcoat: 0.4,
    bumpMap: brushedBumpMap,
    bumpScale: 0.01,
  });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.set(0, 0.38, 0);
  head.castShadow = true;
  model.add(head);

  // 4. Polished brass striking face (left impact head)
  const strikeGeo = new THREE.CylinderGeometry(0.18, 0.2, 0.18, 24);
  strikeGeo.rotateZ(Math.PI / 2);
  const strikeFace = new THREE.Mesh(strikeGeo, brassMat);
  strikeFace.position.set(-0.52, 0.38, 0);
  strikeFace.castShadow = true;
  model.add(strikeFace);

  // 5. Crimson-anodized extractor claw/peen cap (right side)
  const peenGeo = new THREE.CylinderGeometry(0.12, 0.18, 0.22, 20);
  peenGeo.rotateZ(-Math.PI / 2);
  const peenMat = new THREE.MeshPhysicalMaterial({
    color: 0xef4444,
    roughness: 0.24,
    metalness: 0.78,
    clearcoat: 0.45,
  });
  const peenFace = new THREE.Mesh(peenGeo, peenMat);
  peenFace.position.set(0.54, 0.38, 0);
  model.add(peenFace);

  return hammerPivot;
}

export interface IdleGuideHand3DHandle {
  root: THREE.Group;
  handPoseGroup: THREE.Group;
  tipPulseMesh: THREE.Mesh;
  beaconOuterRing: THREE.Mesh;
  beaconInnerRing: THREE.Mesh;
}

/**
 * Builds an articulated 3D Tactile Guide Hand (`THREE.Group`) with a pearl-ivory
 * studio glove, brass wrist gauntlet cuff, extended pointing index finger, curled
 * middle/ring/pinky fingers, thumb, and a pulsing target beacon ring that hovers
 * over the optimal solver bolt when the player is idle.
 */
export function create3DIdleGuideHandGroup(
  brushedBumpMap: THREE.Texture
): IdleGuideHand3DHandle {
  const root = new THREE.Group();
  root.name = 'idle_guide_hand_3d';
  root.visible = false;

  // 1. Target Beacon Rings directly around the bolt head (in root XY plane)
  const outerRingGeo = new THREE.RingGeometry(0.46, 0.58, 36);
  const outerRingMat = new THREE.MeshBasicMaterial({
    color: 0xfde047,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });
  const beaconOuterRing = new THREE.Mesh(outerRingGeo, outerRingMat);
  beaconOuterRing.position.set(0, 0, -0.08);
  root.add(beaconOuterRing);

  const innerRingGeo = new THREE.RingGeometry(0.32, 0.4, 32);
  const innerRingMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  });
  const beaconInnerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
  beaconInnerRing.position.set(0, 0, -0.06);
  root.add(beaconInnerRing);

  // 2. Articulated Hand Pose Group (positioned diagonally below-right of the bolt
  // so the extended index finger points directly at (0, 0, 0.06) without obscuring the bolt!)
  const handPoseGroup = new THREE.Group();
  handPoseGroup.position.set(0.38, -0.52, 0.22);
  root.add(handPoseGroup);

  // Inner assembly rotated so local +Y points from wrist/palm toward the bolt at (-0.38, +0.52)
  const handModel = new THREE.Group();
  handModel.rotation.z = 0.62; // Aims index finger toward top-left (the bolt center)
  handModel.rotation.x = -0.34; // Pitched downward toward the board
  handPoseGroup.add(handModel);

  const gloveMat = new THREE.MeshPhysicalMaterial({
    color: 0xf8fafc,
    emissive: 0x1e293b,
    emissiveIntensity: 0.25,
    roughness: 0.24,
    metalness: 0.12,
    clearcoat: 0.65,
    clearcoatRoughness: 0.18,
    envMapIntensity: 1.35,
  });

  const jointGoldMat = new THREE.MeshPhysicalMaterial({
    color: 0xfbbf24,
    emissive: 0xd97706,
    emissiveIntensity: 0.35,
    roughness: 0.22,
    metalness: 0.88,
    clearcoat: 0.45,
    envMapIntensity: 1.4,
  });

  const slateTrimMat = new THREE.MeshPhysicalMaterial({
    color: 0x1e293b,
    roughness: 0.32,
    metalness: 0.82,
    bumpMap: brushedBumpMap,
    bumpScale: 0.01,
  });

  // 2a. Sculpted Palm & Dorsal Hand Body
  const palmGeo = new RoundedBoxGeometry(0.56, 0.58, 0.22, 4, 0.08);
  const palmMesh = new THREE.Mesh(palmGeo, gloveMat);
  palmMesh.position.set(0.06, -0.18, 0);
  palmMesh.castShadow = true;
  handModel.add(palmMesh);

  // Dorsal cyan/brass telemetry plate on back of glove
  const dorsalPlateGeo = new RoundedBoxGeometry(0.34, 0.32, 0.06, 3, 0.03);
  const dorsalPlate = new THREE.Mesh(dorsalPlateGeo, jointGoldMat);
  dorsalPlate.position.set(0.06, -0.18, 0.11);
  handModel.add(dorsalPlate);

  const dorsalCoreGeo = new THREE.CircleGeometry(0.09, 24);
  const dorsalCoreMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
  const dorsalCore = new THREE.Mesh(dorsalCoreGeo, dorsalCoreMat);
  dorsalCore.position.set(0.06, -0.18, 0.145);
  handModel.add(dorsalCore);

  // 2b. Extended Pointing Index Finger (reaching forward along +Y to touch the bolt)
  const indexProxGeo = new THREE.CapsuleGeometry(0.088, 0.26, 8, 16);
  const indexProx = new THREE.Mesh(indexProxGeo, gloveMat);
  indexProx.position.set(-0.14, 0.24, 0.02);
  indexProx.rotation.x = 0.14;
  indexProx.castShadow = true;
  handModel.add(indexProx);

  const indexKnuckle = new THREE.Mesh(
    new THREE.SphereGeometry(0.092, 16, 16),
    jointGoldMat
  );
  indexKnuckle.position.set(-0.14, 0.08, 0.03);
  handModel.add(indexKnuckle);

  const indexDistGeo = new THREE.CapsuleGeometry(0.076, 0.24, 8, 16);
  const indexDist = new THREE.Mesh(indexDistGeo, gloveMat);
  indexDist.position.set(-0.14, 0.48, -0.04);
  indexDist.rotation.x = 0.32;
  indexDist.castShadow = true;
  handModel.add(indexDist);

  // Glowing tactile fingertip pad at the tip of the index finger
  const tipPulseGeo = new THREE.SphereGeometry(0.085, 16, 16);
  const tipPulseMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.95,
  });
  const tipPulseMesh = new THREE.Mesh(tipPulseGeo, tipPulseMat);
  tipPulseMesh.position.set(-0.14, 0.63, -0.09);
  handModel.add(tipPulseMesh);

  // 2c. Three Curled Fingers (Middle, Ring, Pinky) tucked cleanly alongside
  const curledOffsets = [
    { x: 0.03, y: 0.14, z: -0.02, scale: 0.96 },
    { x: 0.19, y: 0.1, z: -0.03, scale: 0.9 },
    { x: 0.33, y: 0.04, z: -0.04, scale: 0.8 },
  ];
  for (const f of curledOffsets) {
    const knuckle = new THREE.Mesh(
      new THREE.SphereGeometry(0.082 * f.scale, 14, 14),
      jointGoldMat
    );
    knuckle.position.set(f.x, f.y - 0.06, f.z + 0.04);
    handModel.add(knuckle);

    const prox = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.078 * f.scale, 0.16 * f.scale, 6, 12),
      gloveMat
    );
    prox.position.set(f.x, f.y + 0.04, f.z - 0.04);
    prox.rotation.x = 0.95; // Curled downward into palm
    prox.castShadow = true;
    handModel.add(prox);
  }

  // 2d. Articulated Thumb on the left side of the palm
  const thumbKnuckle = new THREE.Mesh(
    new THREE.SphereGeometry(0.088, 14, 14),
    jointGoldMat
  );
  thumbKnuckle.position.set(-0.26, -0.14, -0.01);
  handModel.add(thumbKnuckle);

  const thumbSeg = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.082, 0.22, 8, 14),
    gloveMat
  );
  thumbSeg.position.set(-0.34, 0.04, -0.02);
  thumbSeg.rotation.z = 0.42;
  thumbSeg.rotation.x = 0.25;
  thumbSeg.castShadow = true;
  handModel.add(thumbSeg);

  // 2e. Machined Brass & Slate Wrist Gauntlet Cuff
  const cuffSlate = new THREE.Mesh(
    new RoundedBoxGeometry(0.52, 0.22, 0.25, 4, 0.06),
    slateTrimMat
  );
  cuffSlate.position.set(0.06, -0.52, 0);
  handModel.add(cuffSlate);

  const cuffBrass = new THREE.Mesh(
    new RoundedBoxGeometry(0.56, 0.09, 0.27, 4, 0.04),
    jointGoldMat
  );
  cuffBrass.position.set(0.06, -0.42, 0);
  handModel.add(cuffBrass);

  return {
    root,
    handPoseGroup,
    tipPulseMesh,
    beaconOuterRing,
    beaconInnerRing,
  };
}


