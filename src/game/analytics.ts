/**
 * TORQ: FTUE Funnel Telemetry & Remote-Configurable A/B Test Flags
 *
 * Emits typed analytics events matching Firebase Analytics GA4 schema, stores an
 * inspectable local ring buffer (200 events) for DebugView / automated verification,
 * and forwards to a native/web Firebase bridge when configured.
 */

export type FtueAnalyticsEventName =
  | 'ftue_launch'
  | 'ftue_first_tap'
  | 'ftue_step'
  | 'level_start'
  | 'level_complete'
  | 'level_fail'
  | 'booster_unlock_seen'
  | 'booster_first_use'
  | 'pgs_prompt_shown'
  | 'pgs_prompt_result'
  | 'ad_impression'
  | 'session_end';

export interface FtueAnalyticsEvent {
  name: FtueAnalyticsEventName;
  params: Record<string, string | number | boolean>;
  timestampMs: number;
}

export interface FtueExperimentFlags {
  t1StartMode: 'instant_board' | 'title_gate';
  t2L1BoltCount: 6 | 9;
  t3IdleHandDelayMs: 0 | 1500 | 3200;
  t4NativeAdsMinLevelIndex: 1 | 3 | 5;
  t5PgsPromptLevelIndex: 0 | 2 | 4;
  abBucket: string;
}

export type AnalyticsTransport = (event: FtueAnalyticsEvent) => void;

const ANALYTICS_STORAGE_KEY = 'torq_analytics_buffer_v1';
const FLAGS_STORAGE_KEY = 'torq_ftue_flags_v1';
const MAX_BUFFER_EVENTS = 200;

export const DEFAULT_FTUE_FLAGS: FtueExperimentFlags = {
  t1StartMode: 'instant_board',
  t2L1BoltCount: 6,
  t3IdleHandDelayMs: 0,
  t4NativeAdsMinLevelIndex: 3,
  t5PgsPromptLevelIndex: 2,
  abBucket: 'ftue_v1_control',
};

function readJsonStorage<T>(key: string): T | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJsonStorage(key: string, value: unknown): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Non-fatal in private / constrained environments
  }
}

class AnalyticsManager {
  private buffer: FtueAnalyticsEvent[] = [];
  private flags: FtueExperimentFlags = { ...DEFAULT_FTUE_FLAGS };
  private transport: AnalyticsTransport | null = null;
  private firstTapRecorded = false;
  private launchTimestampMs = Date.now();

  constructor() {
    const savedEvents = readJsonStorage<FtueAnalyticsEvent[]>(ANALYTICS_STORAGE_KEY);
    if (Array.isArray(savedEvents)) {
      this.buffer = savedEvents.slice(-MAX_BUFFER_EVENTS);
    }
    const savedFlags = readJsonStorage<Partial<FtueExperimentFlags>>(FLAGS_STORAGE_KEY);
    if (savedFlags && typeof savedFlags === 'object') {
      this.flags = { ...DEFAULT_FTUE_FLAGS, ...savedFlags };
    }
  }

  public setTransport(transport: AnalyticsTransport | null): void {
    this.transport = transport;
  }

  public getFlags(): FtueExperimentFlags {
    return this.flags;
  }

  public setFlags(overrides: Partial<FtueExperimentFlags>): FtueExperimentFlags {
    this.flags = { ...this.flags, ...overrides };
    writeJsonStorage(FLAGS_STORAGE_KEY, this.flags);
    return this.flags;
  }

  public resetLaunchClock(now = Date.now()): void {
    this.launchTimestampMs = now;
    this.firstTapRecorded = false;
  }

  public logEvent(
    name: FtueAnalyticsEventName,
    params: Record<string, string | number | boolean> = {}
  ): FtueAnalyticsEvent {
    const entry: FtueAnalyticsEvent = {
      name,
      params: { ...params },
      timestampMs: Date.now(),
    };
    this.buffer.push(entry);
    if (this.buffer.length > MAX_BUFFER_EVENTS) {
      this.buffer = this.buffer.slice(-MAX_BUFFER_EVENTS);
    }
    writeJsonStorage(ANALYTICS_STORAGE_KEY, this.buffer);

    if (this.transport) {
      try {
        this.transport(entry);
      } catch {
        // Ignore transport failures
      }
    }
    return entry;
  }

  public logFirstTapIfNeeded(levelIndex: number): boolean {
    if (this.firstTapRecorded) return false;
    this.firstTapRecorded = true;
    const elapsed = Math.max(0, Date.now() - this.launchTimestampMs);
    this.logEvent('ftue_first_tap', {
      time_to_first_tap_ms: elapsed,
      level_index: levelIndex,
    });
    return true;
  }

  public getBufferedEvents(): FtueAnalyticsEvent[] {
    return [...this.buffer];
  }

  public clearBufferedEvents(): void {
    this.buffer = [];
    this.firstTapRecorded = false;
    writeJsonStorage(ANALYTICS_STORAGE_KEY, []);
  }
}

export const analyticsManager = new AnalyticsManager();

