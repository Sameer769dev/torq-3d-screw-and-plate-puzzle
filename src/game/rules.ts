import { DDAComplexityProfile } from './dda';
import { generateEndlessBlueprint, LEVELS } from './levels';
import {
  BoardState,
  LevelBlueprint,
  PlateState,
  ScrewColor,
  ScrewState,
  TargetBoxState,
} from './types';

const SCREW_HEAD_RADIUS = 0.36;

/**
 * Checks whether a point (sx, sy) with screw head radius is covered by a plate on a strictly higher layer.
 */
export function isPointCoveredByPlate(
  sx: number,
  sy: number,
  plate: PlateState,
  margin = SCREW_HEAD_RADIUS * 0.55
): boolean {
  if (plate.status === 'cleared') return false;

  // Transform point into plate's local coordinate space (accounting for dangling rotation around pivot)
  let dx = sx - plate.x;
  let dy = sy - plate.y;

  if (Math.abs(plate.currentRotation) > 0.001) {
    // Rotate point around (plate.pivotX, plate.pivotY) by -plate.currentRotation
    const rx = sx - plate.pivotX;
    const ry = sy - plate.pivotY;
    const cos = Math.cos(-plate.currentRotation);
    const sin = Math.sin(-plate.currentRotation);
    const unrotX = plate.pivotX + rx * cos - ry * sin;
    const unrotY = plate.pivotY + rx * sin + ry * cos;
    dx = unrotX - plate.x;
    dy = unrotY - plate.y;
  }

  const halfW = plate.width * 0.5 + margin;
  const halfH = plate.height * 0.5 + margin;

  return Math.abs(dx) <= halfW && Math.abs(dy) <= halfH;
}

/**
 * Returns the highest-layer plate blocking a given screw, or null if the screw is clear to unscrew.
 */
export function getBlockingPlate(
  screw: ScrewState,
  plates: PlateState[]
): PlateState | null {
  if (screw.location !== 'board') return null;

  let blocker: PlateState | null = null;
  for (const plate of plates) {
    if (plate.status === 'cleared') continue;
    if (plate.layer <= screw.layer) continue;
    if (isPointCoveredByPlate(screw.x, screw.y, plate)) {
      if (!blocker || plate.layer > blocker.layer) {
        blocker = plate;
      }
    }
  }
  return blocker;
}

export function isScrewBlocked(screw: ScrewState, plates: PlateState[]): boolean {
  return getBlockingPlate(screw, plates) !== null;
}

/**
 * Recomputes plate statuses (pinned -> dangling -> cleared) based on remaining board screws.
 */
export function updatePlatesAfterScrewChange(
  plates: PlateState[],
  screws: ScrewState[]
): { updatedPlates: PlateState[]; newlyClearedPlates: PlateState[] } {
  const boardScrewMap = new Map<string, ScrewState>();
  for (const s of screws) {
    if (s.location === 'board') {
      boardScrewMap.set(s.id, s);
    }
  }

  const newlyClearedPlates: PlateState[] = [];
  const updatedPlates = plates.map((plate) => {
    if (plate.status === 'cleared') return plate;

    const remainingIds = plate.initialScrewIds.filter((id) => boardScrewMap.has(id));
    if (remainingIds.length === 0) {
      const cleared: PlateState = {
        ...plate,
        screwIds: [],
        status: 'cleared',
      };
      newlyClearedPlates.push(cleared);
      return cleared;
    }

    if (remainingIds.length === 1 && plate.initialScrewIds.length > 1) {
      const lastScrew = boardScrewMap.get(remainingIds[0])!;
      // Gravity swings the plate downward around the single remaining screw pivot
      const offsetX = plate.x - lastScrew.x;
      const swingAngle = offsetX >= 0 ? -0.42 : 0.42;
      return {
        ...plate,
        screwIds: remainingIds,
        status: 'dangling' as const,
        pivotX: lastScrew.x,
        pivotY: lastScrew.y,
        currentRotation: plate.baseRotation + swingAngle,
      };
    }

    return {
      ...plate,
      screwIds: remainingIds,
      status: 'pinned' as const,
      currentRotation: plate.baseRotation,
    };
  });

  return { updatedPlates, newlyClearedPlates };
}

/**
 * Instantiates a fresh BoardState from any LevelBlueprint (preset or procedural endless).
 */
