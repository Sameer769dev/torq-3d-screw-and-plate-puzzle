import test from 'node:test';
import assert from 'node:assert/strict';
import {
  activateAutoPlay,
  completeAutoPlayLevel,
  createInitialAutoPlayState,
  pickNextAutoPlayScrewId,
  recordBoltExtractedForAutoPlay,
} from './autoPlay';
import {
  computeComboFrequency,
  computeDifficultyGaugeState,
  computeSolveSpeedIndex,
  createInitialDDAState,
  evaluateLiveDDA,
  recordBoardCompletionDDA,
} from './dda';
import { HAPTIC_PATTERNS, HapticsEngine } from './haptics';
import { computeViewportLayout } from './layout';
import { generateEndlessBlueprint, LEVELS } from './levels';
import {
  createLevelTransition3DState,
  getLevelTransitionStats,
  startLevelTransition3D,
  stepLevelTransition3D,
  triggerPowerUpActivation3D,
} from './levelTransition3d';
import {
  createParticle3DPool,
  emitLevelVictory,
  emitPlateCleared,
  getParticle3DStats,
  stepParticles3D,
} from './particles3d';
import {
  advanceEndlessBoard,
  createBoardFromLevel,
  createEndlessBoard,
  findBestHintScrew,
  getSpecialBoltStats,
  isScrewBlocked,
  solveBoard,
  toggleHammerMode,
  unlockExtraDockSlot,
  unscrewAction,
} from './rules';
import {
  createIdleHandState,
  forceIdleHand,
  getIdleHandStats,
  resetIdleTimer,
  stepIdleHandState,
} from './idleHand';
import {
  createScreenShake3DState,
  getScreenShakeStats,
  stepScreenShake3D,
  triggerBoxCompleteShake,
  triggerPlateDropShake,
  triggerVictoryShake,
} from './screenShake3d';
import {
  plateMaterialToAcoustic,
  organicJitter,
} from './audio/PhysicalModel';
import {
  SoundEngine,
  SOUNDSCAPE_PACK_ORDER,
  SOUNDSCAPE_PACKS,
} from './sound';
import {
  diffCalendarDays,
  evaluateDayStreak,
  loadAndRecordDailyStreak,
} from './streak';
import { ScrewColor } from './types';

test('Every level has exact color multiples of 3 matching its boxSequence', () => {
  for (const level of LEVELS) {
    assert.equal(
      level.screws.length,
      level.boxSequence.length * 3,
      `Level ${level.name} screw count must equal 3 * boxSequence.length`
    );

    const screwCounts: Partial<Record<ScrewColor, number>> = {};
    for (const s of level.screws) {
      screwCounts[s.color] = (screwCounts[s.color] ?? 0) + 1;
    }

    const boxCounts: Partial<Record<ScrewColor, number>> = {};
    for (const c of level.boxSequence) {
      boxCounts[c] = ((boxCounts[c] ?? 0) + 3);
    }

    assert.deepEqual(
      screwCounts,
      boxCounts,
      `Level ${level.name} screw color distribution must match boxSequence * 3`
    );
  }
});

test('Level 1 top layer screws are unblocked while covered lower layer screws are blocked', () => {
  const board = createBoardFromLevel(0);
  // s7, s8, s9 are on layer 2 (top)
  const s7 = board.screws.find((s) => s.id === 's7')!;
  const s8 = board.screws.find((s) => s.id === 's8')!;
  const s9 = board.screws.find((s) => s.id === 's9')!;
  assert.equal(isScrewBlocked(s7, board.plates), false);
  assert.equal(isScrewBlocked(s8, board.plates), false);
  assert.equal(isScrewBlocked(s9, board.plates), false);

  // s2 is at (0, 1.2) on layer 1, covered by p4 (Center Acrylic Bridge at (0, 0.2), width 5.6, height 2.5 -> y from -1.05 to +1.45)
  const s2 = board.screws.find((s) => s.id === 's2')!;
  assert.equal(isScrewBlocked(s2, board.plates), true);

  // Attempting to unscrew s2 while blocked returns blocked feedback without moving s2
  const afterBlockedAttempt = unscrewAction(board, 's2');
  assert.equal(afterBlockedAttempt.lastActionFeedback?.type, 'blocked');
  assert.equal(afterBlockedAttempt.screws.find((s) => s.id === 's2')?.location, 'board');
});

test('Unscrewing all 3 amber top screws in Level 1 clears the first Target Box and drops the top plate', () => {
  let board = createBoardFromLevel(0);
  board = unscrewAction(board, 's7');
  board = unscrewAction(board, 's8');
  // With 1 screw left on p4, p4 should be dangling
  const p4Mid = board.plates.find((p) => p.id === 'p4')!;
  assert.equal(p4Mid.status, 'dangling');

  board = unscrewAction(board, 's9');
  const p4After = board.plates.find((p) => p.id === 'p4')!;
  assert.equal(p4After.status, 'cleared');
  assert.deepEqual(board.lastActionFeedback?.clearedPlateIds, ['p4']);
  assert.equal(board.completedBoxCount, 1);

  // Now s2 on layer 1 is no longer blocked by p4!
  const s2 = board.screws.find((s) => s.id === 's2')!;
  assert.equal(isScrewBlocked(s2, board.plates), false);
});

test('Level 1 can be played to complete victory using solver', () => {
  let board = createBoardFromLevel(0);
  let safety = 0;
  while (board.outcome === 'ongoing' && safety < 20) {
    const nextScrewId = findBestHintScrew(board);
    assert.ok(nextScrewId, 'Solver should find an available screw');
    board = unscrewAction(board, nextScrewId);
    safety++;
  }
  assert.equal(board.outcome, 'victory');
  assert.equal(board.lastActionFeedback?.levelWon, true);
  assert.equal(board.completedBoxCount, board.totalBoxes);
});

