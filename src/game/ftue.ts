export type FtueStep =
  | 'Fresh'
  | 'L1_Guided'
  | 'CoreLearned'
  | 'LayersLearned'
  | 'SignInOffered'
  | 'DockLearned'
  | 'SlotTaught'
  | 'HammerTaught'
  | 'PeekTaught'
  | 'AutoPlayTaught'
  | 'FTUEComplete';

export type FtueControlKey =
  | 'pause'
  | 'slot'
  | 'hammer'
  | 'peek'
  | 'autoPlay'
  | 'cam'
  | 'soundPack'
  | 'mute'
  | 'streakCard'
  | 'nativeAds'
  | 'interstitial';

export interface FtueState {
  step: FtueStep;
  completed: boolean;
  completedAt: number | null;
  skipped: boolean;
  sessionCount: number;
  sessionsStartedAt: number[];
  pgsPromptShown: boolean;
  pgsPromptChoice: 'save' | 'later' | null;
  unlockedToolsSeen: Partial<Record<FtueControlKey, boolean>>;
  firstUseRecorded: Partial<Record<FtueControlKey, boolean>>;
}

export interface NewToolAnnouncement {
  key: FtueControlKey;
  title: string;
  subtitle: string;
  badge: string;
}

export const FTUE_STEP_ORDER: readonly FtueStep[] = [
  'Fresh',
  'L1_Guided',
  'CoreLearned',
  'LayersLearned',
  'SignInOffered',
  'DockLearned',
  'SlotTaught',
  'HammerTaught',
  'PeekTaught',
  'AutoPlayTaught',
  'FTUEComplete',
];

export const FTUE_COMPLETE_LEVEL_COUNT = 10; // Level 10+ (levelIndex >= 9) unlocks full toolkit

export function createDefaultFtueState(now = Date.now()): FtueState {
  return {
    step: 'Fresh',
    completed: false,
    completedAt: null,
    skipped: false,
    sessionCount: 1,
    sessionsStartedAt: [now],
    pgsPromptShown: false,
    pgsPromptChoice: null,
    unlockedToolsSeen: {},
    firstUseRecorded: {},
  };
}

export function getFtueStepIndex(step: FtueStep): number {
  const idx = FTUE_STEP_ORDER.indexOf(step);
  return idx >= 0 ? idx : 0;
}

export function getMinStepForLevel(levelIndex: number): FtueStep {
  const safe = Math.max(0, Math.floor(levelIndex));
  if (safe >= 9) return 'FTUEComplete';
  if (safe === 8) return 'AutoPlayTaught';
  if (safe === 7) return 'PeekTaught';
  if (safe === 6) return 'HammerTaught';
  if (safe >= 4) return 'SlotTaught';
  if (safe === 3) return 'DockLearned';
  if (safe === 2) return 'LayersLearned';
  if (safe === 1) return 'CoreLearned';
  return 'Fresh';
}

export function normalizeFtueState(
  raw?: Partial<FtueState> | null,
  now = Date.now()
): FtueState {
  const base = createDefaultFtueState(now);
  if (!raw || typeof raw !== 'object') {
    return base;
  }

  const step: FtueStep =
    raw.step && FTUE_STEP_ORDER.includes(raw.step) ? raw.step : base.step;
  const completed = Boolean(raw.completed) || step === 'FTUEComplete';
  const sessionCount =
    typeof raw.sessionCount === 'number' && Number.isFinite(raw.sessionCount)
      ? Math.max(1, Math.floor(raw.sessionCount))
      : 1;
  const sessionsStartedAt =
    Array.isArray(raw.sessionsStartedAt) && raw.sessionsStartedAt.length > 0
      ? raw.sessionsStartedAt.filter((n) => typeof n === 'number' && Number.isFinite(n)).slice(-20)
      : [now];

  return {
    step: completed ? 'FTUEComplete' : step,
    completed,
    completedAt:
      typeof raw.completedAt === 'number'
        ? raw.completedAt
        : completed
          ? now
          : null,
    skipped: Boolean(raw.skipped),
    sessionCount,
    sessionsStartedAt,
    pgsPromptShown: Boolean(raw.pgsPromptShown),
    pgsPromptChoice:
      raw.pgsPromptChoice === 'save' || raw.pgsPromptChoice === 'later'
        ? raw.pgsPromptChoice
        : null,
    unlockedToolsSeen:
      raw.unlockedToolsSeen && typeof raw.unlockedToolsSeen === 'object'
        ? { ...raw.unlockedToolsSeen }
        : {},
    firstUseRecorded:
      raw.firstUseRecorded && typeof raw.firstUseRecorded === 'object'
        ? { ...raw.firstUseRecorded }
        : {},
  };
}

