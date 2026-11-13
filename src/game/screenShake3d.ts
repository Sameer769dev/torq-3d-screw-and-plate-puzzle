export type ScreenShakeEventType =
  | 'none'
  | 'plate-drop'
  | 'box-complete'
  | 'hammer'
  | 'blocked'
  | 'victory';

export interface ScreenShake3DState {
  trauma: number;
  dispX: number;
  dispY: number;
  dispZ: number;
  velX: number;
  velY: number;
  velZ: number;
  rollZ: number;
  velRollZ: number;
  pitchX: number;
  velPitchX: number;
  fovPunch: number;
  velFov: number;
  flashAlpha: number;
  offsetX: number;
  offsetY: number;
  offsetZ: number;
  plateDropShakes: number;
  boxCompleteShakes: number;
  lastEvent: ScreenShakeEventType;
}

/**
 * Creates a physical spring-damper + trauma 3D screen-shake state.
 */
export function createScreenShake3DState(): ScreenShake3DState {
  return {
    trauma: 0,
    dispX: 0,
    dispY: 0,
    dispZ: 0,
    velX: 0,
    velY: 0,
    velZ: 0,
    rollZ: 0,
    velRollZ: 0,
    pitchX: 0,
    velPitchX: 0,
    fovPunch: 0,
    velFov: 0,
    flashAlpha: 0,
    offsetX: 0,
    offsetY: 0,
    offsetZ: 0,
    plateDropShakes: 0,
    boxCompleteShakes: 0,
    lastEvent: 'none',
  };
}

/**
 * Triggers a heavy vertical mechanical thud + pitch/roll shake when one or more plates drop/clear from the board.
 */
export function triggerPlateDropShake(
  state: ScreenShake3DState,
  platesCount = 1
): void {
  const scale = Math.min(1.75, 1 + (Math.max(1, platesCount) - 1) * 0.35);
  state.plateDropShakes += Math.max(1, platesCount);
  state.lastEvent = 'plate-drop';
  state.trauma = Math.min(0.92, state.trauma + 0.48 * scale);

  // Heavy downward mechanical recoil impulse + rotational torque + camera FOV kick
  const dir = state.plateDropShakes % 2 === 0 ? 1 : -1;
  state.velY -= 2.85 * scale;
  state.velX += dir * 1.15 * scale;
  state.velZ -= 1.35 * scale;
  state.velRollZ += dir * 0.24 * scale;
  state.velPitchX += 0.22 * scale;
  state.velFov += 8.5 * scale;
  state.flashAlpha = Math.min(1, state.flashAlpha + 0.55 * scale);
}

/**
 * Triggers a crisp mechanical latch-lock shockwave when a Target Collector Box is completed (3 matching bolts).
 */
export function triggerBoxCompleteShake(
  state: ScreenShake3DState,
  boxesCount = 1
): void {
  const scale = Math.min(1.75, 1 + (Math.max(1, boxesCount) - 1) * 0.4);
  state.boxCompleteShakes += Math.max(1, boxesCount);
  state.lastEvent = 'box-complete';
  state.trauma = Math.min(0.9, state.trauma + 0.44 * scale);

  // Snappy upward/axial latch snap + zoom-in FOV punch when the collector tray seals
  const dir = state.boxCompleteShakes % 2 === 0 ? -1 : 1;
  state.velY += 2.35 * scale;
  state.velZ += 1.65 * scale;
  state.velX += dir * 0.95 * scale;
  state.velRollZ += dir * 0.2 * scale;
  state.velPitchX -= 0.19 * scale;
  state.velFov -= 9.5 * scale;
  state.flashAlpha = Math.min(1, state.flashAlpha + 0.65 * scale);
}

/**
 * Triggers a celebratory multi-axis harmonic shake when the entire level is cleared.
 */
export function triggerVictoryShake(state: ScreenShake3DState): void {
  state.lastEvent = 'victory';
  state.trauma = Math.min(1.0, state.trauma + 0.62);
  state.velY += 2.6;
  state.velZ += 2.1;
  state.velRollZ += 0.26;
  state.velPitchX -= 0.24;
  state.velFov -= 11.0;
  state.flashAlpha = 1.0;
}

/**
 * Triggers a tactile rattle when a blocked screw is clicked or a heavy impact occurs during a Hammer strike.
 */