test('Extra Dock Slot and Hammer (remove any bolt including blocked bolts) work properly', () => {
  let board = createBoardFromLevel(0);
  board = unscrewAction(board, 's7');
  assert.equal(board.movesCount, 1);

  board = unlockExtraDockSlot(board);
  assert.equal(board.maxDockSlots, 6);
  assert.equal(board.dockScrewIds.length, 6);

  // Activate Hammer Mode and remove 's2', which is blocked underneath plate p4!
  assert.equal(isScrewBlocked(board.screws.find((s) => s.id === 's2')!, board.plates), true);
  board = toggleHammerMode(board);
  assert.equal(board.hammerMode, true);
  board = unscrewAction(board, 's2');
  assert.equal(board.screws.find((s) => s.id === 's2')?.location !== 'board', true);
  assert.equal(board.hammersRemaining, 2);
  assert.equal(board.hammerMode, false);
  assert.equal(board.lastActionFeedback?.type, 'hammer');
});

test('HapticsEngine triggers short haptic pulses when screws are unscrewed and when levels are completed', () => {
  const recordedPulses: (number | number[])[] = [];
  const haptics = new HapticsEngine((pattern) => {
    recordedPulses.push(pattern);
    return true;
  });

  // 1. Unscrewing a matched screw triggers the matched unscrew pulse
  assert.equal(haptics.pulseUnscrew(true), true);
  assert.deepEqual(recordedPulses[0], [...HAPTIC_PATTERNS.unscrewMatch]);

  // 2. Unscrewing a docked screw triggers the single unscrew pulse
  assert.equal(haptics.pulseUnscrew(false), true);
  assert.equal(recordedPulses[1], HAPTIC_PATTERNS.unscrewDock);

  // 3. Completing a level triggers the celebratory multi-pulse pattern
  assert.equal(haptics.pulseLevelComplete(), true);
  assert.deepEqual(recordedPulses[2], [...HAPTIC_PATTERNS.levelComplete]);

  // 4. Disabling haptics suppresses further vibrations
  haptics.enabled = false;
  assert.equal(haptics.pulseUnscrew(true), false);
  assert.equal(recordedPulses.length, 3);
});

test('3D Particle System emits metallic sparks and 3D debris fragments when a plate is cleared or a level is won', () => {
  const pool = createParticle3DPool();
  const board = createBoardFromLevel(0);
  const topPlate = board.plates.find((p) => p.id === 'p4')!;

  // 1. Emit plate cleared burst
  emitPlateCleared(pool, topPlate);
  let stats = getParticle3DStats(pool);
  assert.equal(stats.totalPlateBursts, 1);
  assert.equal(stats.activeSparks, 36);
  assert.equal(stats.activeDebris, 22);

  // 2. Step physics forward and verify particles remain active during lifetime
  stepParticles3D(pool, 0.1);
  stats = getParticle3DStats(pool);
  assert.equal(stats.activeSparks > 0, true);
  assert.equal(stats.activeDebris > 0, true);

  // 3. Emit level victory burst and verify multi-fountain sparks + debris
  emitLevelVictory(pool);
  stats = getParticle3DStats(pool);
  assert.equal(stats.totalVictoryBursts, 1);
  assert.equal(stats.activeSparks >= 84, true);
  assert.equal(stats.activeDebris >= 48, true);

  // 4. Advance beyond max lifetime so all particles deactivate cleanly
  stepParticles3D(pool, 3.0);
  stats = getParticle3DStats(pool);
  assert.equal(stats.activeSparks, 0);
  assert.equal(stats.activeDebris, 0);
});

test('3D Screen-Shake Rig triggers subtle spring-damper recoil when a plate is dropped or a box is completed', () => {
  const shake = createScreenShake3DState();
  assert.equal(getScreenShakeStats(shake).active, false);

  // 1. Trigger plate drop shake
  triggerPlateDropShake(shake, 1);
  stepScreenShake3D(shake, 0.016, 0.1);
  let stats = getScreenShakeStats(shake);
  assert.equal(stats.active, true);
  assert.equal(stats.plateDropShakes, 1);
  assert.equal(Math.abs(stats.offsetY) > 0, true);
  assert.equal(Math.abs(stats.offsetY) <= 0.22, true);

  // 2. Trigger box completion shake
  triggerBoxCompleteShake(shake, 1);
  stepScreenShake3D(shake, 0.016, 0.2);
  stats = getScreenShakeStats(shake);
  assert.equal(stats.active, true);
  assert.equal(stats.boxCompleteShakes, 1);

  // 3. Settle back to equilibrium after damping
  for (let i = 0; i < 60; i++) {
    stepScreenShake3D(shake, 0.03, 0.2 + i * 0.03);
  }
  stats = getScreenShakeStats(shake);
  assert.equal(stats.active, false);
});

test('3D Level Transition & Power-Up Choreography animates level transitions, sequential power-up charge wave, and power-up activations', () => {
  const trans = createLevelTransition3DState('title');
  assert.equal(trans.modalBlend, 1);
  assert.equal(trans.hudBlend, 0);

  // 1. Start a level transition -> arms sequential 4-button power-up charge wave
  startLevelTransition3D(trans);
  const chargedSlots: number[] = [];

  for (let i = 0; i < 30; i++) {
    stepLevelTransition3D(trans, 'playing', 0.04, (slotIdx) => {
      chargedSlots.push(slotIdx);
    });
  }

  const stats = getLevelTransitionStats(trans);
  assert.equal(stats.levelTransitionCount, 1);
  assert.deepEqual(chargedSlots, [0, 1, 2, 3]);
  assert.equal(stats.powerUpChargeBurstsTriggered, 4);
  assert.equal(stats.hudBlend > 0.99, true);
  assert.equal(stats.modalBlend < 0.01, true);

  // 2. Trigger an interactive power-up activation (e.g., +1 SLOT at index 1)
  triggerPowerUpActivation3D(trans, 1);
  stepLevelTransition3D(trans, 'playing', 0.05);
  const afterActStats = getLevelTransitionStats(trans);
  assert.equal(afterActStats.powerUpActivationsTriggered, 1);
  assert.equal(afterActStats.buttonScales[1] > 1.05, true);
  assert.equal(trans.extraSlotPopTimer > 0, true);
});

