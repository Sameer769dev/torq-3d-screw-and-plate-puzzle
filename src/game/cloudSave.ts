import { registerPlugin } from '@capacitor/core';
import { BoardState } from './types';
import { DayStreakState } from './streak';
import { SoundSettingsState } from './sound';
import {
  applyCloudRestoreToFtue,
  createDefaultFtueState,
  FtueState,
  mergeFtueStates,
  normalizeFtueState,
  recordFtueSessionStart,
} from './ftue';

export interface TorqSaveBlob {
  version: 1;
  updatedAtMs: number;
  levelIndex: number;
  highestLevelIndex: number;
  cumulativeScore: number;
  bestScore: number;
  hammersRemaining: number;
  extraSlotsRemaining: number;
  maxDockSlots: number;
  autoPlayChargeBolts: number;
  dayStreak: {
    currentStreak: number;
    lastPlayedDateStr: string;
    totalDaysPlayed: number;
  };
  sound: {
    packId: string;
    muted: boolean;
    volume: number;
  };
  ftue?: FtueState;
}

export interface PlayGamesCloudSavePlugin {
  checkAuthStatus(options?: { interactive?: boolean }): Promise<{
    isAuthenticated: boolean;
    playerId?: string;
    displayName?: string;
    error?: string;
  }>;
  setNativeAdsVisible(options: { visible: boolean }): Promise<{
    visible: boolean;
  }>;
  loadSave(options?: { snapshotName?: string }): Promise<{
    success: boolean;
    empty?: boolean;
    hasConflict?: boolean;
    data?: string;
    cloudData?: string;
    localData?: string;
    description?: string;
    lastModified?: number;
    error?: string;
  }>;
  commitSave(options: {
    data: string;
    snapshotName?: string;
    description?: string;
    playedTimeMs?: number;
  }): Promise<{
    success: boolean;
    error?: string;
  }>;
}

const PlayGamesNative = registerPlugin<PlayGamesCloudSavePlugin>('PlayGamesCloudSave');

const LOCAL_STORAGE_KEY = 'torq_save_state_v1';

/**
 * Creates a baseline fresh save state
 */
export function createDefaultSaveState(): TorqSaveBlob {
  return {
    version: 1,
    updatedAtMs: Date.now(),
    levelIndex: 0,
    highestLevelIndex: 0,
    cumulativeScore: 0,
    bestScore: 0,
    hammersRemaining: 3,
    extraSlotsRemaining: 1,
    maxDockSlots: 5,
    autoPlayChargeBolts: 0,
    dayStreak: {
      currentStreak: 1,
      lastPlayedDateStr: new Date().toISOString().slice(0, 10),
      totalDaysPlayed: 1,
    },
    sound: {
      packId: 'industrial',
      muted: false,
      volume: 0.85,
    },
    ftue: createDefaultFtueState(),
  };
}

/**
 * Implements the Google Play Games Level Up conflict resolution algorithm.
 * 'smart_merge': Merges highest level, scores, and best of powerups so players never lose progress or purchases.
 */
