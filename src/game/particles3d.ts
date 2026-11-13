import * as THREE from 'three';
import { PlateMaterialType, PlateState } from './types';

export type ParticleKind = 'spark' | 'debris';

export interface Particle3DUnit {
  active: boolean;
  kind: ParticleKind;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  ry: number;
  rz: number;
  vrx: number;
  vry: number;
  vrz: number;
  life: number;
  maxLife: number;
  size: number;
  r: number;
  g: number;
  b: number;
  bounces: number;
}

export interface Particle3DPool {
  sparks: Particle3DUnit[];
  debris: Particle3DUnit[];
  sparkCursor: number;
  debrisCursor: number;
  totalPlateBursts: number;
  totalVictoryBursts: number;
}

export const SPARK_CAPACITY = 160;
export const DEBRIS_CAPACITY = 96;

const PLATE_MATERIAL_PALETTE: Record<
  PlateMaterialType,
  { primaryHex: string; secondaryHex: string; sparkHex: string }
> = {
  'acrylic-cyan': {
    primaryHex: '#38BDF8',
    secondaryHex: '#BAE6FD',
    sparkHex: '#FEF08A',
  },
  'acrylic-amber': {
    primaryHex: '#F59E0B',
    secondaryHex: '#FDE68A',
    sparkHex: '#FFFBEB',
  },
  'brushed-brass': {
    primaryHex: '#EAB308',
    secondaryHex: '#FDE047',
    sparkHex: '#FFFBEB',
  },
  'blued-steel': {
    primaryHex: '#60A5FA',
    secondaryHex: '#93C5FD',
    sparkHex: '#FDE047',
  },
  'acrylic-rose': {
    primaryHex: '#F43F5E',
    secondaryHex: '#FDA4AF',
    sparkHex: '#FEF08A',
  },
  'anodized-slate': {
    primaryHex: '#94A3B8',
    secondaryHex: '#E2E8F0',
    sparkHex: '#F59E0B',
  },
};

const VICTORY_SPARK_COLORS = [
  '#FDE047',
  '#F59E0B',
  '#38BDF8',
  '#34D399',
  '#F87171',
  '#C084FC',
];

const VICTORY_DEBRIS_COLORS = [
  '#F59E0B',
  '#3B82F6',
  '#10B981',
  '#EF4444',
  '#E2E8F0',
  '#A855F7',
];

function hexToRgbNormalized(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  if (Number.isNaN(num)) {
    return { r: 1, g: 0.85, b: 0.3 };
  }
  return {
    r: ((num >> 16) & 255) / 255,
    g: ((num >> 8) & 255) / 255,
    b: (num & 255) / 255,
  };
}

function createEmptyUnit(kind: ParticleKind): Particle3DUnit {
  return {
    active: false,
    kind,
    x: 0,
    y: 0,
    z: -100,
    vx: 0,
    vy: 0,
    vz: 0,
    rx: 0,
    ry: 0,
    rz: 0,
    vrx: 0,
    vry: 0,
    vrz: 0,
    life: 0,
    maxLife: 0.6,
    size: 1,
    r: 1,
    g: 0.85,
    b: 0.3,
    bounces: 0,
  };
}

/**
 * Creates a pre-allocated zero-GC particle pool for both metallic sparks and 3D debris fragments.
 */
export function createParticle3DPool(): Particle3DPool {
  return {
    sparks: Array.from({ length: SPARK_CAPACITY }, () =>
      createEmptyUnit('spark')
    ),
    debris: Array.from({ length: DEBRIS_CAPACITY }, () =>
      createEmptyUnit('debris')
    ),
    sparkCursor: 0,
    debrisCursor: 0,
    totalPlateBursts: 0,
    totalVictoryBursts: 0,
  };
}

function allocateSpark(pool: Particle3DPool): Particle3DUnit {
  const unit = pool.sparks[pool.sparkCursor];
  pool.sparkCursor = (pool.sparkCursor + 1) % pool.sparks.length;
  return unit;
}

function allocateDebris(pool: Particle3DPool): Particle3DUnit {
  const unit = pool.debris[pool.debrisCursor];
  pool.debrisCursor = (pool.debrisCursor + 1) % pool.debris.length;
  return unit;
}

/**
 * Spawns localized metallic sparks and micro-debris when a bolt is unscrewed, matched, or struck by the Hammer.
 */
