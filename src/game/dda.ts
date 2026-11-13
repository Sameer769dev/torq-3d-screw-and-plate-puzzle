/**
 * Dynamic Difficulty Adjustment (DDA) Engine for TORQ Endless Mode.
 *
 * Analyzes the player's real-time and historical:
 *  1. `solveTimeSec` relative to `parTimeSec` (Solve Speed Index)
 *  2. `comboFrequency` (ratio of combo-sustaining box matches & peak combo streaks to total moves)
 *
 * Procedurally tunes generated board complexity in real-time:
 *  - `boxCountOffset` / `targetBoxes` (total bolts = targetBoxes * 3)
 *  - `layerCountOffset` / `targetLayers` (vertical interlocking depth 2..6)
 *  - `colorCountOffset` / `targetColors` (anodized color variety 3..6)
 *  - `dockInterleaveLimit` (0..4 spare-dock deflections required in constructive solution)
 *  - `interleaveChance` (probability of constructive dock interleaving 0.0..0.72)
 */

export type DDABand =
  | 'recovery'
  | 'balanced'
  | 'accelerated'
  | 'overdrive';

export interface PlayerPerformanceSample {
  depth: number;
  solveTimeSec: number;
  parTimeSec: number;
  totalMoves: number;
  comboMatchMoves: number;
  peakCombo: number;
  totalScrews: number;
}

export interface DDAComplexityProfile {
  band: DDABand;
  skillRating: number; // [0.0 .. 1.0], 0.50 is baseline
  difficultyMultiplier: number; // [0.65 .. 1.65]
  solveSpeedIndex: number; // [0.0 .. 1.0]
  comboFrequency: number; // [0.0 .. 1.0]
  effectiveDepth: number;
  targetBoxes: number; // [3 .. 12]
  targetLayers: number; // [2 .. 6]
  targetColors: number; // [3 .. 6]
  dockInterleaveLimit: number; // [0 .. 4] (always < 5 spare dock slots so 100% solvable)
  interleaveChance: number; // [0.0 .. 0.72]
}

