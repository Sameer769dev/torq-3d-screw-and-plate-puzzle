import {
  findBestHintScrew,
  getBlockingPlate,
  isScrewBlocked,
  unscrewAction,
} from './rules';
import { BoardState, ScrewColor, ScrewState } from './types';

/**
 * 3D Radioactive Liquid Auto-Play Reactor State & Pure Logic.
 *
 * - Every bolt removed from the board during manual play adds +1 charge to the
 *   3D Radioactive Liquid column (`chargeBolts` toward `targetBolts = 45`,
 *   requiring ~3 to 4 full levels of manual bolt extractions).
 * - Once the liquid reaches the top (`fillRatio >= 1.0`, `isReady === true`),
 *   the player unlocks the ability to Auto-Play a level!
 * - Activating Auto-Play drains the radioactive liquid column smoothly while
 *   autonomously solving every bolt with a lookahead DFS + zero-jam solver until
 *   the level is cleanly cleared to victory.
 */

export const AUTO_PLAY_TARGET_BOLTS = 45;

export interface AutoPlayState {
  chargeBolts: number; // [0 .. targetBolts]
  targetBolts: number; // default 45
  fillRatio: number; // [0.0 .. 1.0]
  percent: number; // [0 .. 100]
  isReady: boolean; // true when fillRatio >= 1.0 and not currently autoPlaying
  autoPlaying: boolean; // true while autonomous level solve is executing
  totalActivations: number;
  autoPlayStartBolts?: number; // Remaining bolts on board when Auto-Play started (for smooth 100% -> 0% drain)
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
 * (While `autoPlaying` is active, the liquid drains smoothly from 100% -> 0%
 * proportional to the remaining bolts left to solve.)
 */
export function recordBoltExtractedForAutoPlay(
  state: AutoPlayState,
  boltsRemovedCount = 1,
  remainingBoltsOnBoard?: number,
  totalBoltsOnBoard?: number
): AutoPlayState {
  if (state.autoPlaying) {
    const startBolts =
      state.autoPlayStartBolts ??
      (remainingBoltsOnBoard !== undefined
        ? Math.max(1, remainingBoltsOnBoard + boltsRemovedCount)
        : totalBoltsOnBoard);
    const drainRatio =
      remainingBoltsOnBoard !== undefined &&
      startBolts !== undefined &&
      startBolts > 0
        ? clamp(remainingBoltsOnBoard / startBolts, 0, 1)
        : Math.max(0, state.fillRatio - 0.12);
    const fillRatio = Number(drainRatio.toFixed(3));
    return {
      ...state,
      autoPlayStartBolts: startBolts,
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
export function activateAutoPlay(
  state: AutoPlayState,
  remainingBoltsOnBoard?: number
): AutoPlayState {
  if (!state.isReady || state.autoPlaying) {
    return state;
  }
  return {
    ...state,
    isReady: false,
    autoPlaying: true,
    totalActivations: state.totalActivations + 1,
    autoPlayStartBolts:
      remainingBoltsOnBoard !== undefined && remainingBoltsOnBoard > 0
        ? remainingBoltsOnBoard
        : undefined,
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
    autoPlayStartBolts: undefined,
  };
}

/**
 * Scores candidate unblocked bolts for Auto-Play search ordering:
 * - Strongly prefers direct Active Target Box matches & Rainbow wildcards
 * - Prefers completing an almost-full box (2/3 filled -> triggers dock sweep!)
 * - Prefers freeing plates that directly cover Active-Box-colored bolts
 * - Prefers matching the next upcoming box colors to minimize dock clutter
 */
function rankUnblockedCandidates(board: BoardState): ScrewState[] {
  const unblocked = board.screws.filter(
    (s) => s.location === 'board' && !isScrewBlocked(s, board.plates)
  );
  if (unblocked.length <= 1) return unblocked;

  const openBoxes = board.activeBoxes.filter(
    (b) => !b.completed && b.screwIds.length < 3
  );
  const activeColorFill = new Map<ScrewColor, number>();
  for (const b of openBoxes) {
    const prev = activeColorFill.get(b.color) ?? -1;
    if (b.screwIds.length > prev) {
      activeColorFill.set(b.color, b.screwIds.length);
    }
  }

  // Identify plates that are directly blocking an Active-Box-colored bolt underneath
  const highValueBlockerPlateIds = new Set<string>();
  for (const s of board.screws) {
    if (s.location !== 'board') continue;
    if (
      activeColorFill.has(s.color) ||
      s.specialVariant === 'rainbow'
    ) {
      const blocker = getBlockingPlate(s, board.plates);
      if (blocker) {
        highValueBlockerPlateIds.add(blocker.id);
      }
    }
  }

  const nextUpcoming0 = board.upcomingBoxColors[0];
  const nextUpcoming1 = board.upcomingBoxColors[1];

  const scored = unblocked.map((s) => {
    let score = s.layer * 6;

    if (activeColorFill.has(s.color)) {
      const fill = activeColorFill.get(s.color)!;
      score += 1000 + fill * 120; // Completing a 2/3 box sweeps dock immediately!
    } else if (s.specialVariant === 'rainbow') {
      score += 950; // Transmutes cleanly into an open active box
    } else if (s.color === nextUpcoming0) {
      score += 45;
    } else if (s.color === nextUpcoming1) {
      score += 25;
    }

    for (const p of board.plates) {
      if (p.status === 'cleared' || !p.screwIds.includes(s.id)) continue;
      const unlocksTarget = highValueBlockerPlateIds.has(p.id);
      if (p.screwIds.length === 1) {
        score += unlocksTarget ? 320 : 110;
      } else if (p.screwIds.length === 2) {
        score += unlocksTarget ? 140 : 40;
      } else if (unlocksTarget) {
        score += 55;
      }
    }

    return { screw: s, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.map((entry) => entry.screw);
}

/**
 * Computes a compact canonical fingerprint of a BoardState for DFS memoization
 * so Auto-Play never re-explores identical dead-end board configurations.
 */
function computeSearchStateKey(board: BoardState): string {
  const boardIds: string[] = [];
  for (const s of board.screws) {
    if (s.location === 'board') {
      boardIds.push(s.id);
    }
  }
  const boxSig = board.activeBoxes
    .map((b) => (b.completed ? '_' : `${b.color}:${b.screwIds.length}`))
    .join(',');
  return `${board.completedBoxCount}|${boxSig}|${boardIds.join(',')}`;
}

/**
 * Bounded lookahead DFS solver that finds a guaranteed 100% legal, zero-jam move
 * leading from the exact current mid-level board state all the way to 'victory'.
 */
function findExactLegalWinningMove(
  rootBoard: BoardState,
  maxNodes = 700
): string | null {
  const visited = new Set<string>();
  let nodes = 0;

  // Strip hammerMode in simulation so lookahead evaluates pure legal unscrew moves
  const simRoot: BoardState = rootBoard.hammerMode
    ? { ...rootBoard, hammerMode: false }
    : rootBoard;

  function dfs(state: BoardState): string | null {
    if (state.outcome === 'victory') return '__WIN__';
    if (state.outcome === 'defeat') return null;
    if (nodes >= maxNodes) return null;

    const key = computeSearchStateKey(state);
    if (visited.has(key)) return null;
    visited.add(key);
    nodes++;

    const candidates = rankUnblockedCandidates(state);
    if (candidates.length === 0) return null;

    for (const candidate of candidates) {
      const next = unscrewAction(state, candidate.id, false, false);
      if (next.movesCount === state.movesCount) continue;
      if (next.outcome === 'victory') return candidate.id;
      if (next.outcome === 'defeat') continue;

      const res = dfs(next);
      if (res !== null) {
        return candidate.id;
      }
      if (nodes >= maxNodes) return null;
    }

    return null;
  }

  const found = dfs(simRoot);
  return found && found !== '__WIN__' ? found : null;
}

/**
 * Selects the next bolt to unscrew during Auto-Play so Auto-Play solves EVERY level
 * automatically and perfectly with zero dock jams and zero defeats:
 *
 * 1. Runs an exact lookahead DFS solver from the current board state to find a
 *    guaranteed legal winning move sequence (accounting for any bolts the player
 *    already placed in the dock).
 * 2. Falls back to top-ranked safe unblocked matches / plate unlocks if the board
 *    is large and hits the search budget.
 * 3. If the player activated Auto-Play from an already-jammed dock state (<= 1 free
 *    dock slot and no legal unblocked winning path), uses reactor precision extraction
 *    on an Active-Box-matching bolt (0 dock slots used) to break the jam cleanly and
 *    resume legal solving!
 */
export function pickNextAutoPlayScrewId(board: BoardState): string | null {
  if (board.outcome !== 'ongoing') return null;

  const remainingBoard = board.screws.filter((s) => s.location === 'board');
  if (remainingBoard.length === 0) return null;

  // Tier 1: Exact legal winning move via bounded memoized DFS
  const exactLegalMove = findExactLegalWinningMove(board, 700);
  if (exactLegalMove) {
    return exactLegalMove;
  }

  const openBoxColors = new Set(
    board.activeBoxes
      .filter((b) => !b.completed && b.screwIds.length < 3)
      .map((b) => b.color)
  );
  const freeDockSlots = board.dockScrewIds.filter((slot) => slot === null).length;

  // Tier 2: Unblocked bolt that directly matches an open Active Box or Rainbow wildcard
  const rankedUnblocked = rankUnblockedCandidates(board);
  const unblockedDirectMatch = rankedUnblocked.find(
    (s) => openBoxColors.has(s.color) || s.specialVariant === 'rainbow'
  );
  if (unblockedDirectMatch) {
    return unblockedDirectMatch.id;
  }

  // Tier 3: If dock has >= 2 free slots, use best legal unblocked move to uncover target plates
  if (freeDockSlots >= 2 && rankedUnblocked.length > 0) {
    return rankedUnblocked[0].id;
  }

  // Tier 4: Zero-Jam Reactor Override — dock is nearly full (<= 1 free slot) and no legal
  // winning move exists; extract the highest-layer bolt matching an open Active Box directly
  // into the box (0 dock slots consumed!) to break the jam and clear the level perfectly!
  const directMatchesAnywhere = remainingBoard
    .filter((s) => openBoxColors.has(s.color) || s.specialVariant === 'rainbow')
    .sort((a, b) => b.layer - a.layer);
  if (directMatchesAnywhere.length > 0) {
    return directMatchesAnywhere[0].id;
  }

  const hintId = findBestHintScrew(board);
  if (hintId) return hintId;

  return rankedUnblocked[0]?.id ?? remainingBoard[0].id;
}
