import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceFtueStep,
  applyCloudRestoreToFtue,
  createDefaultFtueState,
  getIdleThresholdForLevel,
  getNewToolUnlockAnnouncement,
  isControlUnlocked,
  recordFtueSessionStart,
  shouldOfferPgsPromptAfterWin,
  shouldStartInPlayingPhase,
} from './ftue';
import {
  CloudSaveManager,
  createDefaultSaveState,
  resolveCloudConflict,
} from './cloudSave';
import { analyticsManager } from './analytics';
import { adsManager } from './ads';
import { createBoardFromLevel } from './rules';

test('FTUE State Machine advances monotonically and sets completed metadata at FTUEComplete', () => {
  let state = createDefaultFtueState(1000);
  assert.equal(state.step, 'Fresh');
  assert.equal(state.completed, false);
  assert.equal(state.sessionCount, 1);

  state = advanceFtueStep(state, 'L1_Guided', 1500);
  assert.equal(state.step, 'L1_Guided');

  // Attempting to regress backwards must be a no-op
  const unchanged = advanceFtueStep(state, 'Fresh', 2000);
  assert.equal(unchanged.step, 'L1_Guided');

  state = advanceFtueStep(state, 'FTUEComplete', 5000);
  assert.equal(state.step, 'FTUEComplete');
  assert.equal(state.completed, true);
  assert.equal(state.completedAt, 5000);
  assert.equal(state.skipped, false);
});

test('FTUE Progressive Control Gating matches Level 1..10 curriculum and Session 1/2 deferral', () => {
  const s1 = createDefaultFtueState(1000);

  // Level 1 (index 0, Session 1): Only pause unlocked
  assert.equal(isControlUnlocked('pause', 0, s1), true);
  assert.equal(isControlUnlocked('slot', 0, s1), false);
  assert.equal(isControlUnlocked('hammer', 0, s1), false);
  assert.equal(isControlUnlocked('peek', 0, s1), false);
  assert.equal(isControlUnlocked('autoPlay', 0, s1), false);
  assert.equal(isControlUnlocked('cam', 0, s1), false);
  assert.equal(isControlUnlocked('soundPack', 0, s1), false);
  assert.equal(isControlUnlocked('mute', 0, s1), false);
  assert.equal(isControlUnlocked('streakCard', 0, s1), false);
  assert.equal(isControlUnlocked('nativeAds', 0, s1), false);
  assert.equal(isControlUnlocked('interstitial', 0, s1), false);

  // Level 4 (index 3) after L3 win & SignInOffered handled -> nativeAds unlocked, boosters still gated
  const dockStep = advanceFtueStep(s1, 'DockLearned', 2000);
  assert.equal(isControlUnlocked('nativeAds', 3, dockStep), true);
  assert.equal(
    isControlUnlocked('nativeAds', 3, advanceFtueStep(s1, 'SignInOffered', 2000)),
    false,
    'Native ads must stay hidden while post-L3 sign-in prompt is active'
  );
  assert.equal(
    isControlUnlocked('nativeAds', 3, dockStep, { activeModalOpen: true }),
    false,
    'Native ads must hide behind active modals'
  );
  assert.equal(isControlUnlocked('slot', 3, dockStep), false);

  // Level 5 (index 4) -> +1 Slot unlocks
  assert.equal(isControlUnlocked('slot', 4, dockStep), true);
  assert.equal(isControlUnlocked('hammer', 4, dockStep), false);
  assert.equal(getNewToolUnlockAnnouncement(4, dockStep)?.key, 'slot');

  // Level 7 (index 6) -> Hammer unlocks
  assert.equal(isControlUnlocked('hammer', 6, dockStep), true);
  assert.equal(isControlUnlocked('peek', 6, dockStep), false);
  assert.equal(getNewToolUnlockAnnouncement(6, dockStep)?.key, 'hammer');

  // Level 8 (index 7) -> Peek unlocks
  assert.equal(isControlUnlocked('peek', 7, dockStep), true);
  assert.equal(isControlUnlocked('autoPlay', 7, dockStep), false);
  assert.equal(getNewToolUnlockAnnouncement(7, dockStep)?.key, 'peek');

  // Level 9 (index 8) -> Auto-Play unlocks
  assert.equal(isControlUnlocked('autoPlay', 8, dockStep), true);
  assert.equal(isControlUnlocked('cam', 8, dockStep), false);
  assert.equal(getNewToolUnlockAnnouncement(8, dockStep)?.key, 'autoPlay');

  // Level 10 (index 9) -> Cam, Sound Pack, Mute unlock; Session 1 still blocks interstitials & streak card!
  const doneS1 = advanceFtueStep(dockStep, 'FTUEComplete', 3000);
  assert.equal(isControlUnlocked('cam', 9, doneS1), true);
  assert.equal(isControlUnlocked('soundPack', 9, doneS1), true);
  assert.equal(isControlUnlocked('mute', 9, doneS1), true);
  assert.equal(isControlUnlocked('streakCard', 9, doneS1), false);
  assert.equal(isControlUnlocked('interstitial', 9, doneS1), false);

  // Session 2 after FTUE Complete -> Daily Streak Card AND Interstitials unlock
  const s2 = recordFtueSessionStart(doneS1, true, 90000);
  assert.equal(s2.sessionCount, 2);
  assert.equal(isControlUnlocked('streakCard', 9, s2), true);
  assert.equal(isControlUnlocked('interstitial', 9, s2), true);
});