export function triggerAuxiliaryShake(
  state: ScreenShake3DState,
  kind: 'blocked' | 'hammer'
): void {
  state.lastEvent = kind;
  if (kind === 'hammer') {
    state.trauma = Math.min(0.95, state.trauma + 0.52);
    state.velY -= 2.6;
    state.velZ -= 1.85;
    state.velPitchX += 0.22;
    state.velFov += 9.0;
    state.flashAlpha = Math.min(1, state.flashAlpha + 0.7);
  } else {
    state.trauma = Math.min(0.5, state.trauma + 0.22);
    state.velX += 1.15;
    state.velRollZ += 0.1;
  }
}

/**
 * Advances the underdamped spring-damper and trauma harmonic oscillation by `dt` seconds.
 * Produces responsive, physically grounded 3D camera/workbench offsets (`offsetX`, `offsetY`, `offsetZ`, `rollZ`, `pitchX`, `fovPunch`).
 */
export function stepScreenShake3D(
  state: ScreenShake3DState,
  dt: number,
  elapsedSec: number
): void {
  const safeDt = Math.min(Math.max(dt, 0.001), 0.05);

  // Underdamped spring constants for crisp mechanical recoil recovery
  const stiffness = 210;
  const damping = 15.5;

  state.velX += (-stiffness * state.dispX - damping * state.velX) * safeDt;
  state.velY += (-stiffness * state.dispY - damping * state.velY) * safeDt;
  state.velZ += (-stiffness * state.dispZ - damping * state.velZ) * safeDt;
  state.velRollZ +=
    (-stiffness * state.rollZ - damping * state.velRollZ) * safeDt;
  state.velPitchX +=
    (-stiffness * state.pitchX - damping * state.velPitchX) * safeDt;
  state.velFov +=
    (-stiffness * state.fovPunch - damping * state.velFov) * safeDt;

  state.dispX += state.velX * safeDt;
  state.dispY += state.velY * safeDt;
  state.dispZ += state.velZ * safeDt;
  state.rollZ += state.velRollZ * safeDt;
  state.pitchX += state.velPitchX * safeDt;
  state.fovPunch += state.velFov * safeDt;

  // Quadratic trauma decay (high-frequency mechanical vibration)
  if (state.trauma > 0) {
    state.trauma = Math.max(0, state.trauma - safeDt * 2.15);
  }
  if (state.flashAlpha > 0) {
    state.flashAlpha = Math.max(0, state.flashAlpha - safeDt * 3.8);
  }

  const shakeMag = state.trauma * state.trauma * 0.24;
  const vibX =
    (Math.sin(elapsedSec * 64) * 0.65 + Math.cos(elapsedSec * 97) * 0.35) *
    shakeMag;
  const vibY =
    (Math.cos(elapsedSec * 71) * 0.65 + Math.sin(elapsedSec * 89) * 0.35) *
    shakeMag;
  const vibZ = Math.sin(elapsedSec * 78) * shakeMag * 0.65;

  // Clamp total offset so the shake is punchy and tactile without disorienting the camera
  state.offsetX = Math.max(-0.38, Math.min(0.38, state.dispX + vibX));
  state.offsetY = Math.max(-0.38, Math.min(0.38, state.dispY + vibY));
  state.offsetZ = Math.max(-0.28, Math.min(0.28, state.dispZ + vibZ));
  state.fovPunch = Math.max(-2.2, Math.min(2.2, state.fovPunch));
}

export function getScreenShakeStats(state: ScreenShake3DState): {
  active: boolean;
  trauma: number;
  offsetX: number;
  offsetY: number;
  offsetZ: number;
  rollZ: number;
  pitchX: number;
  fovPunch: number;
  flashAlpha: number;
  plateDropShakes: number;
  boxCompleteShakes: number;
  lastEvent: ScreenShakeEventType;
} {
  const mag = Math.hypot(state.offsetX, state.offsetY, state.offsetZ);
  return {
    active:
      state.trauma > 0.005 || mag > 0.002 || Math.abs(state.fovPunch) > 0.02,
    trauma: Number(state.trauma.toFixed(4)),
    offsetX: Number(state.offsetX.toFixed(4)),
    offsetY: Number(state.offsetY.toFixed(4)),
    offsetZ: Number(state.offsetZ.toFixed(4)),
    rollZ: Number(state.rollZ.toFixed(4)),
    pitchX: Number(state.pitchX.toFixed(4)),
    fovPunch: Number(state.fovPunch.toFixed(4)),
    flashAlpha: Number(state.flashAlpha.toFixed(4)),
    plateDropShakes: state.plateDropShakes,
    boxCompleteShakes: state.boxCompleteShakes,
    lastEvent: state.lastEvent,
  };
}