test('Endless Procedural Generator produces progressively harder assemblies that are 100% solvable without boosters', () => {
  let prevScrewCount = 0;
  let prevMaxLayer = 0;
  let board = createEndlessBoard(0);

  for (let depth = 0; depth <= 10; depth++) {
    const bp = generateEndlessBlueprint(depth);
    const maxLayer = bp.screws.reduce((m, s) => Math.max(m, s.layer), 0);

    // Difficulty monotonically increases or stays at high cap
    assert.equal(
      bp.screws.length >= prevScrewCount,
      true,
      `Depth ${depth} screws (${bp.screws.length}) should be >= depth ${depth - 1} (${prevScrewCount})`
    );
    assert.equal(
      maxLayer >= prevMaxLayer,
      true,
      `Depth ${depth} maxLayer (${maxLayer}) should be >= depth ${depth - 1} (${prevMaxLayer})`
    );
    prevScrewCount = bp.screws.length;
    prevMaxLayer = maxLayer;

    // Verify 100% solvability without boosters!
    const result = solveBoard(board);
    assert.equal(
      result.solved,
      true,
      `Endless board at depth ${depth} must be 100% solvable without boosters`
    );
    assert.equal(result.finalBoard.outcome, 'victory');
    assert.equal(
      result.finalBoard.completedBoxCount,
      result.finalBoard.totalBoxes
    );

    // Advance seamlessly to next endless depth and verify score carries over
    const scoreAfterWin = result.finalBoard.score;
    assert.equal(scoreAfterWin > 0, true);
    board = advanceEndlessBoard(result.finalBoard);
    assert.equal(board.levelIndex, depth + 1);
    assert.equal(board.score, scoreAfterWin);
  }
});

test('Dynamic Difficulty Adjustment (DDA) analyzes solve time and combo frequency to tune procedural complexity in real-time', () => {
  const initialDDA = createInitialDDAState(0);
  assert.equal(initialDDA.skillRating, 0.5);
  assert.equal(initialDDA.activeProfile.band, 'balanced');

  // 1. Verify solve speed and combo frequency metrics
  const fastSpeed = computeSolveSpeedIndex(12, 99, 9);
  const slowSpeed = computeSolveSpeedIndex(180, 99, 9);
  assert.equal(fastSpeed > 0.9, true);
  assert.equal(slowSpeed < 0.2, true);

  const highCombo = computeComboFrequency(9, 9, 9, 9);
  const lowCombo = computeComboFrequency(2, 9, 1, 9);
  assert.equal(highCombo > 0.95, true);
  assert.equal(lowCombo < 0.3, true);

  // 2. Simulate a High-Speed, High-Combo player clearing depth 0 and 1
  let fastDDA = recordBoardCompletionDDA(initialDDA, {
    depth: 0,
    solveTimeSec: 10,
    parTimeSec: 99,
    totalMoves: 9,
    comboMatchMoves: 9,
    peakCombo: 9,
    totalScrews: 9,
  });
  fastDDA = recordBoardCompletionDDA(fastDDA, {
    depth: 1,
    solveTimeSec: 14,
    parTimeSec: 117,
    totalMoves: 12,
    comboMatchMoves: 12,
    peakCombo: 12,
    totalScrews: 12,
  });

  // 3. Simulate a Struggling (Slow Solve Time, Low Combo Frequency) player at the same depth
  let slowDDA = recordBoardCompletionDDA(initialDDA, {
    depth: 0,
    solveTimeSec: 175,
    parTimeSec: 99,
    totalMoves: 9,
    comboMatchMoves: 3,
    peakCombo: 1,
    totalScrews: 9,
  });
  slowDDA = recordBoardCompletionDDA(slowDDA, {
    depth: 1,
    solveTimeSec: 210,
    parTimeSec: 117,
    totalMoves: 12,
    comboMatchMoves: 3,
    peakCombo: 1,
    totalScrews: 12,
  });

  assert.equal(fastDDA.skillRating > 0.8, true);
  assert.equal(
    fastDDA.activeProfile.band === 'accelerated' ||
    fastDDA.activeProfile.band === 'overdrive',
    true
  );
  assert.equal(slowDDA.skillRating < 0.35, true);
  assert.equal(slowDDA.activeProfile.band, 'recovery');

  // 4. Generate boards for depth 2 using fastDDA vs slowDDA and verify tuned complexity + 100% solvability
  const fastBoard = createEndlessBoard(2, {
    ddaProfile: fastDDA.activeProfile,
  });
  const slowBoard = createEndlessBoard(2, {
    ddaProfile: slowDDA.activeProfile,
  });

  assert.equal(
    fastBoard.screws.length > slowBoard.screws.length,
    true,
    `Fast/high-combo player should receive more bolts (${fastBoard.screws.length}) than struggling player (${slowBoard.screws.length})`
  );
  assert.equal(
    fastDDA.activeProfile.dockInterleaveLimit >
    slowDDA.activeProfile.dockInterleaveLimit,
    true
  );

  // Both DDA-tuned boards must remain 100% solvable without boosters!
  assert.equal(solveBoard(fastBoard).solved, true);
  assert.equal(solveBoard(slowBoard).solved, true);

  // 5. Verify live mid-board telemetry updates DDA state in real-time
  const liveUpdated = evaluateLiveDDA(
    initialDDA,
    0,
    3.0,
    99,
    5,
    5,
    5,
    5,
    9
  );
  assert.equal(liveUpdated.skillRating > initialDDA.skillRating, true);
  assert.equal(liveUpdated.lastComboFrequency > 0.85, true);
});