export function emitBoltSparks(
  pool: Particle3DPool,
  wx: number,
  wy: number,
  wz: number,
  hexColor: string,
  sparkCount = 14,
  debrisCount = 4
): void {
  const baseRgb = hexToRgbNormalized(hexColor);
  const hotRgb = hexToRgbNormalized('#FEF08A');

  for (let i = 0; i < sparkCount; i++) {
    const p = allocateSpark(pool);
    const angle =
      (i / Math.max(1, sparkCount)) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
    const speed = 1.8 + Math.random() * 3.6;
    const useHot = i % 3 === 0;
    const c = useHot ? hotRgb : baseRgb;

    p.active = true;
    p.x = wx;
    p.y = wy;
    p.z = wz;
    p.vx = Math.cos(angle) * speed;
    p.vy = Math.sin(angle) * speed;
    p.vz = 2.0 + Math.random() * 2.8;
    p.rx = Math.random() * Math.PI;
    p.ry = Math.random() * Math.PI;
    p.rz = angle;
    p.vrx = (Math.random() - 0.5) * 14;
    p.vry = (Math.random() - 0.5) * 14;
    p.vrz = (Math.random() - 0.5) * 14;
    p.life = 0;
    p.maxLife = 0.36 + Math.random() * 0.26;
    p.size = 0.75 + Math.random() * 0.65;
    p.r = c.r;
    p.g = c.g;
    p.b = c.b;
    p.bounces = 0;
  }

  for (let i = 0; i < debrisCount; i++) {
    const d = allocateDebris(pool);
    const angle =
      (i / Math.max(1, debrisCount)) * Math.PI * 2 +
      (Math.random() - 0.5) * 0.6;
    const speed = 1.2 + Math.random() * 2.4;

    d.active = true;
    d.x = wx + (Math.random() - 0.5) * 0.15;
    d.y = wy + (Math.random() - 0.5) * 0.15;
    d.z = wz + 0.05;
    d.vx = Math.cos(angle) * speed;
    d.vy = Math.sin(angle) * speed;
    d.vz = 2.2 + Math.random() * 2.2;
    d.rx = Math.random() * Math.PI * 2;
    d.ry = Math.random() * Math.PI * 2;
    d.rz = Math.random() * Math.PI * 2;
    d.vrx = (Math.random() - 0.5) * 16;
    d.vry = (Math.random() - 0.5) * 16;
    d.vrz = (Math.random() - 0.5) * 16;
    d.life = 0;
    d.maxLife = 0.58 + Math.random() * 0.35;
    d.size = 0.65 + Math.random() * 0.55;
    d.r = baseRgb.r;
    d.g = baseRgb.g;
    d.b = baseRgb.b;
    d.bounces = 0;
  }
}

/**
 * Triggers a rich 3D burst of metallic sparks and tumbling plate debris shards along a cleared plate's geometry.
 */
export function emitPlateCleared(
  pool: Particle3DPool,
  plate: Pick<
    PlateState,
    'x' | 'y' | 'width' | 'height' | 'layer' | 'materialType'
  >,
  layerSpacing = 0.28
): void {
  pool.totalPlateBursts += 1;
  const palette =
    PLATE_MATERIAL_PALETTE[plate.materialType] ??
    PLATE_MATERIAL_PALETTE['brushed-brass'];
  const primaryRgb = hexToRgbNormalized(palette.primaryHex);
  const secondaryRgb = hexToRgbNormalized(palette.secondaryHex);
  const sparkRgb = hexToRgbNormalized(palette.sparkHex);

  const plateZ = plate.layer * layerSpacing + 0.18;
  const halfW = Math.max(0.4, plate.width * 0.45);
  const halfH = Math.max(0.3, plate.height * 0.45);

  // 1. Spawn 36 high-velocity metallic sparks radiating from the plate's perimeter & bolt mounts
  const sparkCount = 36;
  for (let i = 0; i < sparkCount; i++) {
    const p = allocateSpark(pool);
    const perimeterT = i / sparkCount;
    const angle = perimeterT * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
    const offsetX = (Math.random() - 0.5) * 2 * halfW;
    const offsetY = (Math.random() - 0.5) * 2 * halfH;
    const speed = 2.0 + Math.random() * 4.2;
    const c = i % 2 === 0 ? sparkRgb : primaryRgb;

    p.active = true;
    p.x = plate.x + offsetX;
    p.y = plate.y + offsetY;
    p.z = plateZ;
    p.vx = Math.cos(angle) * speed + offsetX * 0.8;
    p.vy = Math.sin(angle) * speed + offsetY * 0.8;
    p.vz = 2.4 + Math.random() * 3.4;
    p.rx = Math.random() * Math.PI * 2;
    p.ry = Math.random() * Math.PI * 2;
    p.rz = angle;
    p.vrx = (Math.random() - 0.5) * 18;
    p.vry = (Math.random() - 0.5) * 18;
    p.vrz = (Math.random() - 0.5) * 18;
    p.life = 0;
    p.maxLife = 0.52 + Math.random() * 0.38;
    p.size = 0.85 + Math.random() * 0.85;
    p.r = c.r;
    p.g = c.g;
    p.b = c.b;
    p.bounces = 0;
  }

  // 2. Spawn 22 physical 3D metallic/acrylic debris shards tumbling & bouncing off the workbench
  const debrisCount = 22;
  for (let i = 0; i < debrisCount; i++) {
    const d = allocateDebris(pool);
    const offsetX = (Math.random() - 0.5) * 2 * halfW;
    const offsetY = (Math.random() - 0.5) * 2 * halfH;
    const angle = Math.atan2(offsetY, offsetX) + (Math.random() - 0.5) * 0.8;
    const speed = 1.4 + Math.random() * 3.0;
    const c = i % 3 === 0 ? secondaryRgb : primaryRgb;

    d.active = true;
    d.x = plate.x + offsetX;
    d.y = plate.y + offsetY;
    d.z = plateZ + 0.05;
    d.vx = Math.cos(angle) * speed;
    d.vy = Math.sin(angle) * speed;
    d.vz = 2.6 + Math.random() * 3.2;
    d.rx = Math.random() * Math.PI * 2;
    d.ry = Math.random() * Math.PI * 2;
    d.rz = Math.random() * Math.PI * 2;
    d.vrx = (Math.random() - 0.5) * 20;
    d.vry = (Math.random() - 0.5) * 20;
    d.vrz = (Math.random() - 0.5) * 20;
    d.life = 0;
    d.maxLife = 0.85 + Math.random() * 0.45;
    d.size = 0.85 + Math.random() * 0.75;
    d.r = c.r;
    d.g = c.g;
    d.b = c.b;
    d.bounces = 0;
  }
}

