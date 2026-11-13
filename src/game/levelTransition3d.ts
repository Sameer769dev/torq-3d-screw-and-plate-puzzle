import { GamePhase } from './types';

export type PowerUpSlotIndex = 0 | 1 | 2 | 3; // 0: HAMMER, 1: +1 SLOT, 2: PEEK, 3: CAM

export interface PowerUpButtonAnimState {
  scale: number;
  zOffset: number;
  rotX: number;
  rotZ: number;
  chargeFired: boolean;
  activationTimer: number;
  activationDuration: number;
}

export interface LevelTransition3DState {
  levelTransitionCount: number;
  introProgress: number; // 0 -> 1 over ~0.92s when a level starts
  introActive: boolean;
  modalBlend: number; // 1 = modal fully shown, 0 = modal hidden (smoothly interpolated)
  hudBlend: number; // 1 = playing 3D HUD fully docked, 0 = retracted off-rail
  topRailOffsetY: number;
  bottomDeckOffsetY: number;
  extraSlotPopTimer: number; // > 0 when 6th dock bore is animating in
  powerUpButtons: [
    PowerUpButtonAnimState,
    PowerUpButtonAnimState,
    PowerUpButtonAnimState,
    PowerUpButtonAnimState,
  ];
  powerUpChargeBurstsTriggered: number;
  powerUpActivationsTriggered: number;
}

function createEmptyButtonAnim(): PowerUpButtonAnimState {
  return {
    scale: 1,
    zOffset: 0,
    rotX: 0,
    rotZ: 0,
    chargeFired: false,
    activationTimer: 0,
    activationDuration: 0.42,
  };
}

/**
 * Creates the state machine for smooth 3D level transitions, level-start power-up charge waves,
 * and interactive power-up activation animations.
 */
export function createLevelTransition3DState(
  initialPhase: GamePhase = 'title'
): LevelTransition3DState {
  const isPlaying = initialPhase === 'playing';
  return {
    levelTransitionCount: 0,
    introProgress: isPlaying ? 0 : 1,
    introActive: isPlaying,
    modalBlend: isPlaying ? 0 : 1,
    hudBlend: isPlaying ? 1 : 0,
    topRailOffsetY: isPlaying ? 0 : 1.6,
    bottomDeckOffsetY: isPlaying ? 0 : -1.6,
    extraSlotPopTimer: 0,
    powerUpButtons: [
      createEmptyButtonAnim(),
      createEmptyButtonAnim(),
      createEmptyButtonAnim(),
      createEmptyButtonAnim(),
    ],
    powerUpChargeBurstsTriggered: 0,
    powerUpActivationsTriggered: 0,
  };
}

/**
 * Starts a fresh level entrance transition and arms the sequential 4-button Power-Up Charge Wave.
 */
export function startLevelTransition3D(state: LevelTransition3DState): void {
  state.levelTransitionCount += 1;
  state.introProgress = 0;
  state.introActive = true;
  state.hudBlend = Math.min(state.hudBlend, 0.15);
  state.topRailOffsetY = 1.45;
  state.bottomDeckOffsetY = -1.45;

  for (let i = 0; i < 4; i++) {
    const btn = state.powerUpButtons[i];
    btn.chargeFired = false;
    btn.scale = 0.72;
    btn.zOffset = -0.08;
    btn.rotX = 0.25;
    btn.rotZ = 0;
  }
}

/**
 * Triggers a snappy 3D animation on a specific power-up button when activated by the player.
 * Also arms the 3D 6th-dock-bore pop animation if `slotIndex === 1` (+1 SLOT).
 */
export function triggerPowerUpActivation3D(
  state: LevelTransition3DState,
  slotIndex: PowerUpSlotIndex
): void {
  const btn = state.powerUpButtons[slotIndex];
  if (!btn) return;
  btn.activationTimer = btn.activationDuration;
  state.powerUpActivationsTriggered += 1;
  if (slotIndex === 1) {
    state.extraSlotPopTimer = 0.55;
  }
}

/**
 * Smooth back-out easing curve (overshoots slightly past 1.0 and settles to 1.0) for tactile 3D pops.
 */
export function easeOutBack(t: number, overshoot = 1.65): number {
  const clamped = Math.max(0, Math.min(1, t));
  const c3 = overshoot + 1;
  return 1 + c3 * Math.pow(clamped - 1, 3) + overshoot * Math.pow(clamped - 1, 2);
}

/**
 * Advances the level transition, modal/HUD slide choreography, level-start power-up charge wave,
 * and active power-up button animations by `dt` seconds.
 * Calls `onPowerUpChargeBurst(slotIndex)` as each power-up charges up at the start of a level.
 */