test('Zero bolt-to-bolt overlap and zero plate-edge clipping across generated levels 0..15', () => {
  const BOLT_WASHER_RADIUS = 0.36;
  const MIN_BOLT_CENTER_DIST = 1.0; // Lattice spacing is >= 1.04 world units

  for (let depth = 0; depth <= 15; depth++) {
    const board = createEndlessBoard(depth);

    // 1. Verify level name shows incrementing LEVEL counter and never says ENDLESS
    assert.equal(
      board.levelName.toUpperCase().includes('ENDLESS'),
      false,
      `Level name "${board.levelName}" must not contain ENDLESS`
    );
    assert.equal(
      board.levelName.toUpperCase().startsWith('LEVEL '),
      true,
      `Level name "${board.levelName}" must start with LEVEL`
    );

    // 2. Verify no two bolts on the board (even on different layers!) ever overlap
    for (let i = 0; i < board.screws.length; i++) {
      for (let j = i + 1; j < board.screws.length; j++) {
        const s1 = board.screws[i];
        const s2 = board.screws[j];
        const dist = Math.hypot(s1.x - s2.x, s1.y - s2.y);
        assert.equal(
          dist >= MIN_BOLT_CENTER_DIST,
          true,
          `Depth ${depth}: Bolts ${s1.id} (${s1.x},${s1.y}) and ${s2.id} (${s2.x},${s2.y}) are too close (${dist.toFixed(3)} < ${MIN_BOLT_CENTER_DIST})`
        );
      }
    }

    // 3. Verify no plate edge ever partially clips a bolt washer
    for (const plate of board.plates) {
      const halfW = plate.width / 2;
      const halfH = plate.height / 2;
      for (const screw of board.screws) {
        if (plate.screwIds.includes(screw.id)) {
          // Attached bolt must sit cleanly inside the plate bounds
          assert.equal(
            Math.abs(screw.x - plate.x) <= halfW - BOLT_WASHER_RADIUS,
            true,
            `Depth ${depth}: Attached bolt ${screw.id} protrudes outside plate ${plate.id} X bounds`
          );
          assert.equal(
            Math.abs(screw.y - plate.y) <= halfH - BOLT_WASHER_RADIUS,
            true,
            `Depth ${depth}: Attached bolt ${screw.id} protrudes outside plate ${plate.id} Y bounds`
          );
          continue;
        }

        const dx = Math.max(0, Math.abs(screw.x - plate.x) - halfW);
        const dy = Math.max(0, Math.abs(screw.y - plate.y) - halfH);
        const edgeDist = Math.hypot(dx, dy);

        if (edgeDist > 0) {
          // Bolt center is outside plate footprint -> plate edge must clear the entire bolt washer (0.36) with margin!
          assert.equal(
            edgeDist >= BOLT_WASHER_RADIUS + 0.18,
            true,
            `Depth ${depth}: Plate ${plate.id} partially clips adjacent bolt ${screw.id} (edgeDist=${edgeDist.toFixed(3)})`
          );
        } else {
          // Bolt center is inside plate footprint -> must be on a different layer (never same-layer collision)
          // and 100% interior so the plate border never clips across the bolt head/washer
          assert.equal(
            plate.layer !== screw.layer,
            true,
            `Depth ${depth}: Plate ${plate.id} (layer ${plate.layer}) overlaps unattached bolt ${screw.id} on the same layer ${screw.layer}`
          );
          assert.equal(
            Math.abs(screw.x - plate.x) <= halfW - BOLT_WASHER_RADIUS,
            true,
            `Depth ${depth}: Bolt ${screw.id} is partially clipped by plate ${plate.id} X edge`
          );
          assert.equal(
            Math.abs(screw.y - plate.y) <= halfH - BOLT_WASHER_RADIUS,
            true,
            `Depth ${depth}: Bolt ${screw.id} is partially clipped by plate ${plate.id} Y edge`
          );
        }
      }
    }
  }
});

test('HUD Difficulty Gauge monotonically fills up as procedural difficulty increases across the infinite board chain', () => {
  let prevFill = 0;

  for (let depth = 0; depth <= 8; depth++) {
    const board = createEndlessBoard(depth);
    const maxLayer = board.screws.reduce((m, s) => Math.max(m, s.layer), 0);
    const gauge = computeDifficultyGaugeState(
      depth,
      board.screws.length,
      maxLayer,
      1.0
    );

    assert.equal(
      gauge.fillRatio > prevFill,
      true,
      `Depth ${depth} gauge fillRatio (${gauge.fillRatio}) must be > previous depth (${prevFill})`
    );
    assert.equal(gauge.activeSegments >= 1 && gauge.activeSegments <= 10, true);
    prevFill = gauge.fillRatio;
  }

  // Verify Level 1 starts at a subtle baseline (~20%) and high depth reaches near-full (>= 85%)
  const g0 = computeDifficultyGaugeState(0, 9, 2, 1.0);
  const gHigh = computeDifficultyGaugeState(10, 24, 5, 1.65);
  assert.equal(g0.percent >= 16 && g0.percent <= 26, true);
  assert.equal(g0.tierLabel, 'TORQ I');
  assert.equal(gHigh.percent >= 92, true);
  assert.equal(gHigh.tierLabel, 'TORQ MAX');
  assert.equal(gHigh.activeSegments, 10);
});