export function resolveCloudConflict(
  cloud: TorqSaveBlob,
  local: TorqSaveBlob,
  policy: 'smart_merge' | 'keep_cloud' | 'keep_local' = 'smart_merge'
): TorqSaveBlob {
  if (policy === 'keep_cloud') {
    const cloudNorm = normalizeFtueState(cloud.ftue);
    const highest = Math.max(cloud.highestLevelIndex ?? 0, cloud.levelIndex ?? 0);
    return {
      ...cloud,
      updatedAtMs: Date.now(),
      ftue: applyCloudRestoreToFtue(cloudNorm, highest),
    };
  }
  if (policy === 'keep_local') {
    const localNorm = normalizeFtueState(local.ftue);
    const highest = Math.max(local.highestLevelIndex ?? 0, local.levelIndex ?? 0);
    return {
      ...local,
      updatedAtMs: Date.now(),
      ftue: applyCloudRestoreToFtue(localNorm, highest),
    };
  }

  // Google Play Games Level Up Recommended: Smart Non-Destructive Merge
  const maxLevel = Math.max(
    cloud.levelIndex ?? 0,
    local.levelIndex ?? 0,
    cloud.highestLevelIndex ?? 0,
    local.highestLevelIndex ?? 0
  );

  const bestScore = Math.max(cloud.bestScore ?? 0, local.bestScore ?? 0);
  const cumulativeScore = Math.max(cloud.cumulativeScore ?? 0, local.cumulativeScore ?? 0);

  // Preserve the highest available powerup boosters
  const hammers = Math.max(cloud.hammersRemaining ?? 0, local.hammersRemaining ?? 0);
  const extraSlots = Math.max(cloud.extraSlotsRemaining ?? 0, local.extraSlotsRemaining ?? 0);
  const dockSlots = Math.max(cloud.maxDockSlots ?? 5, local.maxDockSlots ?? 5, 5);
  const autoPlayBolts = Math.max(cloud.autoPlayChargeBolts ?? 0, local.autoPlayChargeBolts ?? 0);

  // Preserve streak with latest activity date
  const cloudDate = cloud.dayStreak?.lastPlayedDateStr ?? '';
  const localDate = local.dayStreak?.lastPlayedDateStr ?? '';
  const chosenStreak = cloudDate >= localDate ? (cloud.dayStreak ?? local.dayStreak) : (local.dayStreak ?? cloud.dayStreak);

  return {
    version: 1,
    updatedAtMs: Date.now(),
    levelIndex: maxLevel,
    highestLevelIndex: maxLevel,
    cumulativeScore,
    bestScore,
    hammersRemaining: hammers,
    extraSlotsRemaining: extraSlots,
    maxDockSlots: dockSlots,
    autoPlayChargeBolts: autoPlayBolts,
    dayStreak: chosenStreak,
    sound: local.sound ?? cloud.sound,
    ftue: mergeFtueStates(cloud.ftue, local.ftue, maxLevel),
  };
}

/**
 * Reads local cached save from localStorage
 */
export function loadLocalSave(): TorqSaveBlob | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TorqSaveBlob;
    if (parsed && typeof parsed.levelIndex === 'number') {
      return parsed;
    }
  } catch (err) {
    console.warn('[CloudSave] Error loading local save:', err);
  }
  return null;
}

/**
 * Writes save to localStorage synchronously (0ms delay)
 */
export function writeLocalSave(state: TorqSaveBlob): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('[CloudSave] Error writing local save:', err);
  }
}

/**
 * CloudSaveManager orchestrates local-first instant saves and debounced Google Play Games cloud synchronization.
 */
export class CloudSaveManager {
  private currentState: TorqSaveBlob;
  private syncTimer: ReturnType<typeof setTimeout> | null = null;
  private isConnectedToPGS: boolean = false;
  private playerName: string = 'Guest Player';
  private onConflictCallback: ((cloud: TorqSaveBlob, local: TorqSaveBlob) => void) | null = null;
  private readonly isExistingLocalInstall: boolean;
  private sessionStartRecorded: boolean = false;

  constructor() {
    const existing = loadLocalSave();
    this.isExistingLocalInstall = existing !== null;
    const base = existing ?? createDefaultSaveState();
    const highest = Math.max(base.highestLevelIndex ?? 0, base.levelIndex ?? 0);
    this.currentState = {
      ...base,
      ftue: applyCloudRestoreToFtue(normalizeFtueState(base.ftue), highest),
    };
  }

  public getState(): TorqSaveBlob {
    return this.currentState;
  }

  public getFtueState(): FtueState {
    return normalizeFtueState(this.currentState.ftue);
  }

  public isFreshSessionBoot(): boolean {
    return !this.isExistingLocalInstall;
  }

  public recordSessionStart(): FtueState {
    if (this.sessionStartRecorded) {
      return this.getFtueState();
    }
    this.sessionStartRecorded = true;
    const nextFtue = recordFtueSessionStart(
      this.getFtueState(),
      this.isExistingLocalInstall
    );
    this.currentState = {
      ...this.currentState,
      updatedAtMs: Date.now(),
      ftue: nextFtue,
    };
    writeLocalSave(this.currentState);
    return nextFtue;
  }