/**
 * Triggers a grand multi-origin 3D celebratory firework of metallic sparks and tumbling debris when a level is won.
 */
export function emitLevelVictory(pool: Particle3DPool): void {
  pool.totalVictoryBursts += 1;

  const emitters = [
    { x: -3.55, y: 0.35, z: 2.15 },
    { x: 3.55, y: 0.35, z: 2.15 },
    { x: -2.2, y: 2.35, z: 2.1 },
    { x: 2.2, y: 2.35, z: 2.1 },
  ];

  for (let eIdx = 0; eIdx < emitters.length; eIdx++) {
    const origin = emitters[eIdx];

    // 22 metallic sparks per fountain (88 sparks total)
    for (let i = 0; i < 22; i++) {
      const p = allocateSpark(pool);
      const colorHex =
        VICTORY_SPARK_COLORS[(i + eIdx * 2) % VICTORY_SPARK_COLORS.length];
      const rgb = hexToRgbNormalized(colorHex);
      const angle = (i / 22) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
      const speed = 1.8 + Math.random() * 3.6;

      p.active = true;
      p.x = origin.x + (Math.random() - 0.5) * 0.25;
      p.y = origin.y + (Math.random() - 0.5) * 0.25;
      p.z = origin.z;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed + 0.9;
      p.vz = 1.6 + Math.random() * 2.4;
      p.rx = Math.random() * Math.PI * 2;
      p.ry = Math.random() * Math.PI * 2;
      p.rz = angle;
      p.vrx = (Math.random() - 0.5) * 16;
      p.vry = (Math.random() - 0.5) * 16;
      p.vrz = (Math.random() - 0.5) * 16;
      p.life = 0;
      p.maxLife = 0.75 + Math.random() * 0.5;
      p.size = 0.75 + Math.random() * 0.55;
      p.r = rgb.r;
      p.g = rgb.g;
      p.b = rgb.b;
      p.bounces = 0;
    }

    // 14 tumbling 3D metallic debris fragments per fountain (56 debris shards total)
    for (let i = 0; i < 14; i++) {
      const d = allocateDebris(pool);
      const colorHex =
        VICTORY_DEBRIS_COLORS[(i + eIdx) % VICTORY_DEBRIS_COLORS.length];
      const rgb = hexToRgbNormalized(colorHex);
      const angle = (i / 14) * Math.PI * 2 + (Math.random() - 0.5) * 0.45;
      const speed = 1.4 + Math.random() * 2.8;

      d.active = true;
      d.x = origin.x + (Math.random() - 0.5) * 0.35;
      d.y = origin.y + (Math.random() - 0.5) * 0.35;
      d.z = origin.z + 0.08;
      d.vx = Math.cos(angle) * speed;
      d.vy = Math.sin(angle) * speed + 0.7;
      d.vz = 1.5 + Math.random() * 2.4;
      d.rx = Math.random() * Math.PI * 2;
      d.ry = Math.random() * Math.PI * 2;
      d.rz = Math.random() * Math.PI * 2;
      d.vrx = (Math.random() - 0.5) * 20;
      d.vry = (Math.random() - 0.5) * 20;
      d.vrz = (Math.random() - 0.5) * 20;
      d.life = 0;
      d.maxLife = 1.05 + Math.random() * 0.55;
      d.size = 0.8 + Math.random() * 0.65;
      d.r = rgb.r;
      d.g = rgb.g;
      d.b = rgb.b;
      d.bounces = 0;
    }
  }
}