test('FTUE Skips automatically when restoring a Cloud Save with highestLevelIndex >= 10', () => {
  const localFresh = createDefaultSaveState();
  const cloudVeteran = createDefaultSaveState();
  cloudVeteran.levelIndex = 12;
  cloudVeteran.highestLevelIndex = 12;
  cloudVeteran.ftue = createDefaultFtueState(500);

  const restoredFtue = applyCloudRestoreToFtue(cloudVeteran.ftue, 12, 9999);
  assert.equal(restoredFtue.step, 'FTUEComplete');
  assert.equal(restoredFtue.completed, true);
  assert.equal(restoredFtue.skipped, true);

  const merged = resolveCloudConflict(cloudVeteran, localFresh, 'smart_merge');
  assert.equal(merged.highestLevelIndex, 12);
  assert.equal(merged.ftue?.completed, true);
  assert.equal(merged.ftue?.skipped, true);
});

test('FTUE Launch Policy: Fresh players land directly on Level 1 with 0s idle hand; cloud save is automatic with 0 user prompts', () => {
  const fresh = createDefaultFtueState(1000);
  assert.equal(shouldStartInPlayingPhase(fresh, 0), true);
  assert.equal(getIdleThresholdForLevel(0, fresh, 0), 0);
  assert.equal(getIdleThresholdForLevel(1, fresh, 0), 1.8);

  // Play Games cloud save is 100% automatic: never nag or prompt the player
  assert.equal(shouldOfferPgsPromptAfterWin(0, fresh, false), false);
  assert.equal(shouldOfferPgsPromptAfterWin(1, fresh, false), false);
  assert.equal(shouldOfferPgsPromptAfterWin(2, fresh, false), false);
  assert.equal(shouldOfferPgsPromptAfterWin(2, fresh, true), false);
});

test('CloudSaveManager.recordProgress preserves 0 score on fresh board without +50 inflation bug', () => {
  const manager = new CloudSaveManager();
  const board = createBoardFromLevel(0);
  board.score = 0;

  for (let i = 0; i < 5; i++) {
    manager.recordProgress(board);
  }
  assert.equal(manager.getState().cumulativeScore, 0);
  assert.equal(manager.getState().bestScore, 0);

  board.score = 150;
  manager.recordProgress(board);
  manager.recordProgress(board);
  assert.equal(manager.getState().cumulativeScore, 150);
  assert.equal(manager.getState().bestScore, 150);
});

test('AnalyticsManager buffers typed FTUE funnel events and updates A/B flags', () => {
  analyticsManager.clearBufferedEvents();
  analyticsManager.resetLaunchClock(1000);

  analyticsManager.logEvent('ftue_launch', {
    first_session: true,
    session_count: 1,
    ab_bucket: analyticsManager.getFlags().abBucket,
  });
  assert.equal(analyticsManager.logFirstTapIfNeeded(0), true);
  assert.equal(analyticsManager.logFirstTapIfNeeded(0), false); // Idempotent per launch
  analyticsManager.logEvent('ftue_step', { step: 'CoreLearned', level_index: 1, elapsed_ms: 4200 });

  const events = analyticsManager.getBufferedEvents();
  assert.equal(events.length, 3);
  assert.deepEqual(
    events.map((e) => e.name),
    ['ftue_launch', 'ftue_first_tap', 'ftue_step']
  );

  const updatedFlags = analyticsManager.setFlags({ t3IdleHandDelayMs: 1500 });
  assert.equal(updatedFlags.t3IdleHandDelayMs, 1500);
  analyticsManager.setFlags({ t3IdleHandDelayMs: 0 });
  analyticsManager.clearBufferedEvents();
});

test('AdsManager.showLevelCompleteInterstitial respects FTUE completion, Session 2, and Level 10+ gating', async () => {
  analyticsManager.clearBufferedEvents();

  assert.equal(
    await adsManager.showLevelCompleteInterstitial(12),
    false,
    'Interstitial must be blocked when FTUE context is missing'
  );
  assert.equal(
    await adsManager.showLevelCompleteInterstitial(12, { completed: false, sessionCount: 2 }),
    false,
    'Interstitial must be blocked while FTUE is incomplete'
  );
  assert.equal(
    await adsManager.showLevelCompleteInterstitial(12, { completed: true, sessionCount: 1 }),
    false,
    'Interstitial must be blocked throughout Session 1 even if Level 10+ reached'
  );
  assert.equal(
    await adsManager.showLevelCompleteInterstitial(8, { completed: true, sessionCount: 2 }),
    false,
    'Interstitial must be blocked before Level 10 (levelIndex < 9)'
  );

  const beforeShown = adsManager.getState().totalInterstitialsShown;
  assert.equal(
    await adsManager.showLevelCompleteInterstitial(9, { completed: true, sessionCount: 2 }),
    true,
    'Interstitial is allowed once FTUE is completed, sessionCount >= 2, and levelIndex >= 9'
  );
  assert.equal(adsManager.getState().totalInterstitialsShown, beforeShown + 1);
  assert.equal(
    await adsManager.showLevelCompleteInterstitial(10, { completed: true, sessionCount: 2 }),
    false,
    'Interstitial cooldown blocks immediate back-to-back impressions'
  );

  analyticsManager.clearBufferedEvents();
});