export function createBoardFromBlueprint(
  blueprint: LevelBlueprint,
  options?: {
    carryScore?: number;
    carryCombo?: number;
    carryMaxCombo?: number;
    carryHammers?: number;
    carryExtraSlots?: number;
  }
): BoardState {
  const screws: ScrewState[] = blueprint.screws.map((s) => ({
    id: s.id,
    x: s.x,
    y: s.y,
    layer: s.layer,
    color: s.color,
    location: 'board',
    specialVariant: s.specialVariant ?? 'normal',
    chaosCycleColors: s.chaosCycleColors ? [...s.chaosCycleColors] : undefined,
    unknownRevealed: false,
    unknownRevealAtMove: s.unknownRevealAtMove,
    spawnedMidLevel: false,
  }));

  const plates: PlateState[] = blueprint.plates.map((p) => ({
    id: p.id,
    name: p.name,
    layer: p.layer,
    shape: p.shape,
    materialType: p.materialType,
    x: p.x,
    y: p.y,
    width: p.width,
    height: p.height,
    baseRotation: p.rotation ?? 0,
    currentRotation: p.rotation ?? 0,
    pivotX: p.x,
    pivotY: p.y,
    screwIds: [...p.screwIds],
    initialScrewIds: [...p.screwIds],
    status: 'pinned',
  }));

  const activeCount = Math.min(2, blueprint.boxSequence.length);
  const activeBoxes: TargetBoxState[] = blueprint.boxSequence
    .slice(0, activeCount)
    .map((color, idx) => ({
      id: `box_init_${idx}`,
      color,
      screwIds: [],
      completed: false,
      slotIndex: idx,
    }));

  const upcomingBoxColors = blueprint.boxSequence.slice(activeCount);
  const maxDockSlots = 5;

  const initialAccessible =
    (blueprint.solutionOrder
      ? screws.find(
        (s) => s.id === blueprint.solutionOrder![0] && !isScrewBlocked(s, plates)
      )
      : undefined) ?? screws.find((s) => !isScrewBlocked(s, plates));

  return {
    levelIndex: blueprint.index,
    levelName: blueprint.name,
    levelSubtitle: blueprint.subtitle,
    difficulty: blueprint.difficulty,
    parTimeSec: blueprint.parTimeSec,
    screws,
    plates,
    activeBoxes,
    upcomingBoxColors,
    completedBoxCount: 0,
    totalBoxes: blueprint.boxSequence.length,
    dockScrewIds: new Array(maxDockSlots).fill(null),
    maxDockSlots,
    score: options?.carryScore ?? 0,
    combo: options?.carryCombo ?? 0,
    maxCombo: options?.carryMaxCombo ?? 0,
    movesCount: 0,
    comboMatchMoves: 0,
    boardStartedAtMs: Date.now(),
    hammersRemaining: options?.carryHammers ?? 3,
    hammerMode: false,
    extraSlotUsed: false,
    extraSlotsRemaining: options?.carryExtraSlots ?? 1,
    highlightedScrewId: null,
    selectedScrewId: initialAccessible?.id ?? null,
    solutionOrder: blueprint.solutionOrder ? [...blueprint.solutionOrder] : undefined,
    lastActionFeedback: null,
    outcome: 'ongoing',
  };
}

/**
 * Creates a fresh BoardState for the specified classic level index (kept for unit test compatibility).
 */
export function createBoardFromLevel(levelIndex: number): BoardState {
  const safeIdx = ((levelIndex % LEVELS.length) + LEVELS.length) % LEVELS.length;
  const blueprint = LEVELS[safeIdx];
  return createBoardFromBlueprint(blueprint);
}

/**
 * Creates a procedurally generated Endless Board at `depth` (0, 1, 2, ...),
 * dynamically tuned by `ddaProfile` (analyzing solve time & combo frequency)
 * and verified 100% solvable by `solveBoard`.
 */
export function createEndlessBoard(
  depth = 0,
  options?: {
    seed?: number;
    carryScore?: number;
    carryCombo?: number;
    carryMaxCombo?: number;
    carryHammers?: number;
    carryExtraSlots?: number;
    ddaProfile?: DDAComplexityProfile;
  }
): BoardState {
  const safeDepth = Math.max(0, Math.floor(depth));
  const baseSeed =
    options?.seed !== undefined
      ? options.seed
      : (safeDepth + 1) * 7919 + 104729;

  for (let attempt = 0; attempt < 8; attempt++) {
    const bp = generateEndlessBlueprint(
      safeDepth,
      baseSeed + attempt * 997,
      options?.ddaProfile
    );
    const candidateBoard = createBoardFromBlueprint(bp, options);
    const check = solveBoard(candidateBoard);
    if (check.solved) {
      return candidateBoard;
    }
  }

  // Fallback with zero dock interleaving (guaranteed 100% solvable)
  const fallbackBp = generateEndlessBlueprint(0, baseSeed);
  fallbackBp.index = safeDepth;
  return createBoardFromBlueprint(fallbackBp, options);
}