test('Day Streak counter tracks daily gameplay sessions across same-day, consecutive-day, and lapsed-day transitions with visual reward indicators', () => {
  assert.equal(diffCalendarDays('2026-11-05', '2026-11-06'), 1);
  assert.equal(diffCalendarDays('2026-11-06', '2026-11-06'), 0);
  assert.equal(diffCalendarDays('2026-11-01', '2026-11-06'), 5);

  // 1. First session ever -> Day 1 streak ('started'), IGNITION +100 PTS reward
  const day1 = evaluateDayStreak(null, '2026-11-01');
  assert.equal(day1.currentStreak, 1);
  assert.equal(day1.bestStreak, 1);
  assert.equal(day1.status, 'started');
  assert.equal(day1.rewardTier, 'IGNITION');
  assert.equal(day1.rewardBonusPoints, 100);
  assert.equal(day1.cycleDayIndex, 1);
  assert.equal(day1.cycleNodes.filter((n) => n.completed).length, 1);

  // 2. Playing again on the same day -> preserves streak ('active_today')
  const sameDay = evaluateDayStreak(day1, '2026-11-01');
  assert.equal(sameDay.currentStreak, 1);
  assert.equal(sameDay.status, 'active_today');

  // 3. Returning the next consecutive day -> increments to Day 2 ('extended'), PRECISION +200 PTS
  const day2 = evaluateDayStreak(sameDay, '2026-11-02');
  assert.equal(day2.currentStreak, 2);
  assert.equal(day2.bestStreak, 2);
  assert.equal(day2.status, 'extended');
  assert.equal(day2.rewardTier, 'PRECISION');
  assert.equal(day2.rewardBonusPoints, 200);
  assert.equal(day2.cycleNodes.filter((n) => n.completed).length, 2);

  // 4. Returning on Day 3 -> MOMENTUM +350 PTS
  const day3 = evaluateDayStreak(day2, '2026-11-03');
  assert.equal(day3.currentStreak, 3);
  assert.equal(day3.rewardTier, 'MOMENTUM');
  assert.equal(day3.rewardBonusPoints, 350);

  // 5. Missing a calendar day (jumping from Nov 03 to Nov 05) -> resets currentStreak to 1 while preserving bestStreak = 3
  const afterGap = evaluateDayStreak(day3, '2026-11-05');
  assert.equal(afterGap.currentStreak, 1);
  assert.equal(afterGap.bestStreak, 3);
  assert.equal(afterGap.status, 'reset');
  assert.equal(afterGap.rewardTier, 'IGNITION');

  // 6. Verify persistent storage round-trip across consecutive days
  const memStore = new Map<string, string>();
  const mockStorage = {
    getItem: (k: string) => memStore.get(k) ?? null,
    setItem: (k: string, v: string) => {
      memStore.set(k, v);
    },
  };

  const s1 = loadAndRecordDailyStreak(mockStorage, new Date(2026, 10, 5, 12, 0, 0));
  assert.equal(s1.currentStreak, 1);
  const s2 = loadAndRecordDailyStreak(mockStorage, new Date(2026, 10, 6, 12, 0, 0));
  assert.equal(s2.currentStreak, 2);
  assert.equal(s2.status, 'extended');
});

test('3D Radioactive Liquid Auto-Play fills gradually across multiple levels (45 bolts) and autonomously solves a level once full', () => {
  let ap = createInitialAutoPlayState(0);
  assert.equal(ap.targetBolts, 45);
  assert.equal(ap.fillRatio, 0);
  assert.equal(ap.isReady, false);
  assert.equal(ap.autoPlaying, false);

  // Cannot activate before reaching 100%
  assert.equal(activateAutoPlay(ap).autoPlaying, false);

  // Completing an entire 15-bolt level only charges 15/45 (33%), NOT 100% in a single level
  for (let i = 1; i <= 15; i++) {
    ap = recordBoltExtractedForAutoPlay(ap, 1);
  }
  assert.equal(ap.chargeBolts, 15);
  assert.equal(ap.percent, 33);
  assert.equal(ap.isReady, false);

  // Extract bolts 16..44 across subsequent levels -> still charging
  for (let i = 16; i <= 44; i++) {
    ap = recordBoltExtractedForAutoPlay(ap, 1);
    assert.equal(ap.chargeBolts, i);
    assert.equal(ap.isReady, false);
  }

  // 45th bolt reaches 100% -> unlocks Auto-Play!
  ap = recordBoltExtractedForAutoPlay(ap, 1);
  assert.equal(ap.chargeBolts, 45);
  assert.equal(ap.fillRatio, 1);
  assert.equal(ap.percent, 100);
  assert.equal(ap.isReady, true);

  // Activate Auto-Play on a generated Level 2 board and verify autonomous solve!
  ap = activateAutoPlay(ap);
  assert.equal(ap.autoPlaying, true);
  assert.equal(ap.isReady, false);
  assert.equal(ap.totalActivations, 1);

  let board = createEndlessBoard(1);
  let steps = 0;
  while (board.outcome === 'ongoing' && steps < 30) {
    const nextScrewId = pickNextAutoPlayScrewId(board);
    assert.ok(nextScrewId, 'Auto-Play must always find a next bolt to extract');
    board = unscrewAction(board, nextScrewId, false, true);
    const rem = board.screws.filter((s) => s.location === 'board').length;
    ap = recordBoltExtractedForAutoPlay(ap, 1, rem, board.screws.length);
    steps++;
  }

  assert.equal(board.outcome, 'victory');
  ap = completeAutoPlayLevel(ap);
  assert.equal(ap.autoPlaying, false);
  assert.equal(ap.fillRatio, 0);
  assert.equal(ap.chargeBolts, 0);
});

test('High-impact screen-shake and Idle 3D Guide Hand over the correct bolt work properly', () => {
  // 1. Verify high-impact screen-shake on Box Completion, Plate Drop, and Victory
  const shake = createScreenShake3DState();
  triggerBoxCompleteShake(shake, 1);
  stepScreenShake3D(shake, 0.016, 1.0);
  let shakeStats = getScreenShakeStats(shake);
  assert.equal(shakeStats.active, true);
  assert.equal(shakeStats.lastEvent, 'box-complete');
  assert.equal(shakeStats.boxCompleteShakes, 1);
  assert.equal(Math.abs(shakeStats.fovPunch) > 0.05, true);
  assert.equal(shakeStats.flashAlpha > 0.2, true);

  const dropShake = createScreenShake3DState();
  triggerPlateDropShake(dropShake, 2);
  stepScreenShake3D(dropShake, 0.016, 1.02);
  shakeStats = getScreenShakeStats(dropShake);
  assert.equal(shakeStats.lastEvent, 'plate-drop');
  assert.equal(shakeStats.plateDropShakes, 2);
  assert.equal(Math.abs(shakeStats.pitchX) > 0.001, true);

  triggerVictoryShake(shake);
  stepScreenShake3D(shake, 0.016, 1.04);
  shakeStats = getScreenShakeStats(shake);
  assert.equal(shakeStats.lastEvent, 'victory');

  // 2. Verify Idle 3D Guide Hand stays hidden while active, then appears over the correct bolt after idle threshold
  const board = createEndlessBoard(0);
  const optimalBoltId = findBestHintScrew(board);
  assert.ok(optimalBoltId, 'Board must have an optimal solver bolt');

  const idleState = createIdleHandState(3.0);
  assert.equal(idleState.isIdle, false);
  assert.equal(getIdleHandStats(idleState).handVisible, false);

  // Step for 2.0s (< 3.0s threshold) -> still not idle
  for (let i = 0; i < 20; i++) {
    stepIdleHandState(idleState, 0.1, true, optimalBoltId);
  }
  assert.equal(idleState.isIdle, false);

  // Step for another 1.5s (total 3.5s >= 3.0s threshold) -> idle hand activates over optimalBoltId!
  for (let i = 0; i < 15; i++) {
    stepIdleHandState(idleState, 0.1, true, optimalBoltId);
  }
  const idleStats = getIdleHandStats(idleState);
  assert.equal(idleStats.isIdle, true);
  assert.equal(idleStats.targetScrewId, optimalBoltId);
  assert.equal(idleStats.handVisible, true);
  assert.equal(idleStats.revealBlend > 0.8, true);

  // Player performs an action -> idle timer resets immediately
  resetIdleTimer(idleState);
  assert.equal(idleState.isIdle, false);
  assert.equal(idleState.idleSec, 0);

  // Force idle hand helper locks onto the specified solver bolt immediately
  forceIdleHand(idleState, optimalBoltId);
  stepIdleHandState(idleState, 0.05, true, optimalBoltId);
  assert.equal(idleState.isIdle, true);
  assert.equal(idleState.targetScrewId, optimalBoltId);
});