export function advanceFtueStep(
  ftue: FtueState,
  targetStep: FtueStep,
  now = Date.now()
): FtueState {
  const curIdx = getFtueStepIndex(ftue.step);
  const nextIdx = getFtueStepIndex(targetStep);
  if (nextIdx <= curIdx && (targetStep !== 'FTUEComplete' || ftue.completed)) {
    return ftue;
  }
  const completed = targetStep === 'FTUEComplete' || ftue.completed;
  return {
    ...ftue,
    step: targetStep,
    completed,
    completedAt: completed ? (ftue.completedAt ?? now) : ftue.completedAt,
  };
}

/**
 * Skips FTUE automatically when restoring a veteran cloud save (highestLevelIndex >= 10),
 * or fast-forwards step cursor to match highest reached level without regating unlocked tools.
 */
export function applyCloudRestoreToFtue(
  ftue: FtueState,
  highestLevelIndex: number,
  now = Date.now()
): FtueState {
  const safeHighest = Math.max(0, Math.floor(highestLevelIndex));
  if (safeHighest >= 10) {
    if (ftue.completed && ftue.step === 'FTUEComplete') {
      return ftue;
    }
    return {
      ...ftue,
      step: 'FTUEComplete',
      completed: true,
      completedAt: ftue.completedAt ?? now,
      skipped: !ftue.completed ? true : ftue.skipped,
      pgsPromptShown: true,
    };
  }

  const minStep = getMinStepForLevel(safeHighest);
  return advanceFtueStep(ftue, minStep, now);
}

export function mergeFtueStates(
  cloudRaw: Partial<FtueState> | undefined,
  localRaw: Partial<FtueState> | undefined,
  maxLevel: number,
  now = Date.now()
): FtueState {
  const cloud = normalizeFtueState(cloudRaw, now);
  const local = normalizeFtueState(localRaw, now);

  const cloudIdx = getFtueStepIndex(cloud.step);
  const localIdx = getFtueStepIndex(local.step);
  const higherStep = cloudIdx >= localIdx ? cloud.step : local.step;
  const completed = cloud.completed || local.completed || higherStep === 'FTUEComplete';

  const mergedSessions = Array.from(
    new Set([...cloud.sessionsStartedAt, ...local.sessionsStartedAt])
  )
    .sort((a, b) => a - b)
    .slice(-20);

  const merged: FtueState = {
    step: completed ? 'FTUEComplete' : higherStep,
    completed,
    completedAt:
      cloud.completedAt && local.completedAt
        ? Math.min(cloud.completedAt, local.completedAt)
        : (cloud.completedAt ?? local.completedAt ?? (completed ? now : null)),
    skipped: cloud.skipped || local.skipped,
    sessionCount: Math.max(cloud.sessionCount, local.sessionCount, 1),
    sessionsStartedAt: mergedSessions.length > 0 ? mergedSessions : [now],
    pgsPromptShown: cloud.pgsPromptShown || local.pgsPromptShown,
    pgsPromptChoice: cloud.pgsPromptChoice ?? local.pgsPromptChoice,
    unlockedToolsSeen: { ...cloud.unlockedToolsSeen, ...local.unlockedToolsSeen },
    firstUseRecorded: { ...cloud.firstUseRecorded, ...local.firstUseRecorded },
  };

  return applyCloudRestoreToFtue(merged, maxLevel, now);
}

export function recordFtueSessionStart(
  ftue: FtueState,
  isExistingInstall: boolean,
  now = Date.now()
): FtueState {
  const normalized = normalizeFtueState(ftue, now);
  if (!isExistingInstall) {
    return normalized;
  }
  const sessions = [...normalized.sessionsStartedAt, now].slice(-20);
  return {
    ...normalized,
    sessionCount: Math.max(2, normalized.sessionCount + 1),
    sessionsStartedAt: sessions,
  };
}

export function isControlUnlocked(
  control: FtueControlKey,
  highestLevelIndex: number,
  ftue: FtueState,
  options?: {
    totalDaysPlayed?: number;
    activeModalOpen?: boolean;
    nativeAdsMinLevelIndex?: number;
  }
): boolean {
  const level = Math.max(0, Math.floor(highestLevelIndex));
  const totalDays = options?.totalDaysPlayed ?? 1;
  const modalOpen = Boolean(options?.activeModalOpen);
  const nativeAdsMin = options?.nativeAdsMinLevelIndex ?? 3;

  switch (control) {
    case 'pause':
      return true;
    case 'slot':
      return ftue.completed || level >= 4; // L5+
    case 'hammer':
      return ftue.completed || level >= 6; // L7+
    case 'peek':
      return ftue.completed || level >= 7; // L8+
    case 'autoPlay':
      return ftue.completed || level >= 8; // L9+
    case 'cam':
    case 'soundPack':
    case 'mute':
      return ftue.completed || level >= 9; // L10 / FTUE Complete
    case 'streakCard':
      // Defer streak meta clutter out of Session 1 / Day 0
      return ftue.sessionCount >= 2 || totalDays >= 2;
    case 'nativeAds':
      // Hidden during L1-L3 and while SignInOffered / active prompt modal is up
      if (modalOpen || ftue.step === 'SignInOffered') return false;
      return ftue.completed || level >= nativeAdsMin;
    case 'interstitial':
      // Zero interstitials during Session 1 or before FTUE complete
      return ftue.completed && ftue.sessionCount >= 2 && level >= 9;
    default:
      return true;
  }
}