/**
 * Advances seamlessly to the next progressively harder Endless Board (`depth + 1`),
 * tuned in real-time by `ddaProfile` and carrying over cumulative score and combo.
 */
export function advanceEndlessBoard(
  completedBoard: BoardState,
  nextSeed?: number,
  ddaProfile?: DDAComplexityProfile
): BoardState {
  const nextDepth = completedBoard.levelIndex + 1;
  return createEndlessBoard(nextDepth, {
    seed: nextSeed,
    carryScore: completedBoard.score,
    carryCombo: completedBoard.combo,
    carryMaxCombo: completedBoard.maxCombo,
    carryHammers: completedBoard.hammersRemaining,
    carryExtraSlots: completedBoard.extraSlotsRemaining,
    ddaProfile,
  });
}

/**
 * Sweeps matching screws from the spare dock into active boxes, and replaces completed boxes
 * from the upcoming queue in a cascade until no more sweeps or completions occur.
 */
function resolveBoxCompletionsAndDockSweep(
  screws: ScrewState[],
  activeBoxes: TargetBoxState[],
  upcomingBoxColors: ScrewColor[],
  dockScrewIds: (string | null)[],
  initialCompletedCount: number,
  initialScore: number,
  initialCombo: number
): {
  activeBoxes: TargetBoxState[];
  upcomingBoxColors: ScrewColor[];
  dockScrewIds: (string | null)[];
  completedBoxCount: number;
  boxesClearedThisTurn: number;
  score: number;
  combo: number;
} {
  const nextActiveBoxes = activeBoxes.map((b) => ({ ...b, screwIds: [...b.screwIds] }));
  const nextUpcoming = [...upcomingBoxColors];
  const nextDock = [...dockScrewIds];
  let completedBoxCount = initialCompletedCount;
  let boxesClearedThisTurn = 0;
  let score = initialScore;
  let combo = initialCombo;

  let changed = true;
  let boxIdCounter = completedBoxCount + nextActiveBoxes.length + 10;

  while (changed) {
    changed = false;

    // 1. Check if any screw currently in nextDock matches an active box with space (< 3)
    for (let dIdx = 0; dIdx < nextDock.length; dIdx++) {
      const dockScrewId = nextDock[dIdx];
      if (!dockScrewId) continue;
      const screw = screws.find((s) => s.id === dockScrewId);
      if (!screw) continue;

      const targetBox = nextActiveBoxes.find(
        (b) => !b.completed && b.color === screw.color && b.screwIds.length < 3
      );
      if (targetBox) {
        nextDock[dIdx] = null;
        const boxSlot = targetBox.screwIds.length;
        targetBox.screwIds.push(screw.id);
        screw.location = 'box';
        screw.dockSlotIndex = undefined;
        screw.targetBoxId = targetBox.id;
        screw.targetBoxSlot = boxSlot;
        score += 40;
        changed = true;
      }
    }

    // 1b. Check if any revive-banked bolt (location === 'box' without a targetBoxId yet) matches an open active box
    for (const screw of screws) {
      if (screw.location !== 'box' || screw.targetBoxId) continue;
      const targetBox = nextActiveBoxes.find(
        (b) => !b.completed && b.color === screw.color && b.screwIds.length < 3
      );
      if (targetBox) {
        const boxSlot = targetBox.screwIds.length;
        targetBox.screwIds.push(screw.id);
        screw.targetBoxId = targetBox.id;
        screw.targetBoxSlot = boxSlot;
        changed = true;
      }
    }

    // 2. Check if any active box now has 3 screws
    for (let bIdx = 0; bIdx < nextActiveBoxes.length; bIdx++) {
      const box = nextActiveBoxes[bIdx];
      if (!box.completed && box.screwIds.length >= 3) {
        box.completed = true;
        completedBoxCount += 1;
        boxesClearedThisTurn += 1;
        combo += 1;
        score += 250 + combo * 50;
        changed = true;

        // If there's an upcoming box color, spawn a replacement box in this slot
        if (nextUpcoming.length > 0) {
          const nextColor = nextUpcoming.shift()!;
          boxIdCounter += 1;
          nextActiveBoxes[bIdx] = {
            id: `box_seq_${boxIdCounter}`,
            color: nextColor,
            screwIds: [],
            completed: false,
            slotIndex: box.slotIndex,
          };
        }
      }
    }
  }

  return {
    activeBoxes: nextActiveBoxes,
    upcomingBoxColors: nextUpcoming,
    dockScrewIds: nextDock,
    completedBoxCount,
    boxesClearedThisTurn,
    score,
    combo,
  };
}

