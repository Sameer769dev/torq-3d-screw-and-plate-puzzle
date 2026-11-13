import { findBestHintScrew, isScrewBlocked } from './rules';
import { BoardState } from './types';

/**
 * 3D Radioactive Liquid Auto-Play Reactor State & Pure Logic.
 *
 * - Every bolt removed from the board during manual play adds +1 charge to the
 *   3D Radioactive Liquid column (`chargeBolts` toward `targetBolts = 9`).
 * - Once the liquid reaches the top (`fillRatio >= 1.0`, `isReady === true`),
 *   the player unlocks the ability to Auto-Play the current level!
 * - Activating Auto-Play drains the radioactive liquid column while autonomously
 *   unscrewing bolts in an optimal solver sequence until the level is cleared.
 */

export const AUTO_PLAY_TARGET_BOLTS = 9;

export interface AutoPlayState {
  chargeBolts: number; // [0 .. targetBolts]
  targetBolts: number; // default 9
  fillRatio: number; // [0.0 .. 1.0]
  percent: number; // [0 .. 100]
  isReady: boolean; // true when fillRatio >= 1.0 and not currently autoPlaying
  autoPlaying: boolean; // true while autonomous level solve is executing
  totalActivations: number;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/**
 * Creates the initial Auto-Play Reactor state.
 */
export function createInitialAutoPlayState(
  initialChargeBolts = 0,
  targetBolts = AUTO_PLAY_TARGET_BOLTS
): AutoPlayState {
  const safeTarget = Math.max(1, Math.floor(targetBolts));
  const safeCharge = clamp(Math.floor(initialChargeBolts), 0, safeTarget);
  const fillRatio = Number((safeCharge / safeTarget).toFixed(3));
  return {
    chargeBolts: safeCharge,
    targetBolts: safeTarget,
    fillRatio,
    percent: Math.round(fillRatio * 100),
    isReady: safeCharge >= safeTarget,
    autoPlaying: false,
    totalActivations: 0,
  };
}

/**
 * Instantly fuels the radioactive auto-play reactor to 100% via rewarded video ad.
 */
export function fuelAutoPlayToFull(state: AutoPlayState): AutoPlayState {
  return {
    ...state,
    chargeBolts: state.targetBolts,
    fillRatio: 1.0,
    percent: 100,
    isReady: true,
  };
}

/**
 * Records `boltsRemovedCount` bolts coming out of the board and fills the
 * radioactive liquid column accordingly.
 * (While `autoPlaying` is active, the liquid drains rather than charging.)
 */
export function recordBoltExtractedForAutoPlay(
  state: AutoPlayState,
  boltsRemovedCount = 1,
  remainingBoltsOnBoard?: number,
  totalBoltsOnBoard?: number
): AutoPlayState {
  if (state.autoPlaying) {
    // Smoothly drain the radioactive liquid proportional to remaining bolts on the auto-played level
    const drainRatio =
      remainingBoltsOnBoard !== undefined &&
      totalBoltsOnBoard !== undefined &&
      totalBoltsOnBoard > 0
        ? clamp(remainingBoltsOnBoard / totalBoltsOnBoard, 0, 1)
        : Math.max(0, state.fillRatio - 0.12);
    const fillRatio = Number(drainRatio.toFixed(3));
    return {
      ...state,
      chargeBolts: Math.round(fillRatio * state.targetBolts),
      fillRatio,
      percent: Math.round(fillRatio * 100),
      isReady: false,
    };
  }

  const nextCharge = clamp(
    state.chargeBolts + Math.max(0, boltsRemovedCount),
    0,
    state.targetBolts
  );
  const fillRatio = Number((nextCharge / state.targetBolts).toFixed(3));

  return {
    ...state,
    chargeBolts: nextCharge,
    fillRatio,
    percent: Math.round(fillRatio * 100),
    isReady: nextCharge >= state.targetBolts,
  };
}

/**
 * Activates Auto-Play when the radioactive liquid has reached 100% (`isReady === true`).
 * If `state` is not ready or already auto-playing, returns `state` unchanged.
 */
export function activateAutoPlay(state: AutoPlayState): AutoPlayState {
  if (!state.isReady || state.autoPlaying) {
    return state;
  }
  return {
    ...state,
    isReady: false,
    autoPlaying: true,
    totalActivations: state.totalActivations + 1,
  };
}

/**
 * Completes the Auto-Play sequence once the current level is cleared (or reset),
 * resetting the radioactive reservoir to 0% so it charges fresh on subsequent bolts.
 */
export function completeAutoPlayLevel(state: AutoPlayState): AutoPlayState {
  if (!state.autoPlaying) {
    return state;
  }
  return {
    ...state,
    chargeBolts: 0,
    fillRatio: 0,
    percent: 0,
    isReady: false,
    autoPlaying: false,
  };
}

/**
 * Selects the next bolt to unscrew during Auto-Play.
 * Prefers `findBestHintScrew(board)` (which prioritizes active Target Collector Box
 * matches and plates closest to dropping), and falls back to any unblocked board bolt
 * or any remaining board bolt so Auto-Play never stalls.
 */
export function pickNextAutoPlayScrewId(board: BoardState): string | null {
  if (board.outcome !== 'ongoing') return null;

  const hintId = findBestHintScrew(board);
  if (hintId) return hintId;

  const unblocked = board.screws.find(
    (s) => s.location === 'board' && !isScrewBlocked(s, board.plates)
  );
  if (unblocked) return unblocked.id;

  const anyBoardScrew = board.screws.find((s) => s.location === 'board');
  return anyBoardScrew ? anyBoardScrew.id : null;
}