export interface DDAState {
  skillRating: number;
  difficultyMultiplier: number;
  rollingSolveSpeed: number;
  rollingComboFrequency: number;
  lastSolveTimeSec: number;
  lastComboFrequency: number;
  boardsAnalyzed: number;
  history: PlayerPerformanceSample[];
  activeProfile: DDAComplexityProfile;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/**
 * Computes a normalized Solve Speed Index in [0.0 .. 1.0] by comparing `solveTimeSec`
 * against expected `parTimeSec` (and bolt count).
 * - Solving in <= 35% of par time yields ~1.0 (blistering speed)
 * - Solving at par time yields ~0.50 (expected pace)
 * - Solving in >= 165% of par time yields ~0.08 (slow / methodical pace)
 */
export function computeSolveSpeedIndex(
  solveTimeSec: number,
  parTimeSec: number,
  totalScrews = 9
): number {
  const safePar = Math.max(12, parTimeSec, totalScrews * 2.5);
  const safeSolve = Math.max(0.5, solveTimeSec);
  const ratio = safeSolve / safePar;

  // Map ratio: 0.35 -> 1.0, 1.0 -> 0.50, 1.65 -> 0.05
  const normalized = 1.0 - (ratio - 0.35) / 1.3;
  return Number(clamp(normalized, 0.05, 1.0).toFixed(3));
}

/**
 * Computes a normalized Combo Frequency score in [0.0 .. 1.0] from:
 * - `matchRatio`: fraction of unscrew moves that directly matched an active Target Box
 * - `streakFactor`: peak consecutive combo chain relative to board size
 */
export function computeComboFrequency(
  comboMatchMoves: number,
  totalMoves: number,
  peakCombo: number,
  totalScrews: number
): number {
  if (totalMoves <= 0) return 0.5;

  const matchRatio = clamp(comboMatchMoves / Math.max(1, totalMoves), 0, 1);
  const targetStreak = Math.max(3, totalScrews * 0.6);
  const streakFactor = clamp(peakCombo / targetStreak, 0, 1);

  const combined = matchRatio * 0.65 + streakFactor * 0.35;
  return Number(clamp(combined, 0.0, 1.0).toFixed(3));
}

/**
 * Derives concrete procedural generation parameters (`DDAComplexityProfile`) for a given
 * endless `depth` (0, 1, 2, ...), `skillRating`, `solveSpeedIndex`, and `comboFrequency`.
 */
export function buildDDAComplexityProfile(
  depth: number,
  skillRating: number,
  solveSpeedIndex = 0.5,
  comboFrequency = 0.5
): DDAComplexityProfile {
  const safeDepth = Math.max(0, Math.floor(depth));
  const clampedSkill = clamp(skillRating, 0.05, 1.0);

  // Map skillRating [0.05 .. 1.0] -> difficultyMultiplier [0.65 .. 1.65]
  const difficultyMultiplier = Number(
    (0.65 + ((clampedSkill - 0.05) / 0.95) * 1.0).toFixed(3)
  );

  const band: DDABand =
    clampedSkill < 0.38
      ? 'recovery'
      : clampedSkill < 0.62
        ? 'balanced'
        : clampedSkill < 0.82
          ? 'accelerated'
          : 'overdrive';

  // Effective depth shifts up for high-skill players and eases down for recovering players
  const depthShift =
    band === 'overdrive'
      ? 2.2
      : band === 'accelerated'
        ? 1.15
        : band === 'recovery'
          ? -1.1
          : 0;

  const effectiveDepth = Number(
    Math.max(0, safeDepth * difficultyMultiplier + depthShift).toFixed(2)
  );

  // 1. Target Boxes (3..8, where each box = 3 bolts, up to 24 bolts on the 6x4 CNC lattice)
  const rawBoxes = Math.round(3 + effectiveDepth);
  const targetBoxes = clamp(rawBoxes, 3, 8);

  // 2. Target Layers (2..5)
  const baseLayers =
    effectiveDepth < 0.75
      ? 2
      : effectiveDepth < 2.5
        ? 3
        : effectiveDepth < 4.5
          ? 4
          : 5;
  const maxPossibleLayers = Math.max(2, Math.floor((targetBoxes * 3) / 3));
  const targetLayers = clamp(baseLayers, 2, Math.min(5, maxPossibleLayers));

  // 3. Target Colors (3..10 across the expanded 10-color anodized hardware palette)
  const targetColors = clamp(Math.round(3 + effectiveDepth * 1.15), 3, 10);

  // 4. Spare-Dock Interleaving Pressure (always <= 3 or 4 out of 5 dock slots so 100% solvable!)
  let dockInterleaveLimit = 0;
  if (band === 'recovery') {
    dockInterleaveLimit = safeDepth === 0 ? 0 : 1;
  } else if (band === 'balanced') {
    dockInterleaveLimit =
      safeDepth === 0 ? 0 : safeDepth === 1 ? 1 : safeDepth <= 3 ? 2 : 3;
  } else if (band === 'accelerated') {
    dockInterleaveLimit = safeDepth === 0 ? 1 : safeDepth <= 2 ? 2 : 3;
  } else {
    // overdrive
    dockInterleaveLimit = safeDepth === 0 ? 2 : safeDepth <= 2 ? 3 : 4;
  }

  const interleaveChance = Number(
    clamp(
      band === 'recovery'
        ? 0.08 + safeDepth * 0.05
        : band === 'balanced'
          ? safeDepth * 0.14
          : band === 'accelerated'
            ? 0.24 + safeDepth * 0.14
            : 0.38 + safeDepth * 0.15,
      0.0,
      0.72
    ).toFixed(3)
  );

  return {
    band,
    skillRating: Number(clampedSkill.toFixed(3)),
    difficultyMultiplier,
    solveSpeedIndex: Number(solveSpeedIndex.toFixed(3)),
    comboFrequency: Number(comboFrequency.toFixed(3)),
    effectiveDepth,
    targetBoxes,
    targetLayers,
    targetColors,
    dockInterleaveLimit,
    interleaveChance,
  };
}

/**
 * Creates the initial DDA state at the start of an Endless Run.
 */
export function createInitialDDAState(initialDepth = 0): DDAState {
  const initialProfile = buildDDAComplexityProfile(initialDepth, 0.5, 0.5, 0.5);
  return {
    skillRating: 0.5,
    difficultyMultiplier: 1.0,
    rollingSolveSpeed: 0.5,
    rollingComboFrequency: 0.5,
    lastSolveTimeSec: 0,
    lastComboFrequency: 0.5,
    boardsAnalyzed: 0,
    history: [],
    activeProfile: initialProfile,
  };
}

/**
 * Evaluates live mid-board telemetry (as the player unscrews bolts in real-time)
 * and updates `activeProfile` for the upcoming generation depth without mutating history.
 */
export function evaluateLiveDDA(
  dda: DDAState,
  currentDepth: number,
  elapsedBoardSec: number,
  parTimeSec: number,
  comboMatchMoves: number,
  totalMoves: number,
  peakCombo: number,
  boltsCleared: number,
  totalScrews: number
): DDAState {
  if (totalMoves <= 0) {
    return {
      ...dda,
      activeProfile: buildDDAComplexityProfile(
        currentDepth + 1,
        dda.skillRating,
        dda.rollingSolveSpeed,
        dda.rollingComboFrequency
      ),
    };
  }

  // Estimate projected full-board solve time from current pace
  const progress = clamp(boltsCleared / Math.max(1, totalScrews), 0.1, 1.0);
  const projectedSolveSec = Math.max(1, elapsedBoardSec / progress);

  const liveSpeedIdx = computeSolveSpeedIndex(
    projectedSolveSec,
    parTimeSec,
    totalScrews
  );
  const liveComboFreq = computeComboFrequency(
    comboMatchMoves,
    totalMoves,
    peakCombo,
    totalScrews
  );

  // Blend historical rolling metrics with live in-progress performance
  const blendedSpeed =
    dda.boardsAnalyzed > 0
      ? dda.rollingSolveSpeed * 0.55 + liveSpeedIdx * 0.45
      : liveSpeedIdx;
  const blendedCombo =
    dda.boardsAnalyzed > 0
      ? dda.rollingComboFrequency * 0.55 + liveComboFreq * 0.45
      : liveComboFreq;

  const liveSkill = clamp(blendedSpeed * 0.48 + blendedCombo * 0.52, 0.05, 1.0);
  const nextProfile = buildDDAComplexityProfile(
    currentDepth + 1,
    liveSkill,
    blendedSpeed,
    blendedCombo
  );

  return {
    ...dda,
    skillRating: Number(liveSkill.toFixed(3)),
    difficultyMultiplier: nextProfile.difficultyMultiplier,
    lastSolveTimeSec: Number(elapsedBoardSec.toFixed(2)),
    lastComboFrequency: liveComboFreq,
    activeProfile: nextProfile,
  };
}

/**
 * Records a completed board's performance sample (`solveTimeSec` and `comboFrequency`)
 * into the DDA engine and returns the updated `DDAState` with the tuned `activeProfile`
 * for the next generated board (`sample.depth + 1`).
 */
export function recordBoardCompletionDDA(
  dda: DDAState,
  sample: PlayerPerformanceSample
): DDAState {
  const speedIdx = computeSolveSpeedIndex(
    sample.solveTimeSec,
    sample.parTimeSec,
    sample.totalScrews
  );
  const comboFreq = computeComboFrequency(
    sample.comboMatchMoves,
    sample.totalMoves,
    sample.peakCombo,
    sample.totalScrews
  );

  const sampleSkill = clamp(speedIdx * 0.48 + comboFreq * 0.52, 0.05, 1.0);

  // Responsive Exponential Moving Average (EMA) so sudden speedups or struggles adapt immediately
  const alpha = dda.boardsAnalyzed === 0 ? 0.75 : 0.55;
  const nextRollingSpeed = Number(
    (dda.rollingSolveSpeed * (1 - alpha) + speedIdx * alpha).toFixed(3)
  );
  const nextRollingCombo = Number(
    (dda.rollingComboFrequency * (1 - alpha) + comboFreq * alpha).toFixed(3)
  );
  const nextSkill = Number(
    clamp(
      dda.skillRating * (1 - alpha) + sampleSkill * alpha,
      0.05,
      1.0
    ).toFixed(3)
  );

  const nextDepth = sample.depth + 1;
  const nextProfile = buildDDAComplexityProfile(
    nextDepth,
    nextSkill,
    nextRollingSpeed,
    nextRollingCombo
  );

  const nextHistory = [...dda.history.slice(-9), sample];

  return {
    skillRating: nextSkill,
    difficultyMultiplier: nextProfile.difficultyMultiplier,
    rollingSolveSpeed: nextRollingSpeed,
    rollingComboFrequency: nextRollingCombo,
    lastSolveTimeSec: Number(sample.solveTimeSec.toFixed(2)),
    lastComboFrequency: comboFreq,
    boardsAnalyzed: dda.boardsAnalyzed + 1,
    history: nextHistory,
    activeProfile: nextProfile,
  };
}

export interface DifficultyGaugeState {
  fillRatio: number; // [0.14 .. 1.0] smooth normalized gauge fill
  percent: number; // [14 .. 100] integer percentage
  activeSegments: number; // [1 .. 10] lit discrete segments
  totalSegments: number; // 10
  accentHex: string; // smooth color progression: cyan -> emerald -> amber -> crimson
  tierLabel: string; // 'TORQ I' .. 'TORQ MAX'
}

/**
 * Computes the subtle HUD Difficulty Gauge state from the current board's procedural
 * complexity (bolt count, layer depth, chain depth) and real-time DDA multiplier.
 * Smoothly fills up as procedural difficulty increases across the infinite board chain.
 */
export function computeDifficultyGaugeState(
  levelIndex: number,
  totalScrews: number,
  maxLayer: number,
  difficultyMultiplier = 1.0
): DifficultyGaugeState {
  const safeDepth = Math.max(0, levelIndex);

  // 1. Bolt count contribution: 9 bolts (3 boxes) -> 0.0, 24 bolts (8 boxes) -> 1.0
  const screwNorm = clamp((totalScrews - 9) / 15, 0, 1);

  // 2. Vertical layer depth contribution: 2 layers -> 0.0, 5 layers -> 1.0
  const layerNorm = clamp((maxLayer - 2) / 3, 0, 1);

  // 3. Infinite board chain progression curve: 0 at level 1, asymptotically approaches 1.0 across chain
  const chainNorm = 1 - Math.exp(-safeDepth * 0.28);

  // 4. Real-time DDA multiplier contribution: [0.65 .. 1.65] -> [0.0 .. 1.0]
  const ddaNorm = clamp((difficultyMultiplier - 0.65) / 1.0, 0, 1);

  // Weighted composite difficulty in [0.16 .. 1.0] so Level 1 shows a subtle initial baseline (~18%)
  const rawFill =
    0.16 +
    0.84 *
      (screwNorm * 0.36 +
        layerNorm * 0.24 +
        chainNorm * 0.28 +
        ddaNorm * 0.12);

  const fillRatio = Number(clamp(rawFill, 0.16, 1.0).toFixed(3));
  const percent = Math.round(fillRatio * 100);
  const totalSegments = 10;
  const activeSegments = clamp(Math.round(fillRatio * totalSegments), 1, totalSegments);

  let accentHex = '#38BDF8'; // Precision Cyan (low complexity)
  let tierLabel = 'TORQ I';
  if (fillRatio >= 0.82) {
    accentHex = '#EF4444'; // High-Torque Crimson (peak complexity)
    tierLabel = 'TORQ MAX';
  } else if (fillRatio >= 0.62) {
    accentHex = '#F97316'; // Industrial Orange (high complexity)
    tierLabel = 'TORQ IV';
  } else if (fillRatio >= 0.42) {
    accentHex = '#F59E0B'; // Machinist Amber (moderate-high complexity)
    tierLabel = 'TORQ III';
  } else if (fillRatio >= 0.26) {
    accentHex = '#10B981'; // Anodized Emerald (stepping up)
    tierLabel = 'TORQ II';
  }

  return {
    fillRatio,
    percent,
    activeSegments,
    totalSegments,
    accentHex,
    tierLabel,
  };
}