/**
 * Attempts to unscrew `screwId` from the board.
 * When `state.hammerMode` or `forceHammer` is active (and `hammersRemaining > 0`),
 * the Hammer smashes and extracts ANY bolt on the board, bypassing all blocking plates!
 */
export function unscrewAction(
  state: BoardState,
  screwId: string,
  forceHammer = false,
  autoPlayExtract = false
): BoardState {
  if (state.outcome !== 'ongoing') return state;

  const targetScrew = state.screws.find((s) => s.id === screwId);
  if (!targetScrew || targetScrew.location !== 'board') {
    return state;
  }

  const usingHammer =
    !autoPlayExtract &&
    (state.hammerMode || forceHammer) &&
    state.hammersRemaining > 0;
  const bypassBlockAndJam = usingHammer || autoPlayExtract;

  // Check if obstructed by a higher-layer plate (bypassed when using Hammer or Auto-Play!)
  if (!bypassBlockAndJam) {
    const blocker = getBlockingPlate(targetScrew, state.plates);
    if (blocker) {
      return {
        ...state,
        lastActionFeedback: {
          type: 'blocked',
          message: `Blocked by ${blocker.name} (Layer ${blocker.layer})`,
          screwId,
          blockingPlateId: blocker.id,
          timestamp: Date.now(),
        },
      };
    }
  }

  const nextScrews = state.screws.map((s) => ({
    ...s,
    chaosCycleColors: s.chaosCycleColors ? [...s.chaosCycleColors] : undefined,
  }));
  const screw = nextScrews.find((s) => s.id === screwId)!;

  let nextActiveBoxes = state.activeBoxes.map((b) => ({
    ...b,
    screwIds: [...b.screwIds],
  }));
  let nextDock = [...state.dockScrewIds];
  let nextScore = state.score;
  let nextCombo = state.combo;

  // 1. If unscrewing an Unknown '?' Mystery Bolt, crack open its shroud to reveal its true color!
  if (screw.specialVariant === 'unknown') {
    screw.unknownRevealed = true;
    nextScore += 35; // Mystery discovery bonus
  }

  // 2. If unscrewing a Rainbow Wildcard Bolt and its color doesn't already match an open active box,
  // dynamically transmute (swap colors with a remaining bolt of the active box's color) so the Rainbow
  // Bolt ALWAYS matches the active Target Collector Box while preserving the 3-per-box color ledger!
  if (screw.specialVariant === 'rainbow') {
    const alreadyMatches = nextActiveBoxes.some(
      (b) => !b.completed && b.color === screw.color && b.screwIds.length < 3
    );
    if (!alreadyMatches) {
      const openBox = nextActiveBoxes.find(
        (b) => !b.completed && b.screwIds.length < 3
      );
      if (openBox) {
        const swapCandidates = nextScrews.filter(
          (s) =>
            s.location === 'board' &&
            s.id !== screw.id &&
            s.color === openBox.color
        );
        const swapPartner = swapCandidates[swapCandidates.length - 1];
        if (swapPartner) {
          swapPartner.color = screw.color;
          screw.color = openBox.color;
        }
      }
    }
    nextScore += 45; // Rainbow wildcard bonus
  }

  // 3. If unscrewing a Chaotic Color-Shifting Bolt, award chaos bonus
  if (screw.specialVariant === 'chaotic') {
    nextScore += 30;
  }

  // Check if an active box accepts this screw's color
  const matchingBox = nextActiveBoxes.find(
    (b) => !b.completed && b.color === screw.color && b.screwIds.length < 3
  );

  let placedInBox = false;
  if (matchingBox) {
    const slot = matchingBox.screwIds.length;
    matchingBox.screwIds.push(screw.id);
    screw.location = 'box';
    screw.targetBoxId = matchingBox.id;
    screw.targetBoxSlot = slot;
    screw.extractedAtMove = state.movesCount + 1;
    nextCombo += 1;
    nextScore += (usingHammer ? 90 : 60) + nextCombo * 15;
    placedInBox = true;
  } else {
    // Place in first empty dock slot
    const freeDockIdx = nextDock.findIndex((slot) => slot === null);
    if (freeDockIdx === -1) {
      if (!bypassBlockAndJam) {
        return {
          ...state,
          outcome: 'defeat',
          defeatReason: 'Spare holding dock is full!',
        };
      }
      if (autoPlayExtract) {
        // Auto-Play reactor override: bank bolt for its matching Target Box without inflating player's dock size
        screw.location = 'box';
        screw.dockSlotIndex = undefined;
        screw.targetBoxId = undefined;
        screw.targetBoxSlot = undefined;
        screw.extractedAtMove = state.movesCount + 1;
        nextScore += 45;
      } else {
        // Hammer smash when dock is full: expand dock by 1 slot so extraction always succeeds
        nextDock.push(screw.id);
        screw.location = 'dock';
        screw.dockSlotIndex = nextDock.length - 1;
        screw.extractedAtMove = state.movesCount + 1;
        nextScore += 45;
      }
    } else {
      nextDock[freeDockIdx] = screw.id;
      screw.location = 'dock';
      screw.dockSlotIndex = freeDockIdx;
      screw.extractedAtMove = state.movesCount + 1;
      nextCombo = 0; // Reset combo when parking in spare dock
      nextScore += usingHammer ? 45 : 15;
    }
  }

  // Update plates (some may dangle or clear!)
  const { updatedPlates, newlyClearedPlates } = updatePlatesAfterScrewChange(
    state.plates,
    nextScrews
  );
  if (newlyClearedPlates.length > 0) {
    nextScore += newlyClearedPlates.length * 150;
  }

  const nextMovesCount = state.movesCount + 1;

  // Step special bolts on the board as the level goes on:
  // 1) Chaotic bolts shift their chaosCycleColors on every move.
  // 2) Existing Unknown '?' bolts crack open when their reveal move is reached and they are unblocked.
  // 3) Dynamic Mid-Level Unknown '?' Bolt emergence ("an unknown color bolt that comes as the level goes on"):
  //    Whenever a plate drops or at periodic move milestones, a normal bolt on the board shrouds into an Unknown '?' bolt!
  for (const remScrew of nextScrews) {
    if (remScrew.location !== 'board') continue;
    if (
      remScrew.specialVariant === 'chaotic' &&
      remScrew.chaosCycleColors &&
      remScrew.chaosCycleColors.length > 1
    ) {
      remScrew.chaosCycleColors = [
        ...remScrew.chaosCycleColors.slice(1),
        remScrew.chaosCycleColors[0],
      ];
    } else if (
      remScrew.specialVariant === 'unknown' &&
      !remScrew.unknownRevealed &&
      remScrew.unknownRevealAtMove !== undefined &&
      nextMovesCount >= remScrew.unknownRevealAtMove &&
      !isScrewBlocked(remScrew, updatedPlates)
    ) {
      remScrew.unknownRevealed = true;
    }
  }

  const activeUnknownOnBoard = nextScrews.filter(
    (s) =>
      s.location === 'board' &&
      s.specialVariant === 'unknown' &&
      !s.unknownRevealed
  ).length;

  // Special mid-level Unknown '?' bolts unlock from Level 10 (levelIndex >= 9) once core FTUE completes
  const shouldSpawnMidLevelUnknown =
    state.levelIndex >= 9 &&
    (newlyClearedPlates.length > 0 || nextMovesCount === 3 || nextMovesCount % 4 === 0) &&
    activeUnknownOnBoard < 3;

  if (shouldSpawnMidLevelUnknown) {
    const normalBoardScrews = nextScrews.filter(
      (s) =>
        s.location === 'board' &&
        (!s.specialVariant || s.specialVariant === 'normal')
    );
    if (normalBoardScrews.length >= 2) {
      // Pick a normal bolt on the board to dynamically shroud into an Unknown '?' Mystery Bolt as the level goes on!
      const pickUnknown =
        normalBoardScrews.find((s) => !isScrewBlocked(s, updatedPlates)) ??
        normalBoardScrews[0];
      pickUnknown.specialVariant = 'unknown';
      pickUnknown.unknownRevealed = false;
      pickUnknown.spawnedMidLevel = true;
      pickUnknown.unknownRevealAtMove = nextMovesCount + 4;
    }
  }

  // Resolve box completions and spare dock auto-sweep
  const resolved = resolveBoxCompletionsAndDockSweep(
    nextScrews,
    nextActiveBoxes,
    state.upcomingBoxColors,
    nextDock,
    state.completedBoxCount,
    nextScore,
    nextCombo
  );

  nextActiveBoxes = resolved.activeBoxes;
  nextDock = resolved.dockScrewIds;
  nextScore = resolved.score;
  nextCombo = resolved.combo;
  const maxCombo = Math.max(state.maxCombo, nextCombo);

  // Determine win or loss
  const remainingBoardScrews = nextScrews.filter((s) => s.location === 'board');
  const allBoxesDone = resolved.completedBoxCount >= state.totalBoxes;
  const dockFull = nextDock.every((slot) => slot !== null);

  let outcome: BoardState['outcome'] = 'ongoing';
  let defeatReason: string | undefined;

  if (remainingBoardScrews.length === 0 && allBoxesDone) {
    outcome = 'victory';
    nextScore += 500;
  } else if (dockFull && !bypassBlockAndJam) {
    outcome = 'defeat';
    defeatReason = 'All spare dock holes are jammed with non-matching bolts!';
  }

  // Choose next accessible screw for keyboard navigation (prefer constructive solutionOrder or highest layer)
  const unblockedRemaining = remainingBoardScrews.filter(
    (s) => !isScrewBlocked(s, updatedPlates)
  );
  const nextFromSolution = state.solutionOrder
    ? unblockedRemaining.find(
      (s) =>
        s.id ===
        state.solutionOrder!.find((solId) =>
          remainingBoardScrews.some((rem) => rem.id === solId)
        )
    )
    : undefined;
  const nextAccessible =
    nextFromSolution ??
    unblockedRemaining.sort((a, b) => b.layer - a.layer)[0] ??
    remainingBoardScrews[0];

  let feedbackType: NonNullable<BoardState['lastActionFeedback']>['type'] =
    usingHammer ? 'hammer' : placedInBox ? 'matched' : 'docked';
  let feedbackMsg = usingHammer
    ? `Hammer smashed & extracted ${screw.color.toUpperCase()} bolt!`
    : placedInBox
      ? `Matched ${screw.color.toUpperCase()} bolt into Target Box!`
      : `Parked ${screw.color.toUpperCase()} bolt in Spare Dock (${nextDock.filter(Boolean).length}/${state.maxDockSlots})`;

  if (resolved.boxesClearedThisTurn > 0 && !usingHammer) {
    feedbackType = 'box-cleared';
    feedbackMsg = `Target Box Sealed! +${resolved.boxesClearedThisTurn * 250} pts`;
  } else if (newlyClearedPlates.length > 0 && !usingHammer) {
    feedbackType = 'plate-dropped';
    feedbackMsg = `${newlyClearedPlates[0].name} Detached!`;
  }

  return {
    ...state,
    screws: nextScrews,
    plates: updatedPlates,
    activeBoxes: nextActiveBoxes,
    upcomingBoxColors: resolved.upcomingBoxColors,
    completedBoxCount: resolved.completedBoxCount,
    dockScrewIds: nextDock,
    maxDockSlots: Math.max(state.maxDockSlots, nextDock.length),
    score: nextScore,
    combo: nextCombo,
    maxCombo,
    movesCount: state.movesCount + 1,
    comboMatchMoves:
      state.comboMatchMoves +
      (placedInBox || resolved.boxesClearedThisTurn > 0 ? 1 : 0),
    hammersRemaining: usingHammer
      ? Math.max(0, state.hammersRemaining - 1)
      : state.hammersRemaining,
    hammerMode: false,
    highlightedScrewId: null,
    selectedScrewId: nextAccessible?.id ?? null,
    lastActionFeedback: {
      type: feedbackType,
      message: feedbackMsg,
      screwId,
      platesClearedCount: newlyClearedPlates.length,
      clearedPlateIds: newlyClearedPlates.map((p) => p.id),
      boxesClearedCount: resolved.boxesClearedThisTurn,
      levelWon: outcome === 'victory',
      timestamp: Date.now(),
    },
    outcome,
    defeatReason,
  };
}

