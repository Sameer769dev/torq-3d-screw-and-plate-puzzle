import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDefaultSaveState,
  resolveCloudConflict,
  TorqSaveBlob,
} from './cloudSave';

test('Cloud Save: createDefaultSaveState establishes clean baseline', () => {
  const save = createDefaultSaveState();
  assert.equal(save.version, 1);
  assert.equal(save.levelIndex, 0);
  assert.equal(save.hammersRemaining, 3);
  assert.equal(save.extraSlotsRemaining, 1);
  assert.equal(save.maxDockSlots, 5);
});

test('Google Play Games Level Up: Smart Merge resolves conflict by preserving highest level and best boosters', () => {
  const cloudSave: TorqSaveBlob = {
    version: 1,
    updatedAtMs: 1000,
    levelIndex: 4,
    highestLevelIndex: 4,
    cumulativeScore: 12000,
    bestScore: 12000,
    hammersRemaining: 3,
    extraSlotsRemaining: 0,
    maxDockSlots: 6,
    autoPlayChargeBolts: 5,
    dayStreak: {
      currentStreak: 2,
      lastPlayedDateStr: '2026-11-06',
      totalDaysPlayed: 2,
    },
    sound: {
      packId: 'industrial',
      muted: false,
      volume: 0.8,
    },
  };

  const localSave: TorqSaveBlob = {
    version: 1,
    updatedAtMs: 2000,
    levelIndex: 2,
    highestLevelIndex: 2,
    cumulativeScore: 6000,
    bestScore: 6000,
    hammersRemaining: 1,
    extraSlotsRemaining: 1,
    maxDockSlots: 5,
    autoPlayChargeBolts: 2,
    dayStreak: {
      currentStreak: 3,
      lastPlayedDateStr: '2026-11-08',
      totalDaysPlayed: 3,
    },
    sound: {
      packId: 'clockwork',
      muted: false,
      volume: 0.9,
    },
  };

  const merged = resolveCloudConflict(cloudSave, localSave, 'smart_merge');

  // Must select the higher level reached (Level 4 from cloud)
  assert.equal(merged.levelIndex, 4);
  assert.equal(merged.highestLevelIndex, 4);

  // Must preserve the best score
  assert.equal(merged.bestScore, 12000);
  assert.equal(merged.cumulativeScore, 12000);

  // Must preserve best of powerup boosters (3 hammers from cloud, 1 extra slot from local)
  assert.equal(merged.hammersRemaining, 3);
  assert.equal(merged.extraSlotsRemaining, 1);
  assert.equal(merged.maxDockSlots, 6);
  assert.equal(merged.autoPlayChargeBolts, 5);

  // Must select latest streak date
  assert.equal(merged.dayStreak.currentStreak, 3);
  assert.equal(merged.dayStreak.lastPlayedDateStr, '2026-11-08');
});

test('Google Play Games Level Up: Explicit Keep Cloud and Keep Local policies function accurately', () => {
  const cloudSave = createDefaultSaveState();
  cloudSave.levelIndex = 5;
  cloudSave.bestScore = 20000;

  const localSave = createDefaultSaveState();
  localSave.levelIndex = 1;
  localSave.bestScore = 3000;

  const keepCloud = resolveCloudConflict(cloudSave, localSave, 'keep_cloud');
  assert.equal(keepCloud.levelIndex, 5);
  assert.equal(keepCloud.bestScore, 20000);

  const keepLocal = resolveCloudConflict(cloudSave, localSave, 'keep_local');
  assert.equal(keepLocal.levelIndex, 1);
  assert.equal(keepLocal.bestScore, 3000);
});

test('Google Play Games Level Up: Fresh device install / reinstall automatically restores cloud progress with 0 user prompts', () => {
  const localFresh = createDefaultSaveState();
  const cloudProgress: TorqSaveBlob = {
    version: 1,
    updatedAtMs: Date.now(),
    levelIndex: 8,
    highestLevelIndex: 8,
    cumulativeScore: 42000,
    bestScore: 42000,
    hammersRemaining: 5,
    extraSlotsRemaining: 2,
    maxDockSlots: 7,
    autoPlayChargeBolts: 10,
    dayStreak: {
      currentStreak: 4,
      lastPlayedDateStr: '2026-11-12',
      totalDaysPlayed: 4,
    },
    sound: {
      packId: 'cybernetic',
      muted: false,
      volume: 0.9,
    },
  };

  const isLocalFresh =
    (localFresh.highestLevelIndex ?? 0) === 0 &&
    (localFresh.cumulativeScore ?? 0) === 0 &&
    (localFresh.bestScore ?? 0) === 0;

  assert.equal(isLocalFresh, true);

  // When fresh install, directly adopt cloud progress so players always resume from last progress state
  const restored: TorqSaveBlob = isLocalFresh ? cloudProgress : resolveCloudConflict(cloudProgress, localFresh, 'smart_merge');
  assert.equal(restored.levelIndex, 8);
  assert.equal(restored.bestScore, 42000);
  assert.equal(restored.maxDockSlots, 7);
  assert.equal(restored.sound.packId, 'cybernetic');
});

test('Google Play Games Level Up Option 2: Conflicting developed states trigger informed user choice', () => {
  const localSave: TorqSaveBlob = {
    ...createDefaultSaveState(),
    levelIndex: 3,
    highestLevelIndex: 3,
    bestScore: 8500,
    hammersRemaining: 1,
  };

  const cloudSave: TorqSaveBlob = {
    ...createDefaultSaveState(),
    levelIndex: 6,
    highestLevelIndex: 6,
    bestScore: 19000,
    hammersRemaining: 4,
  };

  let conflictTriggered = false;
  const detected = { cloud: null as TorqSaveBlob | null, local: null as TorqSaveBlob | null };

  const onConflict = (c: TorqSaveBlob, l: TorqSaveBlob) => {
    conflictTriggered = true;
    detected.cloud = c;
    detected.local = l;
  };

  const isLocalFresh =
    (localSave.highestLevelIndex ?? 0) === 0 &&
    (localSave.cumulativeScore ?? 0) === 0 &&
    (localSave.bestScore ?? 0) === 0;

  const cloudHighest = Math.max(cloudSave.highestLevelIndex ?? 0, cloudSave.levelIndex ?? 0);
  const localHighest = Math.max(localSave.highestLevelIndex ?? 0, localSave.levelIndex ?? 0);

  if (!isLocalFresh && cloudHighest > 0 && localHighest > 0 && (cloudSave.levelIndex !== localSave.levelIndex || cloudSave.bestScore !== localSave.bestScore)) {
    onConflict(cloudSave, localSave);
  }

  assert.equal(conflictTriggered, true);
  assert.equal(detected.cloud?.levelIndex, 6);
  assert.equal(detected.local?.levelIndex, 3);

  // Resolving via Smart Merge gives maximum level & hammers
  const resolved = resolveCloudConflict(detected.cloud!, detected.local!, 'smart_merge');
  assert.equal(resolved.levelIndex, 6);
  assert.equal(resolved.hammersRemaining, 4);
});