/**
 * Advances all active 3D sparks and debris fragments by `dt` seconds with gravity, drag, and workbench surface bounce.
 */
export function stepParticles3D(pool: Particle3DPool, dt: number): void {
  const stepUnit = (p: Particle3DUnit, gravity: number, drag: number) => {
    if (!p.active) return;
    p.life += dt;
    if (p.life >= p.maxLife) {
      p.active = false;
      return;
    }

    p.vx *= 1 - drag * dt;
    p.vy *= 1 - drag * dt;
    p.vz -= gravity * dt;

    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z += p.vz * dt;

    // Bounce off the steel workbench deck (z = 0.05) within the board bounds
    if (
      p.z < 0.05 &&
      p.vz < 0 &&
      p.bounces < 2 &&
      Math.abs(p.x) < 4.8 &&
      Math.abs(p.y) < 3.6
    ) {
      p.z = 0.05;
      p.vz = -p.vz * (p.kind === 'debris' ? 0.52 : 0.42);
      p.vx *= 0.78;
      p.vy *= 0.78;
      p.bounces += 1;
    }

    p.rx += p.vrx * dt;
    p.ry += p.vry * dt;
    p.rz += p.vrz * dt;
  };

  for (let i = 0; i < pool.sparks.length; i++) {
    stepUnit(pool.sparks[i], 10.8, 0.8);
  }
  for (let i = 0; i < pool.debris.length; i++) {
    stepUnit(pool.debris[i], 13.5, 0.45);
  }
}

/**
 * Returns active counts and cumulative burst counters for inspection and automated tests.
 */
export function getParticle3DStats(pool: Particle3DPool): {
  activeSparks: number;
  activeDebris: number;
  totalPlateBursts: number;
  totalVictoryBursts: number;
} {
  let activeSparks = 0;
  for (let i = 0; i < pool.sparks.length; i++) {
    if (pool.sparks[i].active) activeSparks++;
  }
  let activeDebris = 0;
  for (let i = 0; i < pool.debris.length; i++) {
    if (pool.debris[i].active) activeDebris++;
  }
  return {
    activeSparks,
    activeDebris,
    totalPlateBursts: pool.totalPlateBursts,
    totalVictoryBursts: pool.totalVictoryBursts,
  };
}

// Pre-allocated scratch math objects for updating InstancedMesh transforms (Zero GC in 60fps loop)
const _pos = new THREE.Vector3();
const _euler = new THREE.Euler();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _mat4 = new THREE.Matrix4();
const _color = new THREE.Color();

export interface SceneParticleSystem3D {
  pool: Particle3DPool;
  sparkMesh: THREE.InstancedMesh;
  debrisMesh: THREE.InstancedMesh;
  emitBolt: (
    wx: number,
    wy: number,
    wz: number,
    hexColor: string,
    sparkCount?: number,
    debrisCount?: number
  ) => void;
  emitPlate: (
    plate: Pick<
      PlateState,
      'x' | 'y' | 'width' | 'height' | 'layer' | 'materialType'
    >,
    layerSpacing?: number
  ) => void;
  emitVictory: () => void;
  update: (dt: number) => void;
  dispose: () => void;
}

/**
 * Builds the dual-InstancedMesh 3D Particle System (Metallic Sparks + Physical 3D Debris Shards)
 * and attaches it to the Three.js scene.
 */