export const MAX_POSSIBLE_DOCK_SLOTS = 8;

/**
 * Computes the 3D X coordinate for a dock slot, keeping any number of slots (5..8)
 * symmetrically centered along the workbench holding rail.
 */
export function getDockSlotWorldX(slotIndex: number, totalSlots: number = 5): number {
  const spacing = totalSlots <= 5 ? 0.88 : totalSlots === 6 ? 0.80 : totalSlots === 7 ? 0.74 : 0.68;
  const centerIndex = (totalSlots - 1) / 2;
  return (slotIndex - centerIndex) * spacing;
}

/**
 * Unlocks an extra spare dock slot (up to MAX_POSSIBLE_DOCK_SLOTS = 8 slots).
 */
export function unlockExtraDockSlot(state: BoardState): BoardState {
  if (state.maxDockSlots >= MAX_POSSIBLE_DOCK_SLOTS) {
    return state;
  }
  const nextMax = state.maxDockSlots + 1;
  const nextDock = [...state.dockScrewIds, null];
  const unlockedCount = (state.extraSlotsUnlockedCount ?? 0) + 1;
  const remainingCount = Math.max(0, (state.extraSlotsRemaining ?? 0) - 1);
  return {
    ...state,
    maxDockSlots: nextMax,
    dockScrewIds: nextDock,
    extraSlotsUnlockedCount: unlockedCount,
    extraSlotsRemaining: remainingCount,
    extraSlotUsed: nextMax >= MAX_POSSIBLE_DOCK_SLOTS,
    outcome: state.outcome === 'defeat' ? 'ongoing' : state.outcome,
    defeatReason: undefined,
    lastActionFeedback: {
      type: 'extra-slot',
      message: `Drilled Extra Dock Slot #${nextMax} (+1 Capacity)!`,
      timestamp: Date.now(),
    },
  };
}

