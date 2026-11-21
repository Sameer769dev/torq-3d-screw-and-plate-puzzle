import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createEndlessBoard,
  findBestHintScrew,
  getDockSlotWorldX,
  MAX_POSSIBLE_DOCK_SLOTS,
  refillExtraSlotCount,
  refillHammerCount,
  reviveBoardState,
  unlockExtraDockSlot,
  unscrewAction,
} from './rules';
import { fuelAutoPlayToFull, createInitialAutoPlayState } from './autoPlay';
import { doubleDailyStreakBonus, DayStreakState } from './streak';
import { adsManager } from './ads';

test('Monetization: Extra Dock Slots expand from 5 up to 8 slots via rewarded ad unlocks', () => {
  let board = createEndlessBoard(0);
  assert.equal(board.maxDockSlots, 5);

  // 1st rewarded unlock: 5 -> 6
  board = unlockExtraDockSlot(board);
  assert.equal(board.maxDockSlots, 6);
  assert.equal(board.dockScrewIds.length, 6);

  // 2nd rewarded unlock: 6 -> 7
  board = unlockExtraDockSlot(board);
  assert.equal(board.maxDockSlots, 7);
  assert.equal(board.dockScrewIds.length, 7);

  // 3rd rewarded unlock: 7 -> 8 (MAX)
  board = unlockExtraDockSlot(board);
  assert.equal(board.maxDockSlots, 8);
  assert.equal(board.dockScrewIds.length, 8);
  assert.equal(board.extraSlotUsed, true);

  // Attempting beyond MAX_POSSIBLE_DOCK_SLOTS (8) remains capped
  const cappedBoard = unlockExtraDockSlot(board);
  assert.equal(cappedBoard.maxDockSlots, MAX_POSSIBLE_DOCK_SLOTS);
});

test('Booster Mechanics: Slot and Hammer display available count and switch to video ad when reaching zero', () => {
  let board = createEndlessBoard(0);
  assert.equal(board.extraSlotsRemaining, 1, 'Player starts with 1 available extra slot booster');
  assert.equal(board.hammersRemaining, 3, 'Player starts with 3 available hammer boosters');

  // Using the available extra slot charge directly expands the dock without ads
  board = unlockExtraDockSlot(board);
  assert.equal(board.maxDockSlots, 6, 'Dock expanded to 6 slots');
  assert.equal(board.extraSlotsRemaining, 0, 'Extra slot charge decremented to 0');

  // When count reaches zero, subsequent refills occur via rewarded video
  board = refillExtraSlotCount(board, 1);
  assert.equal(board.extraSlotsRemaining, 1, 'Refilled extra slot charge from rewarded video');
});

test('Monetization: Extra Slot rewarded ad expands dock capacity and unjams board', () => {
  const board = createEndlessBoard(0);
  const freeSlotsInitial = board.dockScrewIds.filter((d) => d === null).length;
  assert.equal(freeSlotsInitial, 5, 'Initially all 5 dock slots are free');

  // Fill all dock slots to simulate dock jam
  board.dockScrewIds = ['s1', 's2', 's3', 's4', 's5'];
  const freeSlotsFull = board.dockScrewIds.filter((d) => d === null).length;
  assert.equal(freeSlotsFull, 0, 'When dock is jammed/full, free slots reaches zero');

  // Expanding dock adds an extra slot
  const expanded = unlockExtraDockSlot(board);
  const freeSlotsAfterUnlock = expanded.dockScrewIds.filter((d) => d === null).length;
  assert.equal(freeSlotsAfterUnlock, 1, 'After unlock, an open slot becomes available');
});

test('Monetization: getDockSlotWorldX symmetrically centers dock slots across the rail', () => {
  // For 5 slots: center slot 2 should be at X = 0, symmetric around 0
  assert.equal(getDockSlotWorldX(2, 5), 0);
  assert.equal(getDockSlotWorldX(0, 5), -getDockSlotWorldX(4, 5));

  // For 8 slots: slot 0 and slot 7 should be symmetric
  const x0 = getDockSlotWorldX(0, 8);
  const x7 = getDockSlotWorldX(7, 8);
  assert.equal(Number((x0 + x7).toFixed(4)), 0);
  assert.ok(Math.abs(x0) < 3.0, 'Outermost slot must fit safely within the 6.1 unit dock rail');
});