export function shouldStartInPlayingPhase(
  ftue: FtueState,
  highestLevelIndex: number
): boolean {
  // Fresh installs & in-progress FTUE players launch straight onto the active puzzle board
  if (!ftue.completed || highestLevelIndex < 10) {
    return true;
  }
  return false;
}

export function shouldOfferPgsPromptAfterWin(
  completedLevelIndex: number,
  ftue: FtueState,
  isCloudConnected: boolean,
  promptLevelIndex = 2
): boolean {
  // Cloud save is 100% automatic in TORQ per Google Play Games guidelines; never interrupt or nag users
  return false;
}

export function getIdleThresholdForLevel(
  levelIndex: number,
  ftue: FtueState,
  l1DelayMs = 0
): number {
  if (!ftue.completed && levelIndex === 0) {
    return Math.max(0, l1DelayMs / 1000);
  }
  if (!ftue.completed && levelIndex <= 2) {
    return 1.8;
  }
  return 3.2;
}

export function getNewToolUnlockAnnouncement(
  levelIndex: number,
  ftue: FtueState
): NewToolAnnouncement | null {
  if (ftue.completed) return null;

  if (levelIndex === 4 && !ftue.unlockedToolsSeen.slot) {
    return {
      key: 'slot',
      title: 'NEW TOOL: +1 SLOT',
      subtitle: 'Add an extra Spare Dock socket whenever needed.',
      badge: '+1',
    };
  }
  if (levelIndex === 6 && !ftue.unlockedToolsSeen.hammer) {
    return {
      key: 'hammer',
      title: 'NEW TOOL: HAMMER',
      subtitle: 'Smash through and remove any blocked bolt!',
      badge: 'HAM',
    };
  }
  if (levelIndex === 7 && !ftue.unlockedToolsSeen.peek) {
    return {
      key: 'peek',
      title: 'NEW TOOL: PEEK',
      subtitle: 'Lift plates briefly to inspect bolts hiding underneath.',
      badge: 'PEEK',
    };
  }
  if (levelIndex === 8 && !ftue.unlockedToolsSeen.autoPlay) {
    return {
      key: 'autoPlay',
      title: 'NEW TOOL: AUTO-PLAY',
      subtitle: 'Fill the reactor meter to auto-solve tough sequences.',
      badge: 'AUTO',
    };
  }
  if (levelIndex === 9 && !ftue.unlockedToolsSeen.cam) {
    return {
      key: 'cam',
      title: 'FULL WORKBENCH UNLOCKED',
      subtitle: '3D Camera, Sound Packs & Special Bolts ready!',
      badge: 'PRO',
    };
  }
  return null;
}

export function getFtueHintForLevel(
  levelIndex: number,
  ftue: FtueState,
  lastBlockedAttempt = false
): string | null {
  if (ftue.completed && levelIndex >= 10) return null;

  if (lastBlockedAttempt) {
    return 'Covered bolt! Unbolt the upper plate first.';
  }

  switch (levelIndex) {
    case 0:
      return 'Tap the glowing bolt to fill the matching Target Box';
    case 1:
      return 'Clear all 3 bolts of a color to complete its plate';
    case 2:
      return 'Clear the top plate first to free bolts underneath';
    case 3:
      return 'Park a waiting bolt in the Spare Dock to uncover lower layers';
    case 4:
      return 'Tip: Tap +1 Slot if your Spare Dock gets tight';
    case 6:
      return 'Tip: Tap Hammer to remove any covered bolt directly';
    case 7:
      return 'Tip: Hold or tap Peek to inspect layers underneath';
    case 8:
      return 'Tip: Unbolt screws to charge the Auto-Play Reactor';
    case 9:
      return 'Special Bolts unlocked: Watch for Mystery (?) & Rainbow bolts';
    default:
      return null;
  }
}

export function isFtueCurriculumLevel(levelIndex: number): boolean {
  return levelIndex >= 0 && levelIndex < 9;
}