/**
 * Refills extra slot booster charges (e.g. from watching a rewarded ad).
 */
export function refillExtraSlotCount(state: BoardState, amount = 1): BoardState {
  return {
    ...state,
    extraSlotsRemaining: (state.extraSlotsRemaining ?? 0) + amount,
  };
}

/**
 * Revives a defeat/jammed board state via rewarded video:
 * - Vaporizes up to 2 jammed bolts in the dock
 * - Expands dock capacity by +1 if below 8
 * - Resets board outcome to ongoing so player continues their streak!
 */
export function reviveBoardState(state: BoardState): BoardState {
  const nextScrews = state.screws.map((s) => ({ ...s }));
  const nextDock = [...state.dockScrewIds];
  let freedCount = 0;

  for (let i = 0; i < nextDock.length && freedCount < 2; i++) {
    const sId = nextDock[i];
    if (sId) {
      nextDock[i] = null;
      const sc = nextScrews.find((s) => s.id === sId);
      if (sc) {
        sc.location = 'box';
        sc.dockSlotIndex = undefined;
        sc.targetBoxId = undefined;
        sc.targetBoxSlot = undefined;
      }
      freedCount++;
    }
  }

  let nextMax = state.maxDockSlots;
  if (nextMax < MAX_POSSIBLE_DOCK_SLOTS) {
    nextMax += 1;
    nextDock.push(null);
  }

  // Sweep any newly credited revive-banked bolts into matching open active boxes so the board stays 100% winnable
  const resolved = resolveBoxCompletionsAndDockSweep(
    nextScrews,
    state.activeBoxes,
    state.upcomingBoxColors,
    nextDock,
    state.completedBoxCount,
    state.score,
    state.combo
  );

  const remainingBoardScrews = nextScrews.filter((s) => s.location === 'board');
  const allBoxesDone = resolved.completedBoxCount >= state.totalBoxes;
  const nextOutcome: BoardState['outcome'] =
    remainingBoardScrews.length === 0 && allBoxesDone ? 'victory' : 'ongoing';

  return {
    ...state,
    screws: nextScrews,
    activeBoxes: resolved.activeBoxes,
    upcomingBoxColors: resolved.upcomingBoxColors,
    completedBoxCount: resolved.completedBoxCount,
    dockScrewIds: resolved.dockScrewIds,
    maxDockSlots: nextMax,
    score: resolved.score,
    combo: resolved.combo,
    extraSlotUsed: nextMax >= MAX_POSSIBLE_DOCK_SLOTS,
    outcome: nextOutcome,
    defeatReason: undefined,
    revivesUsed: (state.revivesUsed ?? 0) + 1,
    lastActionFeedback: {
      type: 'extra-slot',
      message: `⚡ REVIVE SUCCESSFUL: Cleared ${freedCount} Bolts + Extra Slot!`,
      timestamp: Date.now(),
    },
  };
}

