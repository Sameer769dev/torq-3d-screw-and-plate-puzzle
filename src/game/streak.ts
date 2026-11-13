/**
 * Daily Gameplay Session Streak Tracker & Visual Reward Indicator for TORQ.
 *
 * Tracks consecutive calendar days played in localStorage, evaluates same-day,
 * consecutive-day, and lapsed-day transitions, and computes a 7-day visual
 * reward progression strip + returning-player bonus tier for the Title Screen.
 */

export const STREAK_STORAGE_KEY = 'torq_daily_streak_v1';

export interface StoredDayStreak {
  currentStreak: number;
  bestStreak: number;
  lastPlayedDate: string; // 'YYYY-MM-DD' in local calendar time
  totalDaysPlayed: number;
}

export interface StreakCycleNode {
  dayInCycle: number; // 1..7
  dayLabel: string; // 'D1'..'D7'
  completed: boolean;
  isCurrentDay: boolean;
  isMilestone: boolean; // Day 3 and Day 7 are special milestone nodes
}

export type StreakStatus = 'started' | 'active_today' | 'extended' | 'reset';

export interface DayStreakState {
  currentStreak: number;
  bestStreak: number;
  lastPlayedDate: string;
  totalDaysPlayed: number;
  status: StreakStatus;
  rewardTier: 'IGNITION' | 'PRECISION' | 'MOMENTUM' | 'OVERDRIVE' | 'MASTERWORK';
  rewardLabel: string;
  rewardBonusPoints: number;
  accentHex: string;
  cycleDayIndex: number; // 1..7 position in the 7-day visual reward bar
  cycleNodes: StreakCycleNode[];
  isDoubled?: boolean;
}

/**
 * Doubles the daily streak bonus points via rewarded video ad.
 */
export function doubleDailyStreakBonus(state: DayStreakState): DayStreakState {
  if (state.isDoubled) return state;
  return {
    ...state,
    rewardBonusPoints: state.rewardBonusPoints * 2,
    rewardLabel: `${state.rewardLabel} (2X BOOST)`,
    isDoubled: true,
  };
}

/**
 * Formats a Date object as a local calendar date key 'YYYY-MM-DD'.
 */
export function formatLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Computes the whole-day difference (targetDateKey - previousDateKey) in calendar days.
 * Returns null if either string is malformed.
 */
export function diffCalendarDays(
  previousDateKey: string,
  targetDateKey: string
): number | null {
  const prevParts = previousDateKey.split('-').map(Number);
  const targParts = targetDateKey.split('-').map(Number);
  if (prevParts.length !== 3 || targParts.length !== 3) return null;
  if (prevParts.some(Number.isNaN) || targParts.some(Number.isNaN)) return null;

  const prevUtc = Date.UTC(prevParts[0], prevParts[1] - 1, prevParts[2]);
  const targUtc = Date.UTC(targParts[0], targParts[1] - 1, targParts[2]);
  const msPerDay = 86_400_000;
  return Math.round((targUtc - prevUtc) / msPerDay);
}

/**
 * Builds the visual reward metadata and 7-day progression nodes for a given `currentStreak`.
 */
export function buildStreakRewardMetadata(
  currentStreak: number,
  bestStreak: number,
  lastPlayedDate: string,
  totalDaysPlayed: number,
  status: StreakStatus
): DayStreakState {
  const safeStreak = Math.max(1, Math.floor(currentStreak));
  const safeBest = Math.max(safeStreak, Math.floor(bestStreak));
  const safeTotal = Math.max(1, Math.floor(totalDaysPlayed));

  let rewardTier: DayStreakState['rewardTier'] = 'IGNITION';
  let rewardBonusPoints = 100;
  let accentHex = '#F59E0B'; // Machinist Amber

  if (safeStreak >= 7) {
    rewardTier = 'MASTERWORK';
    rewardBonusPoints = 750;
    accentHex = '#FBBF24'; // Masterwork Gold
  } else if (safeStreak >= 5) {
    rewardTier = 'OVERDRIVE';
    rewardBonusPoints = 500;
    accentHex = '#A855F7'; // Anodized Violet
  } else if (safeStreak >= 3) {
    rewardTier = 'MOMENTUM';
    rewardBonusPoints = 350;
    accentHex = '#10B981'; // Precision Emerald
  } else if (safeStreak === 2) {
    rewardTier = 'PRECISION';
    rewardBonusPoints = 200;
    accentHex = '#38BDF8'; // Cobalt Cyan
  }

  const rewardLabel = `${rewardTier} +${rewardBonusPoints} PTS`;

  // 1..7 position in the 7-day visual reward bar
  const cycleDayIndex = ((safeStreak - 1) % 7) + 1;
  const cycleNodes: StreakCycleNode[] = [];
  for (let d = 1; d <= 7; d++) {
    cycleNodes.push({
      dayInCycle: d,
      dayLabel: `D${d}`,
      completed: d <= cycleDayIndex,
      isCurrentDay: d === cycleDayIndex,
      isMilestone: d === 3 || d === 7,
    });
  }

  return {
    currentStreak: safeStreak,
    bestStreak: safeBest,
    lastPlayedDate,
    totalDaysPlayed: safeTotal,
    status,
    rewardTier,
    rewardLabel,
    rewardBonusPoints,
    accentHex,
    cycleDayIndex,
    cycleNodes,
  };
}