  public updateFtue(updater: (prev: FtueState) => FtueState): FtueState {
    const prev = this.getFtueState();
    const next = updater(prev);
    if (next === prev) return prev;
    this.currentState = {
      ...this.currentState,
      updatedAtMs: Date.now(),
      ftue: next,
    };
    writeLocalSave(this.currentState);
    this.queueCloudCommit();
    return next;
  }

  public async setNativeAdsVisible(visible: boolean): Promise<void> {
    try {
      await PlayGamesNative.setNativeAdsVisible({ visible });
    } catch {
      // Non-native preview environments ignore native overlay calls
    }
  }

  public getPlayerName(): string {
    return this.playerName;
  }

  public isCloudConnected(): boolean {
    return this.isConnectedToPGS;
  }

  public setConflictHandler(cb: (cloud: TorqSaveBlob, local: TorqSaveBlob) => void): void {
    this.onConflictCallback = cb;
  }

  /**
   * Initializes Play Games Services connection silently on launch (interactive = false)
   * & retrieves remote saved game if already authenticated, never blocking cold start.
   */
  public async initialize(interactive = false): Promise<TorqSaveBlob> {
    try {
      const auth = await PlayGamesNative.checkAuthStatus({ interactive });
      if (auth && auth.isAuthenticated) {
        this.isConnectedToPGS = true;
        this.playerName = auth.displayName || 'Play Games Player';

        const saveResult = await PlayGamesNative.loadSave();
        if (saveResult && saveResult.success) {
          if (saveResult.hasConflict && saveResult.cloudData && saveResult.localData) {
            // Conflict detected!
            try {
              const cloudBlob = JSON.parse(saveResult.cloudData) as TorqSaveBlob;
              const localBlob = JSON.parse(saveResult.localData) as TorqSaveBlob;
              if (this.onConflictCallback) {
                this.onConflictCallback(cloudBlob, localBlob);
              } else {
                // Default to Smart Merge
                this.currentState = resolveCloudConflict(cloudBlob, localBlob, 'smart_merge');
                writeLocalSave(this.currentState);
                this.queueCloudCommit();
              }
            } catch (parseErr) {
              console.warn('[CloudSave] Conflict parse error:', parseErr);
            }
          } else if (saveResult.data && !saveResult.empty) {
            try {
              const cloudBlob = JSON.parse(saveResult.data) as TorqSaveBlob;
              const localBlob = this.currentState;

              const isLocalFresh =
                (localBlob.highestLevelIndex ?? 0) === 0 &&
                (localBlob.cumulativeScore ?? 0) === 0 &&
                (localBlob.bestScore ?? 0) === 0;

              const cloudHighest = Math.max(
                cloudBlob.highestLevelIndex ?? 0,
                cloudBlob.levelIndex ?? 0
              );
              const localHighest = Math.max(
                localBlob.highestLevelIndex ?? 0,
                localBlob.levelIndex ?? 0
              );

              if (isLocalFresh) {
                // Players play on multiple devices and install a game on same device multiple times.
                // Always start game from last progress state automatically!
                this.currentState = {
                  ...cloudBlob,
                  ftue: applyCloudRestoreToFtue(normalizeFtueState(cloudBlob.ftue), cloudHighest),
                };
                writeLocalSave(this.currentState);
              } else if (
                cloudHighest > 0 &&
                localHighest > 0 &&
                (cloudBlob.levelIndex !== localBlob.levelIndex ||
                  cloudBlob.bestScore !== localBlob.bestScore)
              ) {
                // Option 2 (Recommended by Google Play Games Level Up):
                // Informs the player an existing account with progress was detected.
                // Linking guest account presents choices so player makes an informed decision.
                if (this.onConflictCallback) {
                  this.onConflictCallback(cloudBlob, localBlob);
                } else {
                  this.currentState = resolveCloudConflict(cloudBlob, localBlob, 'smart_merge');
                  writeLocalSave(this.currentState);
                  this.queueCloudCommit();
                }
              } else {
                // Consistent states: smart merge and keep in sync
                this.currentState = resolveCloudConflict(cloudBlob, localBlob, 'smart_merge');
                writeLocalSave(this.currentState);
                this.queueCloudCommit();
              }
            } catch (e) {
              console.warn('[CloudSave] JSON parse error from cloud data:', e);
            }
          } else if (saveResult.empty) {
            // Cloud has no save yet: push current local state to cloud automatically!
            this.queueCloudCommit();
          }
        }
      }
    } catch (err) {
      console.log('[CloudSave] Play Games Services not available or running in web preview:', err);
    }

    return this.currentState;
  }