/**
 * Refills player's Machinist Hammers via rewarded video.
 */
export function refillHammerCount(state: BoardState, amount: number = 1): BoardState {
  return {
    ...state,
    hammersRemaining: state.hammersRemaining + amount,
    lastActionFeedback: {
      type: 'hammer',
      message: `🔨 +${amount} Machinist Hammer Forged!`,
      timestamp: Date.now(),
    },
  };
}

/**
 * Finds the best strategic screw on the board:
 * 1. If the board has a constructive `solutionOrder` and the next remaining screw in that
 *    sequence is unblocked and safe to extract, returns it immediately.
 * 2. Otherwise scores unblocked screws by active Target Box match + plate release priority.
 */
export function findBestHintScrew(state: BoardState): string | null {
  const unblocked = state.screws.filter(
    (s) => s.location === 'board' && !isScrewBlocked(s, state.plates)
  );
  if (unblocked.length === 0) return null;

  const activeColors = new Set(
    state.activeBoxes.filter((b) => !b.completed).map((b) => b.color)
  );

  // If a constructive solution order exists, check the next remaining screw in solutionOrder
  if (state.solutionOrder && state.solutionOrder.length > 0) {
    const unblockedMap = new Map(unblocked.map((s) => [s.id, s]));
    for (const solId of state.solutionOrder) {
      const sc = state.screws.find((s) => s.id === solId);
      if (!sc || sc.location !== 'board') continue;
      // The first still-on-board screw in solutionOrder:
      if (unblockedMap.has(solId)) {
        const freeSlots = state.dockScrewIds.filter((d) => d === null).length;
        if (activeColors.has(sc.color) || freeSlots > 1) {
          return solId;
        }
      }
      break;
    }
  }

  const scored = unblocked.map((screw) => {
    let priority = 0;
    if (activeColors.has(screw.color)) {
      priority += 100;
    }
    for (const plate of state.plates) {
      if (plate.status !== 'cleared' && plate.screwIds.includes(screw.id)) {
        if (plate.screwIds.length === 1) priority += 50;
        else if (plate.screwIds.length === 2) priority += 25;
      }
    }
    priority += screw.layer * 5;
    return { id: screw.id, priority };
  });

  scored.sort((a, b) => b.priority - a.priority);
  return scored[0].id;
}