/**
 * Pure function that evaluates a stored streak record against `todayDateKey` ('YYYY-MM-DD')
 * and returns the updated `DayStreakState`.
 */
export function evaluateDayStreak(
  stored: StoredDayStreak | null | undefined,
  todayDateKey: string
): DayStreakState {
  if (
    !stored ||
    typeof stored.currentStreak !== 'number' ||
    typeof stored.lastPlayedDate !== 'string' ||
    stored.currentStreak < 1
  ) {
    return buildStreakRewardMetadata(1, 1, todayDateKey, 1, 'started');
  }

  const dayDiff = diffCalendarDays(stored.lastPlayedDate, todayDateKey);

  if (dayDiff === null || dayDiff < 0) {
    // Clock skew or invalid date: preserve existing streak anchored to today
    return buildStreakRewardMetadata(
      stored.currentStreak,
      Math.max(stored.bestStreak || 1, stored.currentStreak),
      todayDateKey,
      Math.max(1, stored.totalDaysPlayed || 1),
      'active_today'
    );
  }

  if (dayDiff === 0) {
    // Already logged a gameplay session today -> maintain streak
    return buildStreakRewardMetadata(
      stored.currentStreak,
      Math.max(stored.bestStreak || 1, stored.currentStreak),
      todayDateKey,
      Math.max(1, stored.totalDaysPlayed || 1),
      'active_today'
    );
  }

  if (dayDiff === 1) {
    // Played yesterday -> increment consecutive Day Streak!
    const nextStreak = stored.currentStreak + 1;
    const nextBest = Math.max(stored.bestStreak || 1, nextStreak);
    const nextTotal = Math.max(1, stored.totalDaysPlayed || 1) + 1;
    return buildStreakRewardMetadata(
      nextStreak,
      nextBest,
      todayDateKey,
      nextTotal,
      'extended'
    );
  }

  // Missed 1 or more calendar days (dayDiff >= 2) -> reset currentStreak to 1, preserve bestStreak
  const preservedBest = Math.max(stored.bestStreak || 1, stored.currentStreak);
  const nextTotal = Math.max(1, stored.totalDaysPlayed || 1) + 1;
  return buildStreakRewardMetadata(
    1,
    preservedBest,
    todayDateKey,
    nextTotal,
    'reset'
  );
}

/**
 * Loads the player's stored Day Streak from `localStorage` (if available),
 * records today's daily gameplay session, persists the updated record, and
 * returns the resulting `DayStreakState`.
 */
export function loadAndRecordDailyStreak(
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null,
  now: Date = new Date()
): DayStreakState {
  const todayKey = formatLocalDateKey(now);

  // Check optional ?streak=<N> URL query override for testing/previewing returning-player tiers
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const streakParam = params.get('streak');
    if (streakParam) {
      const parsed = parseInt(streakParam, 10);
      if (!Number.isNaN(parsed) && parsed >= 1) {
        return buildStreakRewardMetadata(
          parsed,
          parsed,
          todayKey,
          parsed,
          parsed > 1 ? 'extended' : 'started'
        );
      }
    }
  }

  const targetStorage =
    storage !== undefined
      ? storage
      : typeof window !== 'undefined' && window.localStorage
        ? window.localStorage
        : null;

  let stored: StoredDayStreak | null = null;
  if (targetStorage) {
    try {
      const raw = targetStorage.getItem(STREAK_STORAGE_KEY);
      if (raw) {
        stored = JSON.parse(raw) as StoredDayStreak;
      }
    } catch {
      stored = null;
    }
  }

  const state = evaluateDayStreak(stored, todayKey);

  if (targetStorage) {
    try {
      const toStore: StoredDayStreak = {
        currentStreak: state.currentStreak,
        bestStreak: state.bestStreak,
        lastPlayedDate: state.lastPlayedDate,
        totalDaysPlayed: state.totalDaysPlayed,
      };
      targetStorage.setItem(STREAK_STORAGE_KEY, JSON.stringify(toStore));
    } catch {
      // Ignore storage quota errors in restricted frames
    }
  }

  return state;
}