test('Higher levels (Level 10+) add expanded colors, chaotic color-shifting bolts, rainbow wildcard bolts, and unknown mystery bolts while FTUE Levels 1..9 remain clean', () => {
  // 0. Verify FTUE Levels 1..9 (depth 0..8) stay free of chaotic/rainbow/unknown special bolts
  for (let d = 0; d <= 8; d++) {
    const ftueBoard = createEndlessBoard(d);
    const ftueStats = getSpecialBoltStats(ftueBoard);
    assert.equal(ftueStats.chaoticCount, 0, `Depth ${d} must not spawn chaotic bolts during FTUE`);
    assert.equal(ftueStats.rainbowCount, 0, `Depth ${d} must not spawn rainbow bolts during FTUE`);
    assert.equal(ftueStats.unknownHiddenCount, 0, `Depth ${d} must not spawn unknown bolts during FTUE`);
  }

  // Verify Level 1..4 hand-authored FTUE curriculum structure (L1=6 bolts/1 layer, L2=9/1, L3=9/2 with blocking, L4=12/2 with dock)
  const ftueL1 = createEndlessBoard(0);
  assert.equal(ftueL1.screws.length, 6);
  assert.equal(ftueL1.screws.some((s) => isScrewBlocked(s, ftueL1.plates)), false);

  const ftueL2 = createEndlessBoard(1);
  assert.equal(ftueL2.screws.length, 9);

  const ftueL3 = createEndlessBoard(2);
  assert.equal(ftueL3.screws.length, 9);
  assert.equal(ftueL3.screws.some((s) => isScrewBlocked(s, ftueL3.plates)), true);

  const ftueL4 = createEndlessBoard(3);
  assert.equal(ftueL4.screws.length, 12);
  assert.equal(solveBoard(ftueL4).solved, true);

  // 1. Verify Level 10+ (depth 9+) features expanded colors (magenta, cyan, lime, copper) and special bolt variants
  let highBoard = createEndlessBoard(9);
  const stats = getSpecialBoltStats(highBoard);

  assert.equal(
    stats.distinctColorsOnBoard >= 5,
    true,
    `Higher level should feature >= 5 distinct colors, got ${stats.distinctColorsOnBoard}`
  );
  const hasNewHighColors = stats.colorList.some((c) =>
    ['magenta', 'cyan', 'lime', 'copper'].includes(c)
  );
  assert.equal(
    hasNewHighColors,
    true,
    `Higher level should include new colors (magenta/cyan/lime/copper), got ${stats.colorList.join(',')}`
  );
  assert.equal(stats.chaoticCount >= 1, true, 'Higher level must spawn chaotic bolts');
  assert.equal(stats.rainbowCount >= 1, true, 'Higher level must spawn rainbow bolts');
  assert.equal(
    stats.unknownHiddenCount >= 1,
    true,
    'Higher level must spawn unknown mystery bolts'
  );

  // 2. Verify Chaotic Bolts shift their chaosCycleColors on each move
  const chaoticBoltId = stats.chaoticIds[0];
  const initialCycle = [
    ...(highBoard.screws.find((s) => s.id === chaoticBoltId)?.chaosCycleColors ??
      []),
  ];
  assert.equal(initialCycle.length >= 3, true);

  const firstHint = findBestHintScrew(highBoard)!;
  const afterOneMove = unscrewAction(highBoard, firstHint, false);
  const updatedChaotic = afterOneMove.screws.find(
    (s) => s.id === chaoticBoltId && s.location === 'board'
  );
  if (updatedChaotic && updatedChaotic.chaosCycleColors) {
    assert.equal(updatedChaotic.chaosCycleColors[0], initialCycle[1]);
  }

  // 3. Verify Unknown '?' Bolt dynamically emerges as a Level 10+ game goes on
  let lvl10 = createEndlessBoard(9);
  for (let m = 0; m < 4; m++) {
    const nextId = findBestHintScrew(lvl10);
    if (!nextId) break;
    lvl10 = unscrewAction(lvl10, nextId, false);
  }
  const midStats = getSpecialBoltStats(lvl10);
  assert.equal(
    midStats.spawnedMidLevelCount >= 1 || midStats.unknownHiddenCount >= 1,
    true,
    'An unknown color bolt must emerge on Level 10+ as the level progresses'
  );

  // 4. Verify Rainbow Wildcard Bolt always matches an open active Target Collector Box while preserving 100% solvability
  const solvedHigh = solveBoard(highBoard);
  assert.equal(solvedHigh.solved, true);
});

