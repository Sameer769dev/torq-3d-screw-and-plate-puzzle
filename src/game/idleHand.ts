export const DEFAULT_IDLE_THRESHOLD_SEC = 3.2;

export interface IdleHandState {
  idleSec: number;
  thresholdSec: number;
  isIdle: boolean;
  targetScrewId: string | null;
  revealBlend: number;
  bobOffsetZ: number;
  tapCompression: number;
  tapPhase: number;
  wristTiltX: number;
  wristTiltZ: number;
  ringPulse: number;
}

/**
 * Creates the initial state for the 3D Idle Guide Hand that hovers over the
 * optimal solver bolt when the player is idle for `thresholdSec` seconds.
 */
export function createIdleHandState(
  thresholdSec = DEFAULT_IDLE_THRESHOLD_SEC
): IdleHandState {
  return {
    idleSec: 0,
    thresholdSec: Math.max(0, thresholdSec),
    isIdle: false,
    targetScrewId: null,
    revealBlend: 0,
    bobOffsetZ: 0.25,
    tapCompression: 0,
    tapPhase: 0,
    wristTiltX: 0,
    wristTiltZ: 0,
    ringPulse: 0,
  };
}

/**
 * Resets the idle timer whenever the player performs an action (clicking a bolt,
 * pressing a button, orbiting the camera, or using keyboard controls).
 */
export function resetIdleTimer(state: IdleHandState): void {
  state.idleSec = 0;
  state.isIdle = false;
}

/**
 * Immediately activates the idle hand over `targetScrewId` (used for testing or instant hint).
 */
export function forceIdleHand(
  state: IdleHandState,
  targetScrewId: string | null
): void {
  state.idleSec = state.thresholdSec + 0.1;
  state.isIdle = Boolean(targetScrewId);
  state.targetScrewId = targetScrewId;
}

/**
 * Advances the idle timer and computes the 3D hovering + double-tap beckoning
 * choreography over the correct solver bolt (`solverScrewId`).
 */
export function stepIdleHandState(
  state: IdleHandState,
  dt: number,
  isPlayingActive: boolean,
  solverScrewId: string | null
): void {
  const wallDt = Math.min(Math.max(dt, 0.001), 2.0);
  const animDt = Math.min(wallDt, 0.12);

  if (!isPlayingActive || !solverScrewId) {
    state.idleSec = 0;
    state.isIdle = false;
    state.revealBlend = Math.max(0, state.revealBlend - animDt * 6.5);
    if (state.revealBlend <= 0.01) {
      state.targetScrewId = null;
    }
    return;
  }

  state.idleSec += wallDt;

  if (state.idleSec >= state.thresholdSec) {
    state.isIdle = true;
    state.targetScrewId = solverScrewId;
  } else {
    state.isIdle = false;
  }

  // Smoothly blend the 3D hand in/out
  const targetBlend = state.isIdle ? 1 : 0;
  const blendSpeed = state.isIdle ? 5.5 : 8.0;
  state.revealBlend +=
    (targetBlend - state.revealBlend) * Math.min(1, wallDt * blendSpeed);

  if (state.revealBlend > 0.005) {
    state.tapPhase = (state.tapPhase + animDt * 0.85) % 1.0;
    const p = state.tapPhase;

    // Rhythmic "double-tap then hover" gesture:
    // 0.00..0.22: first downward tap toward the bolt head
    // 0.22..0.44: second downward tap toward the bolt head
    // 0.44..1.00: gentle floating hover above the bolt head
    let tapDip = 0;
    if (p < 0.22) {
      const local = p / 0.22;
      tapDip = Math.sin(local * Math.PI);
    } else if (p < 0.44) {
      const local = (p - 0.22) / 0.22;
      tapDip = Math.sin(local * Math.PI) * 0.92;
    }

    const floatWave = Math.sin(p * Math.PI * 2) * 0.06;
    state.tapCompression = tapDip;
    state.bobOffsetZ = 0.28 - tapDip * 0.19 + floatWave + (1 - state.revealBlend) * 0.55;
    state.wristTiltX = -0.32 - tapDip * 0.16 + Math.cos(p * Math.PI * 2) * 0.04;
    state.wristTiltZ = -0.28 + Math.sin(p * Math.PI * 2) * 0.05;
    state.ringPulse = 0.5 + 0.5 * Math.sin(p * Math.PI * 4);
  } else {
    state.tapCompression = 0;
    state.bobOffsetZ = 0.65;
    state.ringPulse = 0;
  }
}

export function getIdleHandStats(state: IdleHandState) {
  return {
    idleSec: Number(state.idleSec.toFixed(2)),
    thresholdSec: state.thresholdSec,
    isIdle: state.isIdle,
    targetScrewId: state.targetScrewId,
    handVisible: state.revealBlend > 0.05,
    revealBlend: Number(state.revealBlend.toFixed(3)),
    bobOffsetZ: Number(state.bobOffsetZ.toFixed(3)),
    tapCompression: Number(state.tapCompression.toFixed(3)),
  };
}