/**
 * Verifies that `board` can be played to complete victory (`outcome === 'victory'`)
 * using only legal unblocked screw moves (zero boosters used).
 */
export function solveBoard(board: BoardState): {
  solved: boolean;
  finalBoard: BoardState;
  moves: string[];
} {
  let curr = board;
  const moves: string[] = [];
  const maxSteps = board.screws.length + 5;

  for (let step = 0; step < maxSteps && curr.outcome === 'ongoing'; step++) {
    const nextScrewId = findBestHintScrew(curr);
    if (!nextScrewId) break;
    curr = unscrewAction(curr, nextScrewId, false);
    moves.push(nextScrewId);
  }

  return {
    solved: curr.outcome === 'victory',
    finalBoard: curr,
    moves,
  };
}

/**
 * Toggles Hammer Mode on/off. When Hammer Mode is active, clicking ANY bolt on the board
 * (even bolts covered/blocked by upper plates) smashes and extracts it immediately!
 */
export function toggleHammerMode(state: BoardState): BoardState {
  if (state.hammersRemaining <= 0 || state.outcome !== 'ongoing') return state;

  const nextHammerMode = !state.hammerMode;
  const remaining = state.screws.filter((s) => s.location === 'board');
  const defaultTarget =
    state.selectedScrewId ?? findBestHintScrew(state) ?? remaining[0]?.id ?? null;

  return {
    ...state,
    hammerMode: nextHammerMode,
    highlightedScrewId: nextHammerMode ? defaultTarget : null,
    selectedScrewId: defaultTarget,
  };
}

export interface SpecialBoltSummary {
  distinctColorsOnBoard: number;
  colorList: ScrewColor[];
  chaoticCount: number;
  rainbowCount: number;
  unknownHiddenCount: number;
  unknownRevealedCount: number;
  spawnedMidLevelCount: number;
  chaoticIds: string[];
  rainbowIds: string[];
  unknownIds: string[];
}

/**
 * Computes telemetry on the board's color variety and special bolt variants
 * (chaotic color-shifting, rainbow wildcard, and unknown '?' mystery bolts).
 */
export function getSpecialBoltStats(board: BoardState): SpecialBoltSummary {
  const colorSet = new Set<ScrewColor>();
  const chaoticIds: string[] = [];
  const rainbowIds: string[] = [];
  const unknownIds: string[] = [];
  let unknownHiddenCount = 0;
  let unknownRevealedCount = 0;
  let spawnedMidLevelCount = 0;

  for (const s of board.screws) {
    colorSet.add(s.color);
    if (s.spawnedMidLevel) {
      spawnedMidLevelCount++;
    }
    if (s.location !== 'board') continue;
    if (s.specialVariant === 'chaotic') {
      chaoticIds.push(s.id);
    } else if (s.specialVariant === 'rainbow') {
      rainbowIds.push(s.id);
    } else if (s.specialVariant === 'unknown') {
      unknownIds.push(s.id);
      if (s.unknownRevealed) {
        unknownRevealedCount++;
      } else {
        unknownHiddenCount++;
      }
    }
  }

  return {
    distinctColorsOnBoard: colorSet.size,
    colorList: Array.from(colorSet),
    chaoticCount: chaoticIds.length,
    rainbowCount: rainbowIds.length,
    unknownHiddenCount,
    unknownRevealedCount,
    spawnedMidLevelCount,
    chaoticIds,
    rainbowIds,
    unknownIds,
  };
}