test('Sound settings menu engine toggles between Industrial Factory, Cybernetic Tech, and Vintage Clockwork mechanical soundscape packs', () => {
  assert.deepEqual(SOUNDSCAPE_PACK_ORDER, [
    'industrial',
    'cybernetic',
    'clockwork',
  ]);
  assert.equal(SOUNDSCAPE_PACKS.industrial.name, 'Industrial Factory');
  assert.equal(SOUNDSCAPE_PACKS.cybernetic.name, 'Cybernetic Tech');
  assert.equal(SOUNDSCAPE_PACKS.clockwork.name, 'Vintage Clockwork');

  const eng = new SoundEngine();
  assert.equal(eng.getPack(), 'industrial');
  assert.equal(eng.getState().packName, 'Industrial Factory');
  assert.equal(eng.getState().shortCode, 'IND');

  // Toggle to Cybernetic Tech
  const cybState = eng.setPack('cybernetic', true);
  assert.equal(cybState.activePack, 'cybernetic');
  assert.equal(cybState.packName, 'Cybernetic Tech');
  assert.equal(cybState.shortCode, 'CYB');
  assert.equal(cybState.previewCount, 1);
  assert.equal(cybState.lastPlayedEvent, 'preview:cybernetic');

  // Trigger gameplay audio events under Cybernetic Tech
  eng.playUnscrew(true, 2);
  assert.equal(eng.getState().lastPlayedEvent, 'unscrew:cybernetic:match');
  eng.playPlateDrop();
  assert.equal(eng.getState().lastPlayedEvent, 'plate-drop:cybernetic');

  // Toggle to Vintage Clockwork
  const clkState = eng.setPack('clockwork', true);
  assert.equal(clkState.activePack, 'clockwork');
  assert.equal(clkState.packName, 'Vintage Clockwork');
  assert.equal(clkState.shortCode, 'CLK');
  assert.equal(clkState.previewCount, 2);
  assert.equal(clkState.lastPlayedEvent, 'preview:clockwork');

  eng.playBoxComplete();
  assert.equal(eng.getState().lastPlayedEvent, 'box-complete:clockwork');

  // Cycle pack wraps back to Industrial Factory
  const indState = eng.cyclePack(true);
  assert.equal(indState.activePack, 'industrial');
  assert.equal(indState.packName, 'Industrial Factory');

  // Volume cycling & mute toggling
  eng.setVolume(0.5);
  assert.equal(eng.getState().volumePercent, 50);
  const nextVolState = eng.cycleVolume(false);
  assert.equal(nextVolState.volumePercent, 75);

  const mutedNow = eng.toggleMute();
  assert.equal(mutedNow, true);
  assert.equal(eng.getState().muted, true);
});

test('38. Machine SFX triggers (buttons, tools, uiConfirm, material plates) track state safely in headless mode', () => {
  const eng = new SoundEngine();

  eng.playButtonClick(true);
  assert.equal(eng.getState().lastPlayedEvent, 'button-down:industrial');
  eng.playButtonClick(false);
  assert.equal(eng.getState().lastPlayedEvent, 'button-up:industrial');

  eng.playToolActivate('slot_expand');
  assert.equal(eng.getState().lastPlayedEvent, 'tool-slot_expand:industrial');
  eng.playToolActivate('peek_open');
  assert.equal(eng.getState().lastPlayedEvent, 'tool-peek_open:industrial');
  eng.playToolActivate('hammer_arm');
  assert.equal(eng.getState().lastPlayedEvent, 'tool-hammer_arm:industrial');
  eng.playToolActivate('auto_play');
  assert.equal(eng.getState().lastPlayedEvent, 'tool-auto_play:industrial');

  eng.playUiConfirm();
  assert.equal(eng.getState().lastPlayedEvent, 'ui-confirm:industrial');

  eng.setPack('cybernetic', false);
  eng.playPlateDrop('acrylic-cyan');
  assert.equal(eng.getState().lastPlayedEvent, 'plate-drop:cybernetic');
  eng.playBlocked();
  assert.equal(eng.getState().lastPlayedEvent, 'blocked:cybernetic');

  eng.setPack('clockwork', false);
  eng.playHammerStrike();
  assert.equal(eng.getState().lastPlayedEvent, 'hammer:clockwork');
  eng.playVictory();
  assert.equal(eng.getState().lastPlayedEvent, 'victory:clockwork');
  eng.playDefeat();
  assert.equal(eng.getState().lastPlayedEvent, 'defeat:clockwork');

  // Acoustic material mapping checks
  assert.equal(plateMaterialToAcoustic('acrylic-cyan'), 'acrylic');
  assert.equal(plateMaterialToAcoustic('brushed-brass'), 'brass');
  assert.equal(plateMaterialToAcoustic('blued-steel'), 'steel');
  assert.equal(plateMaterialToAcoustic('anodized-slate'), 'titanium');

  // Organic jitter stays within requested variance band
  for (let i = 0; i < 20; i++) {
    const val = organicJitter(0.03);
    assert.ok(val >= 0.97 && val <= 1.03);
  }

  // Muted calls remain safe no-ops without throwing
  eng.setMuted(true);
  eng.playButtonClick(true);
  eng.playToolActivate('cam');
  eng.playUiConfirm();
  eng.playPlateDrop('brushed-brass');
});