test('Monetization: Revive (Second Chance) clears jammed bolts, preserves fallen plates, and stays 100% winnable', () => {
  let board = createEndlessBoard(5);
  // 1. Play real moves until at least 1 plate clears and falls off the board
  let moves = 0;
  while (
    board.outcome === 'ongoing' &&
    moves < 20 &&
    !board.plates.some((p) => p.status === 'cleared')
  ) {
    const nextId = findBestHintScrew(board);
    if (!nextId) break;
    board = unscrewAction(board, nextId);
    moves++;
  }
  const clearedBefore = board.plates
    .filter((p) => p.status === 'cleared')
    .map((p) => p.id);
  assert.ok(clearedBefore.length >= 1, 'At least one plate should have fallen before defeat');

  // 2. Deliberately extract non-matching bolts via unscrewAction until the spare dock jams into real 'defeat'
  let jamSteps = 0;
  while (board.outcome === 'ongoing' && jamSteps < 15) {
    const activeCols = new Set(
      board.activeBoxes.filter((b) => !b.completed).map((b) => b.color)
    );
    const badPick =
      board.screws.find(
        (s) => s.location === 'board' && !activeCols.has(s.color)
      ) ?? board.screws.find((s) => s.location === 'board');
    if (!badPick) break;
    board = unscrewAction(board, badPick.id, false, false);
    // If blocked, use autoPlayExtract=false? Pick an unblocked non-matching bolt!
    if (board.lastActionFeedback?.type === 'blocked') {
      const nextHint = findBestHintScrew(board);
      if (!nextHint) break;
      board = unscrewAction(board, nextHint, false, false);
    }
    jamSteps++;
  }
  if (board.outcome !== 'defeat') {
    // Fallback deterministic jam on a multi-color board
    let fresh = createEndlessBoard(7);
    let safetyJam = 0;
    while (fresh.outcome === 'ongoing' && safetyJam < 25) {
      const activeCols = new Set(
        fresh.activeBoxes.filter((b) => !b.completed).map((b) => b.color)
      );
      const unblockedNonMatch = fresh.screws.find(
        (s) =>
          s.location === 'board' &&
          !activeCols.has(s.color) &&
          unscrewAction(fresh, s.id).movesCount > fresh.movesCount
      );
      if (unblockedNonMatch) {
        fresh = unscrewAction(fresh, unblockedNonMatch.id);
      } else {
        const hint = findBestHintScrew(fresh);
        if (!hint) break;
        fresh = unscrewAction(fresh, hint);
      }
      safetyJam++;
    }
    board = fresh;
  }
  assert.equal(board.outcome, 'defeat', 'Board should reach dock-jammed defeat state');
  const clearedAtDefeat = board.plates
    .filter((p) => p.status === 'cleared')
    .map((p) => p.id);
  const occupiedBeforeRevive = board.dockScrewIds.filter(Boolean).length;

  const revived = reviveBoardState(board);
  assert.equal(revived.outcome, 'ongoing');
  assert.equal(revived.defeatReason, undefined);
  assert.equal(revived.revivesUsed, 1);
  // Previously fallen plates must remain strictly 'cleared'
  for (const pid of clearedAtDefeat) {
    assert.equal(
      revived.plates.find((p) => p.id === pid)?.status,
      'cleared',
      'Revive must keep previously fallen plates cleared'
    );
  }
  // Cleared 2 bolts from dock & added +1 emergency slot
  assert.equal(revived.maxDockSlots, 6);
  const occupiedAfter = revived.dockScrewIds.filter(Boolean).length;
  assert.equal(occupiedAfter, Math.max(0, occupiedBeforeRevive - 2));

  // Verify the revived board can still be solved cleanly to 'victory' (no softlock from vaporized bolts!)
  let cur = revived;
  let safety = 0;
  while (cur.outcome === 'ongoing' && safety < 50) {
    const nextId = findBestHintScrew(cur);
    if (!nextId) break;
    cur = unscrewAction(cur, nextId, false, true);
    safety++;
  }
  assert.equal(cur.outcome, 'victory', 'Revived board must remain 100% winnable with banked revive credits');
});

test('Monetization: Rewarded Hammer Refill forges additional hammers', () => {
  let board = createEndlessBoard(0);
  board.hammersRemaining = 0;

  board = refillHammerCount(board, 1);
  assert.equal(board.hammersRemaining, 1);

  board = refillHammerCount(board, 2);
  assert.equal(board.hammersRemaining, 3);
});

test('Monetization: Rewarded Auto-Play Fuel instantly tops off reactor to 100%', () => {
  let autoPlay = createInitialAutoPlayState(2);
  assert.equal(autoPlay.targetBolts, 45);
  assert.equal(autoPlay.isReady, false);

  autoPlay = fuelAutoPlayToFull(autoPlay);
  assert.equal(autoPlay.chargeBolts, 45);
  assert.equal(autoPlay.fillRatio, 1.0);
  assert.equal(autoPlay.percent, 100);
  assert.equal(autoPlay.isReady, true);
});

test('Monetization: Daily Streak Doubler doubles reward points and sets badge', () => {
  const dummyStreak: DayStreakState = {
    currentStreak: 4,
    bestStreak: 7,
    lastPlayedDate: '2026-11-07',
    totalDaysPlayed: 10,
    status: 'active_today',
    rewardTier: 'OVERDRIVE',
    rewardLabel: 'OVERDRIVE +500 PTS',
    rewardBonusPoints: 500,
    accentHex: '#E0A234',
    cycleDayIndex: 4,
    cycleNodes: [],
  };

  const doubled = doubleDailyStreakBonus(dummyStreak);
  assert.equal(doubled.rewardBonusPoints, 1000);
  assert.equal(doubled.isDoubled, true);
  assert.ok(doubled.rewardLabel.includes('2X BOOST'));
});

test('Monetization: AdsManager initializes and reports state, bottom banner is disabled', async () => {
  await adsManager.initialize();
  const state = adsManager.getState();
  assert.equal(state.initialized, true);

  // Bottom banner ad is disabled in favor of dual 3D native ads flanking workbench
  await adsManager.showBanner();
  assert.equal(adsManager.getState().bannerVisible, false);
});