  /**
   * Explicitly requests interactive Play Games sign-in & sync (used after Level 3 or from Pause).
   */
  public async linkPlayGamesAndSync(): Promise<{
    connected: boolean;
    playerName: string;
  }> {
    await this.initialize(true);
    return {
      connected: this.isConnectedToPGS,
      playerName: this.playerName,
    };
  }

  /**
   * Record state from ongoing gameplay and schedule debounced cloud commit
   */
  public recordProgress(
    board: BoardState,
    streak?: DayStreakState,
    sound?: SoundSettingsState,
    autoPlayBolts?: number
  ): void {
    const nextLevel = board.levelIndex;
    const highest = Math.max(this.currentState.highestLevelIndex, nextLevel);
    const score = Math.round(board.score);
    const best = Math.max(this.currentState.bestScore, score);
    const currentFtue = this.getFtueState();
    const updatedFtue =
      nextLevel >= 9
        ? {
          ...currentFtue,
          step: 'FTUEComplete' as const,
          completed: true,
          completedAt: currentFtue.completedAt ?? Date.now(),
        }
        : currentFtue;

    this.currentState = {
      ...this.currentState,
      version: 1,
      updatedAtMs: Date.now(),
      levelIndex: nextLevel,
      highestLevelIndex: highest,
      cumulativeScore: score,
      bestScore: best,
      hammersRemaining: board.hammersRemaining,
      extraSlotsRemaining: board.extraSlotsRemaining,
      maxDockSlots: board.maxDockSlots,
      autoPlayChargeBolts: autoPlayBolts ?? this.currentState.autoPlayChargeBolts,
      dayStreak: streak
        ? {
          currentStreak: streak.currentStreak,
          lastPlayedDateStr: streak.lastPlayedDate,
          totalDaysPlayed: streak.totalDaysPlayed,
        }
        : this.currentState.dayStreak,
      sound: sound
        ? {
          packId: sound.activePack,
          muted: sound.muted,
          volume: sound.volume,
        }
        : this.currentState.sound,
      ftue: updatedFtue,
    };

    // Instant local save (0ms)
    writeLocalSave(this.currentState);

    // Debounced cloud commit (1.5s)
    this.queueCloudCommit();
  }

  /**
   * Manually resolves a conflict (e.g. from user choice in UI)
   */
  public applyConflictChoice(
    cloud: TorqSaveBlob,
    local: TorqSaveBlob,
    choice: 'smart_merge' | 'keep_cloud' | 'keep_local'
  ): TorqSaveBlob {
    this.currentState = resolveCloudConflict(cloud, local, choice);
    writeLocalSave(this.currentState);
    this.queueCloudCommit();
    return this.currentState;
  }

  private queueCloudCommit(): void {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
    }
    this.syncTimer = setTimeout(() => {
      this.syncTimer = null;
      this.commitToCloud();
    }, 1500);
  }

  private async commitToCloud(): Promise<void> {
    if (!this.isConnectedToPGS) return;
    try {
      const dataStr = JSON.stringify(this.currentState);
      const desc = `Level ${this.currentState.levelIndex + 1} • ${this.currentState.bestScore} pts • ${this.currentState.hammersRemaining} Hammers`;
      await PlayGamesNative.commitSave({
        data: dataStr,
        description: desc,
        playedTimeMs: 120000,
      });
    } catch (err) {
      console.warn('[CloudSave] Cloud commit failed (will retry on next event):', err);
    }
  }
}

export const cloudSaveManager = new CloudSaveManager();