test('Responsive 3D viewport layout prevents overlap between Puzzle Board, Hint Plinth, Power-Up Deck, Spare Dock, and Auto-Play Reactor across all screen aspect ratios', () => {
  const aspects = [
    9 / 19.5, // Tall portrait phone
    9 / 16,   // Standard portrait phone
    4 / 3,    // Tablet landscape
    16 / 9,   // Standard landscape phone / desktop
    19.5 / 9, // Modern Android/iOS landscape phone
    20 / 9,   // Tall Android landscape phone
    21 / 9,   // Ultrawide landscape phone
  ];

  for (const aspect of aspects) {
    const ly = computeViewportLayout(aspect);

    // Project a Z=0.72 highest-layer plate point onto the Z=0.10 HUD plane from camera (0, camY, zoomZ)
    const projectToHudY = (worldY: number, z: number) =>
      ly.camY + ((worldY - ly.camY) * (ly.zoomZ - 0.1)) / (ly.zoomZ - z);
    const projectToHudX = (worldX: number, z: number) =>
      (worldX * (ly.zoomZ - 0.1)) / (ly.zoomZ - z);

    const botDeckTop = ly.botDeckY + 0.43 * ly.deckBtnScale;
    const hintHalfH = 0.28 * ly.hintScale;
    const hintBot = projectToHudY(ly.hintY - hintHalfH, 0.14);
    const hintTop = projectToHudY(ly.hintY + hintHalfH, 0.14);

    // 1. Hint Plinth must sit strictly ABOVE the Bottom Power-Up Deck with zero overlap
    assert.ok(
      hintBot > botDeckTop + 0.05,
      `aspect=${aspect.toFixed(2)}: Hint bottom (${hintBot.toFixed(3)}) overlaps Power-Up Deck top (${botDeckTop.toFixed(3)})`
    );

    // 2. Bottom-most Layer 4 puzzle plate edge must sit strictly ABOVE the Hint Plinth
    const boardWorldBot =
      ly.boardOffsetY - 1.56 * ly.boardSpreadY - 0.44 * ly.boltBaseScale;
    const boardProjBot = projectToHudY(boardWorldBot, 0.72);
    assert.ok(
      boardProjBot > hintTop + 0.08,
      `aspect=${aspect.toFixed(2)}: Board bottom (${boardProjBot.toFixed(3)}) overlaps Hint top (${hintTop.toFixed(3)})`
    );

    // 3. Top-most Layer 4 puzzle plate edge must sit strictly BELOW the Spare Dock Rail
    const dockBot = ly.dockY - 0.39 * ly.dockScaleY;
    const boardWorldTop =
      ly.boardOffsetY + 1.56 * ly.boardSpreadY + 0.44 * ly.boltBaseScale;
    const boardProjTop = projectToHudY(boardWorldTop, 0.72);
    assert.ok(
      boardProjTop < dockBot - 0.08,
      `aspect=${aspect.toFixed(2)}: Board top (${boardProjTop.toFixed(3)}) overlaps Spare Dock bottom (${dockBot.toFixed(3)})`
    );

    // 4. In Landscape, Right-most Layer 4 plate edge must clear the Auto-Play Reactor
    if (!ly.isPortrait) {
      const reactorLeft = ly.reactorX - 0.59 * ly.reactorScale;
      const boardWorldRight = 2.85 * ly.boardSpreadX + 0.44 * ly.boltBaseScale;
      const boardProjRight = projectToHudX(boardWorldRight, 0.72);
      assert.ok(
        boardProjRight < reactorLeft - 0.1,
        `aspect=${aspect.toFixed(2)}: Board right (${boardProjRight.toFixed(3)}) overlaps Reactor left (${reactorLeft.toFixed(3)})`
      );
    }
  }
});

test('Auto-Play solves levels 0..19 AND nearly-jammed mid-level boards (4/5 dock full) with 100% perfection and zero defeats', () => {
  // 1. Fresh full-level Auto-Play across 20 consecutive depths (including Level 10+ chaotic/rainbow/unknown bolts)
  for (let depth = 0; depth < 20; depth++) {
    let board = createEndlessBoard(depth);
    const startHammers = board.hammersRemaining;
    const startMaxDock = board.maxDockSlots;
    let steps = 0;
    while (board.outcome === 'ongoing' && steps < 40) {
      const nextId = pickNextAutoPlayScrewId(board);
      assert.ok(nextId, `Depth ${depth} step ${steps}: Auto-Play must always pick a next bolt`);
      board = unscrewAction(board, nextId, false, true);
      assert.notEqual(board.outcome, 'defeat', `Depth ${depth}: Auto-Play must never trigger defeat`);
      steps++;
    }
    assert.equal(board.outcome, 'victory', `Depth ${depth}: Auto-Play must solve cleanly to victory`);
    assert.equal(board.hammersRemaining, startHammers, `Depth ${depth}: Auto-Play must never consume hammers`);
    assert.equal(board.maxDockSlots, startMaxDock, `Depth ${depth}: Auto-Play must never inflate maxDockSlots`);
  }

  // 2. Nearly-jammed mid-level rescue: player makes 4 bad non-matching moves (4/5 dock full) AND arms Hammer Mode, then triggers Auto-Play
  for (const depth of [5, 8, 9, 12, 15]) {
    let board = createEndlessBoard(depth);
    let badMoves = 0;
    let guard = 0;
    while (board.outcome === 'ongoing' && badMoves < 4 && guard < 20) {
      const activeCols = new Set(
        board.activeBoxes.filter((b) => !b.completed).map((b) => b.color)
      );
      const nonMatch = board.screws.find(
        (s) =>
          s.location === 'board' &&
          !activeCols.has(s.color) &&
          unscrewAction(board, s.id).movesCount > board.movesCount
      );
      if (!nonMatch) break;
      const attempt = unscrewAction(board, nonMatch.id);
      if (attempt.outcome === 'defeat') break;
      board = attempt;
      badMoves = board.dockScrewIds.filter(Boolean).length;
      guard++;
    }

    // Even if Hammer Mode was armed right before activating Auto-Play, Auto-Play must not consume a hammer
    board = toggleHammerMode(board);
    const hammersBefore = board.hammersRemaining;
    const maxDockBefore = board.maxDockSlots;

    let steps = 0;
    while (board.outcome === 'ongoing' && steps < 40) {
      const nextId = pickNextAutoPlayScrewId(board);
      assert.ok(nextId, `Mid-level jammed depth ${depth}: Auto-Play must always find next bolt`);
      board = unscrewAction(board, nextId, false, true);
      assert.notEqual(board.outcome, 'defeat', `Mid-level jammed depth ${depth}: Auto-Play must never lose`);
      steps++;
    }
    assert.equal(board.outcome, 'victory', `Mid-level jammed depth ${depth}: Auto-Play must rescue and win cleanly`);
    assert.equal(board.hammersRemaining, hammersBefore, `Mid-level jammed depth ${depth}: Auto-Play must preserve hammers`);
    assert.equal(board.maxDockSlots, maxDockBefore, `Mid-level jammed depth ${depth}: Auto-Play must preserve maxDockSlots`);
  }
});