export function stepLevelTransition3D(
  state: LevelTransition3DState,
  phase: GamePhase,
  dt: number,
  onPowerUpChargeBurst?: (slotIndex: PowerUpSlotIndex) => void,
  forceModalOpen = false
): void {
  const safeDt = Math.min(Math.max(dt, 0.001), 0.05);

  // 1. Smoothly blend Modal Plinth (visible in title/paused/gameover or when Sound Settings Console is open)
  const showModal = phase !== 'playing' || forceModalOpen;
  const targetModal = showModal ? 1 : 0;
  const modalSpeed = showModal ? 12.5 : 15.5;
  state.modalBlend +=
    (targetModal - state.modalBlend) * (1 - Math.exp(-modalSpeed * safeDt));
  if (Math.abs(targetModal - state.modalBlend) < 0.005) {
    state.modalBlend = targetModal;
  }

  // 2. Smoothly blend 3D Workbench HUD Rails (top readout/trays/utility & bottom power-up deck)
  const targetHud = phase === 'playing' ? 1 : 0;
  const hudSpeed = 7.8;
  state.hudBlend +=
    (targetHud - state.hudBlend) * (1 - Math.exp(-hudSpeed * safeDt));
  if (Math.abs(targetHud - state.hudBlend) < 0.002) {
    state.hudBlend = targetHud;
  }

  const easedHud = easeOutBack(state.hudBlend, 1.15);
  state.topRailOffsetY = (1 - easedHud) * 1.45;
  state.bottomDeckOffsetY = -(1 - easedHud) * 1.45;

  // 3. Advance Level-Start Intro & Sequential Power-Up Charge Wave
  if (state.introActive && phase === 'playing') {
    state.introProgress = Math.min(1, state.introProgress + safeDt / 0.92);
    if (state.introProgress >= 1) {
      state.introActive = false;
    }
  }

  // Staggered charge wave timings across the 4 bottom power-up buttons: [0.08, 0.22, 0.36, 0.50]
  for (let i = 0; i < 4; i++) {
    const slotIdx = i as PowerUpSlotIndex;
    const btn = state.powerUpButtons[slotIdx];
    const startT = 0.08 + i * 0.14;
    const windowDur = 0.36;

    let chargeScale = 1.0;
    let chargeZ = 0;
    let chargeRotX = 0;

    if (state.introActive && phase === 'playing') {
      if (state.introProgress >= startT && !btn.chargeFired) {
        btn.chargeFired = true;
        state.powerUpChargeBurstsTriggered += 1;
        onPowerUpChargeBurst?.(slotIdx);
      }

      const localT = (state.introProgress - startT) / windowDur;
      if (localT < 0) {
        chargeScale = 0.78;
        chargeZ = -0.06;
        chargeRotX = 0.22;
      } else if (localT <= 1) {
        const arch = Math.sin(localT * Math.PI);
        chargeScale = 1 + arch * 0.24;
        chargeZ = arch * 0.19;
        chargeRotX = -arch * 0.18;
      }
    } else {
      btn.chargeFired = true;
    }

    // 4. Interactive Power-Up Activation Pulse (when player clicks or presses shortcut for a power-up)
    let actScale = 0;
    let actZ = 0;
    let actRotZ = 0;

    if (btn.activationTimer > 0) {
      btn.activationTimer = Math.max(0, btn.activationTimer - safeDt);
      const p = 1 - btn.activationTimer / btn.activationDuration;
      const pulse = Math.sin(p * Math.PI);
      actScale = pulse * 0.28;
      actZ = pulse * 0.18;
      actRotZ = Math.sin(p * Math.PI * 2) * 0.14 * (1 - p);
    }

    btn.scale = chargeScale + actScale;
    btn.zOffset = chargeZ + actZ;
    btn.rotX = chargeRotX;
    btn.rotZ = actRotZ;
  }

  // 5. Extra Dock Slot (+1 SLOT) 3D Socket Ring Pop Timer
  if (state.extraSlotPopTimer > 0) {
    state.extraSlotPopTimer = Math.max(0, state.extraSlotPopTimer - safeDt);
  }
}

export function getLevelTransitionStats(state: LevelTransition3DState): {
  levelTransitionCount: number;
  introProgress: number;
  introActive: boolean;
  modalBlend: number;
  hudBlend: number;
  powerUpChargeBurstsTriggered: number;
  powerUpActivationsTriggered: number;
  buttonScales: number[];
} {
  return {
    levelTransitionCount: state.levelTransitionCount,
    introProgress: Number(state.introProgress.toFixed(3)),
    introActive: state.introActive,
    modalBlend: Number(state.modalBlend.toFixed(3)),
    hudBlend: Number(state.hudBlend.toFixed(3)),
    powerUpChargeBurstsTriggered: state.powerUpChargeBurstsTriggered,
    powerUpActivationsTriggered: state.powerUpActivationsTriggered,
    buttonScales: state.powerUpButtons.map((b) => Number(b.scale.toFixed(3))),
  };
}