export function createSceneParticleSystem3D(
  scene: THREE.Scene
): SceneParticleSystem3D {
  const pool = createParticle3DPool();

  // 1. Metallic Sparks InstancedMesh (Crisp diamond spark crystals)
  const sparkGeo = new THREE.OctahedronGeometry(0.056, 0);
  sparkGeo.scale(0.65, 0.65, 1.35);
  const sparkMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.96,
  });
  const sparkMesh = new THREE.InstancedMesh(
    sparkGeo,
    sparkMat,
    SPARK_CAPACITY
  );
  sparkMesh.frustumCulled = false;
  sparkMesh.instanceColor = new THREE.InstancedBufferAttribute(
    new Float32Array(SPARK_CAPACITY * 3),
    3
  );
  scene.add(sparkMesh);

  // 2. Physical 3D Debris Shards InstancedMesh (Machined hexagonal metallic/acrylic shards & nuts)
  const debrisGeo = new THREE.CylinderGeometry(0.095, 0.082, 0.042, 6);
  const debrisMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.2,
    metalness: 0.88,
    clearcoat: 0.68,
    clearcoatRoughness: 0.16,
    envMapIntensity: 1.9,
  });
  const debrisMesh = new THREE.InstancedMesh(
    debrisGeo,
    debrisMat,
    DEBRIS_CAPACITY
  );
  debrisMesh.frustumCulled = false;
  debrisMesh.castShadow = false;
  debrisMesh.receiveShadow = true;
  debrisMesh.instanceColor = new THREE.InstancedBufferAttribute(
    new Float32Array(DEBRIS_CAPACITY * 3),
    3
  );
  scene.add(debrisMesh);

  // Initialize all instances to zero scale
  _mat4.makeScale(0, 0, 0);
  for (let i = 0; i < SPARK_CAPACITY; i++) {
    sparkMesh.setMatrixAt(i, _mat4);
  }
  for (let i = 0; i < DEBRIS_CAPACITY; i++) {
    debrisMesh.setMatrixAt(i, _mat4);
  }
  sparkMesh.instanceMatrix.needsUpdate = true;
  debrisMesh.instanceMatrix.needsUpdate = true;

  function syncMeshes() {
    for (let i = 0; i < SPARK_CAPACITY; i++) {
      const p = pool.sparks[i];
      if (p.active) {
        const lifeRatio = 1 - p.life / p.maxLife;
        const s = p.size * lifeRatio;
        _pos.set(p.x, p.y, p.z);
        _euler.set(p.rx, p.ry, p.rz);
        _quat.setFromEuler(_euler);
        _scale.set(s, s, s * 1.25);
        _mat4.compose(_pos, _quat, _scale);
        sparkMesh.setMatrixAt(i, _mat4);
        _color.setRGB(p.r, p.g, p.b);
        sparkMesh.setColorAt(i, _color);
      } else {
        _mat4.makeScale(0, 0, 0);
        sparkMesh.setMatrixAt(i, _mat4);
      }
    }
    sparkMesh.instanceMatrix.needsUpdate = true;
    if (sparkMesh.instanceColor) {
      sparkMesh.instanceColor.needsUpdate = true;
    }

    for (let i = 0; i < DEBRIS_CAPACITY; i++) {
      const d = pool.debris[i];
      if (d.active) {
        const fadeOut =
          d.life > d.maxLife * 0.7
            ? 1 - (d.life - d.maxLife * 0.7) / (d.maxLife * 0.3)
            : 1;
        const s = d.size * Math.max(0, fadeOut);
        _pos.set(d.x, d.y, d.z);
        _euler.set(d.rx, d.ry, d.rz);
        _quat.setFromEuler(_euler);
        // Slightly flatten/vary proportions so shards look like machined fragments
        _scale.set(s * 1.12, s * 0.78, s);
        _mat4.compose(_pos, _quat, _scale);
        debrisMesh.setMatrixAt(i, _mat4);
        _color.setRGB(d.r, d.g, d.b);
        debrisMesh.setColorAt(i, _color);
      } else {
        _mat4.makeScale(0, 0, 0);
        debrisMesh.setMatrixAt(i, _mat4);
      }
    }
    debrisMesh.instanceMatrix.needsUpdate = true;
    if (debrisMesh.instanceColor) {
      debrisMesh.instanceColor.needsUpdate = true;
    }
  }

  return {
    pool,
    sparkMesh,
    debrisMesh,
    emitBolt: (wx, wy, wz, hexColor, sparkCount, debrisCount) => {
      emitBoltSparks(pool, wx, wy, wz, hexColor, sparkCount, debrisCount);
    },
    emitPlate: (plate, layerSpacing) => {
      emitPlateCleared(pool, plate, layerSpacing);
    },
    emitVictory: () => {
      emitLevelVictory(pool);
    },
    update: (dt: number) => {
      stepParticles3D(pool, dt);
      syncMeshes();
    },
    dispose: () => {
      scene.remove(sparkMesh);
      scene.remove(debrisMesh);
      sparkGeo.dispose();
      sparkMat.dispose();
      debrisGeo.dispose();
      debrisMat.dispose();
    },
  };
}
