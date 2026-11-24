/**
 * TORQ: 3D Screw & Plate Puzzle - High-Yield, Zero-Annoyance AdMob Monetization Engine
 *
 * Profit & Retention Architecture:
 * - ZERO always-on screen banners or distracting side billboards (100% full-screen gameplay).
 * - 5 High-eCPM Opt-In Rewarded Video placements (Revive, Extra Dock Slot, +2 Hammers,
 *   Auto-Play Reactor Boost, 2X Daily Streak).
 * - Grace-Protected Level-Transition Interstitials:
 *     * Blocked during FTUE & Session 1 (protects early retention)
 *     * 120-second Rewarded-Video Grace Shield (never punish rewarded viewers with a forced ad)
 *     * >= 100s cooldown + >= 2 completed levels between interstitials
 * - Automatic exponential-backoff preloading (maximizes fill rate) + GDPR/UMP consent check
 * - Environment-driven production Ad Unit IDs (safe Google test IDs by default)
 */

import { Capacitor } from '@capacitor/core';
import {
  AdMob,
  AdmobConsentStatus,
  AdMobRewardItem,
  InterstitialAdPluginEvents,
  RewardAdPluginEvents,
} from '@capacitor-community/admob';
import { hapticsEngine } from './haptics';
import { analyticsManager } from './analytics';
import { soundEngine } from './sound';

// Read Vite env vars safely (works in both browser bundle and Node unit tests)
function readEnv(key: string): string | undefined {
  try {
    const meta = import.meta as unknown as {
      env?: Record<string, string | undefined>;
    };
    const val = meta?.env?.[key];
    return typeof val === 'string' && val.trim().length > 0 ? val.trim() : undefined;
  } catch {
    return undefined;
  }
}

const USE_TEST_ADS = readEnv('VITE_ADMOB_TESTING') !== 'false';

// Production Ad Unit IDs come from VITE_ADMOB_ANDROID_* env vars; falls back safely to official Google AdMob Test IDs
export const AD_UNIT_IDS = {
  android: {
    banner:
      readEnv('VITE_ADMOB_ANDROID_BANNER') ??
      'ca-app-pub-3940256099942544/6300978111',
    interstitial:
      readEnv('VITE_ADMOB_ANDROID_INTERSTITIAL') ??
      'ca-app-pub-3940256099942544/1033173712',
    rewarded:
      readEnv('VITE_ADMOB_ANDROID_REWARDED') ??
      'ca-app-pub-3940256099942544/5224354917',
  },
};

export type RewardedPlacement =
  | 'revive'
  | 'extra_slot'
  | 'hammer_refill'
  | 'autoplay_fuel'
  | 'streak_doubler';

export interface AdsManagerState {
  initialized: boolean;
  isTestingMode: boolean;
  rewardedLoaded: boolean;
  interstitialLoaded: boolean;
  bannerVisible: boolean;
  isShowingAd: boolean;
  lastInterstitialTimeMs: number;
  lastRewardedTimeMs: number;
  totalRewardedWatched: number;
  totalInterstitialsShown: number;
  levelsSinceLastInterstitial: number;
}

class AdsManager {
  private initialized = false;
  private rewardedLoaded = false;
  private interstitialLoaded = false;
  private bannerVisible = false;
  private isShowingAd = false;
  private lastInterstitialTimeMs = 0;
  private lastRewardedTimeMs = 0;
  private totalRewardedWatched = 0;
  private totalInterstitialsShown = 0;
  private levelsSinceLastInterstitial = 99; // Allow first eligible post-FTUE interstitial cleanly
  private isLoadingRewarded = false;
  private isLoadingInterstitial = false;
  private rewardedRetryAttempt = 0;
  private interstitialRetryAttempt = 0;

  // Smart Pacing & Anti-Annoyance Constants
  readonly MIN_INTERSTITIAL_COOLDOWN_MS = 100_000; // >= 100s between interstitials
  readonly REWARDED_GRACE_PERIOD_MS = 120_000;     // >= 120s ad-free grace after watching ANY rewarded video
  readonly MIN_LEVELS_BETWEEN_INTERSTITIALS = 2;   // Never back-to-back levels
  readonly MIN_INTERSTITIAL_LEVEL_INDEX = 9;       // Zero forced ads during FTUE (Levels 1..9)

  /**
   * Initializes Google AdMob SDK + GDPR/UMP Consent on native mobile platforms.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    if (!Capacitor.isNativePlatform()) {
      this.initialized = true;
      this.rewardedLoaded = true;
      this.interstitialLoaded = true;
      return;
    }

    try {
      // Request GDPR / UMP user consent if required in EEA/UK for high-eCPM personalized ads
      try {
        const consentInfo = await AdMob.requestConsentInfo();
        if (
          consentInfo.isConsentFormAvailable &&
          consentInfo.status === AdmobConsentStatus.REQUIRED
        ) {
          await AdMob.showConsentForm();
        }
      } catch (consentErr) {
        console.warn('[AdsManager] UMP consent check skipped:', consentErr);
      }

      await AdMob.initialize({
        testingDevices: USE_TEST_ADS ? ['EMULATOR'] : [],
        initializeForTesting: USE_TEST_ADS,
      });

      this.setupEventListeners();
      this.initialized = true;

      // Immediately pre-load high-yield Rewarded & Interstitial inventory
      this.preloadRewarded();
      this.preloadInterstitial();
    } catch (err) {
      console.warn('[AdsManager] AdMob initialization failed:', err);
      this.initialized = true;
      this.rewardedLoaded = true;
      this.interstitialLoaded = true;
    }
  }

  private scheduleRetry(kind: 'rewarded' | 'interstitial'): void {
    const backoffMs = [3000, 8000, 20000, 45000];
    if (kind === 'rewarded') {
      const delay =
        backoffMs[Math.min(this.rewardedRetryAttempt, backoffMs.length - 1)];
      this.rewardedRetryAttempt++;
      setTimeout(() => this.preloadRewarded(), delay);
    } else {
      const delay =
        backoffMs[
          Math.min(this.interstitialRetryAttempt, backoffMs.length - 1)
        ];
      this.interstitialRetryAttempt++;
      setTimeout(() => this.preloadInterstitial(), delay);
    }
  }

  private setupEventListeners(): void {
    AdMob.addListener(RewardAdPluginEvents.Loaded, () => {
      this.rewardedLoaded = true;
      this.isLoadingRewarded = false;
      this.rewardedRetryAttempt = 0;
    });

    AdMob.addListener(RewardAdPluginEvents.FailedToLoad, (info) => {
      console.warn('[AdsManager] Rewarded ad failed to load:', info);
      this.rewardedLoaded = false;
      this.isLoadingRewarded = false;
      this.scheduleRetry('rewarded');
    });

    AdMob.addListener(RewardAdPluginEvents.Dismissed, () => {
      this.rewardedLoaded = false;
      this.rewardedRetryAttempt = 0;
      // Pre-load next rewarded ad immediately so Revive/Boosters always feel instant
      setTimeout(() => this.preloadRewarded(), 1200);
    });

    AdMob.addListener(InterstitialAdPluginEvents.Loaded, () => {
      this.interstitialLoaded = true;
      this.isLoadingInterstitial = false;
      this.interstitialRetryAttempt = 0;
    });

    AdMob.addListener(InterstitialAdPluginEvents.FailedToLoad, (info) => {
      console.warn('[AdsManager] Interstitial ad failed to load:', info);
      this.interstitialLoaded = false;
      this.isLoadingInterstitial = false;
      this.scheduleRetry('interstitial');
    });

    AdMob.addListener(InterstitialAdPluginEvents.Dismissed, () => {
      this.interstitialLoaded = false;
      this.interstitialRetryAttempt = 0;
      this.lastInterstitialTimeMs = Date.now();
      // Pre-load next interstitial smoothly in the background
      setTimeout(() => this.preloadInterstitial(), 3000);
    });
  }

  async preloadRewarded(): Promise<void> {
    if (
      !Capacitor.isNativePlatform() ||
      this.rewardedLoaded ||
      this.isLoadingRewarded
    ) {
      return;
    }
    this.isLoadingRewarded = true;
    try {
      await AdMob.prepareRewardVideoAd({
        adId: AD_UNIT_IDS.android.rewarded,
        isTesting: USE_TEST_ADS,
      });
    } catch (err) {
      this.isLoadingRewarded = false;
      console.warn('[AdsManager] Failed preparing rewarded ad:', err);
      this.scheduleRetry('rewarded');
    }
  }

  async preloadInterstitial(): Promise<void> {
    if (
      !Capacitor.isNativePlatform() ||
      this.interstitialLoaded ||
      this.isLoadingInterstitial
    ) {
      return;
    }
    this.isLoadingInterstitial = true;
    try {
      await AdMob.prepareInterstitial({
        adId: AD_UNIT_IDS.android.interstitial,
        isTesting: USE_TEST_ADS,
      });
    } catch (err) {
      this.isLoadingInterstitial = false;
      console.warn('[AdsManager] Failed preparing interstitial:', err);
      this.scheduleRetry('interstitial');
    }
  }

  /**
   * Temporarily mutes game SFX while a full-screen ad plays and restores prior audio state after.
   */
  private async runWithAdAudioGuard<T>(fn: () => Promise<T>): Promise<T> {
    const wasMuted = soundEngine.muted;
    this.isShowingAd = true;
    if (!wasMuted) {
      soundEngine.setMuted(true);
    }
    try {
      return await fn();
    } finally {
      this.isShowingAd = false;
      if (!wasMuted) {
        soundEngine.setMuted(false);
      }
    }
  }

  /**
   * Shows an opt-in Rewarded Video ad for a high-value player reward.
   * Resolves `true` when the player finishes the video and earns the reward.
   * Grants a 120-second Interstitial Grace Period so rewarded viewers are never annoyed.
   */
  async showRewarded(placement: RewardedPlacement): Promise<boolean> {
    if (this.isShowingAd) return false;

    if (!Capacitor.isNativePlatform()) {
      return this.runWithAdAudioGuard(async () => {
        const earned = await this.showWebMockRewarded(placement);
        if (earned) {
          this.lastRewardedTimeMs = Date.now();
          analyticsManager.logEvent('ad_impression', {
            ad_type: `rewarded_${placement}`,
            level_index: -1,
            blocked_by_ftue: false,
          });
        }
        return earned;
      });
    }

    return this.runWithAdAudioGuard(async () => {
      try {
        if (!this.rewardedLoaded) {
          await this.preloadRewarded();
        }

        let rewardEarned = false;
        const rewardListener = await AdMob.addListener(
          RewardAdPluginEvents.Rewarded,
          (_reward: AdMobRewardItem) => {
            rewardEarned = true;
          }
        );

        await AdMob.showRewardVideoAd();
        rewardListener.remove();

        if (rewardEarned) {
          this.totalRewardedWatched++;
          this.lastRewardedTimeMs = Date.now();
          analyticsManager.logEvent('ad_impression', {
            ad_type: `rewarded_${placement}`,
            level_index: -1,
            blocked_by_ftue: false,
          });
          hapticsEngine.pulseLevelComplete();
          return true;
        }
        return false;
      } catch (err) {
        console.warn(
          '[AdsManager] Native rewarded ad unavailable, granting graceful fallback:',
          err
        );
        this.scheduleRetry('rewarded');
        // Never leave a player stuck if ad inventory momentarily fails to fill
        const earned = await this.showWebMockRewarded(placement);
        if (earned) {
          this.lastRewardedTimeMs = Date.now();
        }
        return earned;
      }
    });
  }

  /**
   * Checks FTUE, Session 2, Rewarded-Video Grace Shield (120s), Time Cooldown (100s),
   * and Multi-Level Spacing (>= 2 levels) before showing a natural level-transition interstitial.
   */
  async showLevelCompleteInterstitial(
    levelIndex: number,
    ftueContext?: { completed: boolean; sessionCount: number },
    nowMs = Date.now()
  ): Promise<boolean> {
    if (this.isShowingAd) return false;

    const ftueEligible =
      Boolean(ftueContext?.completed) &&
      (ftueContext?.sessionCount ?? 1) >= 2 &&
      levelIndex >= this.MIN_INTERSTITIAL_LEVEL_INDEX;

    if (!ftueEligible) {
      analyticsManager.logEvent('ad_impression', {
        ad_type: 'interstitial',
        level_index: levelIndex,
        blocked_by_ftue: true,
      });
      return false;
    }

    this.levelsSinceLastInterstitial++;

    // Anti-annoyance Grace Shield: never hit a player with a forced interstitial right after watching a Rewarded Video
    if (
      this.lastRewardedTimeMs > 0 &&
      nowMs - this.lastRewardedTimeMs < this.REWARDED_GRACE_PERIOD_MS
    ) {
      return false;
    }

    // Time cooldown check (>= 100s since last interstitial)
    if (
      this.lastInterstitialTimeMs > 0 &&
      nowMs - this.lastInterstitialTimeMs < this.MIN_INTERSTITIAL_COOLDOWN_MS
    ) {
      return false;
    }

    // Level-spacing check (at least 2 levels between forced interstitials)
    if (
      this.totalInterstitialsShown > 0 &&
      this.levelsSinceLastInterstitial < this.MIN_LEVELS_BETWEEN_INTERSTITIALS
    ) {
      return false;
    }

    if (!Capacitor.isNativePlatform()) {
      this.lastInterstitialTimeMs = nowMs;
      this.totalInterstitialsShown++;
      this.levelsSinceLastInterstitial = 0;
      analyticsManager.logEvent('ad_impression', {
        ad_type: 'interstitial',
        level_index: levelIndex,
        blocked_by_ftue: false,
      });
      return true;
    }

    // On native mobile, only show if already pre-loaded so level transitions never stall/freeze!
    if (!this.interstitialLoaded) {
      this.preloadInterstitial();
      return false;
    }

    return this.runWithAdAudioGuard(async () => {
      try {
        await AdMob.showInterstitial();
        this.lastInterstitialTimeMs = Date.now();
        this.totalInterstitialsShown++;
        this.levelsSinceLastInterstitial = 0;
        analyticsManager.logEvent('ad_impression', {
          ad_type: 'interstitial',
          level_index: levelIndex,
          blocked_by_ftue: false,
        });
        return true;
      } catch (err) {
        console.warn('[AdsManager] Interstitial failed to show:', err);
        this.scheduleRetry('interstitial');
        return false;
      }
    });
  }

  /**
   * Directly triggers an AdMob interstitial (for manual preview/diagnostics).
   */
  async showInterstitial(_force: boolean = true): Promise<boolean> {
    if (this.isShowingAd) return false;
    if (!Capacitor.isNativePlatform()) {
      this.lastInterstitialTimeMs = Date.now();
      this.totalInterstitialsShown++;
      this.levelsSinceLastInterstitial = 0;
      return true;
    }

    return this.runWithAdAudioGuard(async () => {
      try {
        if (!this.interstitialLoaded) {
          await this.preloadInterstitial();
        }
        await AdMob.showInterstitial();
        this.lastInterstitialTimeMs = Date.now();
        this.totalInterstitialsShown++;
        this.levelsSinceLastInterstitial = 0;
        return true;
      } catch (err) {
        console.warn('[AdsManager] Direct interstitial failed to show:', err);
        return false;
      }
    });
  }

  /**
   * Banners are permanently disabled so 100% of the screen stays clean for gameplay.
   */
  async showBanner(): Promise<void> {
    await this.hideBanner();
  }

  async hideBanner(): Promise<void> {
    if (!this.bannerVisible || !Capacitor.isNativePlatform()) {
      this.bannerVisible = false;
      return;
    }
    try {
      await AdMob.hideBanner();
      this.bannerVisible = false;
    } catch {
      this.bannerVisible = false;
    }
  }

  /**
   * Test helper to reset pacing timers between isolated unit tests.
   */
  resetPacingForTests(): void {
    this.lastInterstitialTimeMs = 0;
    this.lastRewardedTimeMs = 0;
    this.levelsSinceLastInterstitial = 99;
    this.isShowingAd = false;
  }

  /**
   * Browser / Dev Rewarded Video Simulation (supports Cancel button so reward only grants on completion)
   */
  private showWebMockRewarded(placement: RewardedPlacement): Promise<boolean> {
    return new Promise((resolve) => {
      if (typeof document === 'undefined') {
        this.totalRewardedWatched++;
        resolve(true);
        return;
      }

      const overlay = document.createElement('div');
      overlay.id = 'admob-web-mock-overlay';
      overlay.style.position = 'fixed';
      overlay.style.inset = '0';
      overlay.style.zIndex = '999999';
      overlay.style.backgroundColor = 'rgba(10, 14, 22, 0.94)';
      overlay.style.display = 'flex';
      overlay.style.flexDirection = 'column';
      overlay.style.alignItems = 'center';
      overlay.style.justifyContent = 'center';
      overlay.style.fontFamily = 'monospace';
      overlay.style.color = '#F3F4F6';
      overlay.style.padding = '24px';
      overlay.style.backdropFilter = 'blur(8px)';

      let secondsLeft = 3;
      const getTitle = () => {
        switch (placement) {
          case 'revive':
            return '⚡ EMERGENCY REVIVE: CLEAR 2 BOLTS + EXTRA SLOT';
          case 'extra_slot':
            return '🛠️ EXTRA DOCK SLOT: DRILLING +1 CAPACITY';
          case 'hammer_refill':
            return '🔨 MACHINIST HAMMERS: FORGING +2 HAMMERS';
          case 'autoplay_fuel':
            return '☢ AUTO-PLAY BOOST: CHARGING REACTOR TO 100%';
          case 'streak_doubler':
            return '🔥 DAILY STREAK: DOUBLING BONUS POINTS (2X)';
        }
      };

      overlay.innerHTML = `
        <div style="max-width: 480px; width: 100%; text-align: center; border: 2px solid #E0A234; border-radius: 14px; padding: 24px; background: #161D29; box-shadow: 0 12px 44px rgba(0,0,0,0.85);">
          <div style="font-size: 11px; letter-spacing: 2px; color: #E0A234; margin-bottom: 8px;">GOOGLE ADMOB REWARDED VIDEO</div>
          <div style="font-size: 16px; font-weight: bold; margin-bottom: 16px; color: #38BDF8;">${getTitle()}</div>
          <div style="width: 100%; height: 8px; background: #0B0E14; border-radius: 4px; overflow: hidden; margin-bottom: 16px;">
            <div id="mock-ad-progress" style="width: 33%; height: 100%; background: linear-gradient(90deg, #F59E0B, #10B981); transition: width 0.9s linear;"></div>
          </div>
          <div id="mock-ad-timer" style="font-size: 14px; color: #94A3B8; margin-bottom: 14px;">Reward unlocking in ${secondsLeft}s...</div>
          <button id="mock-ad-skip" style="background: transparent; border: 1px solid #475569; color: #94A3B8; border-radius: 8px; padding: 6px 14px; font-size: 12px; cursor: pointer;">Cancel (No Reward)</button>
        </div>
      `;

      document.body.appendChild(overlay);

      let settled = false;
      const cleanup = (earned: boolean) => {
        if (settled) return;
        settled = true;
        clearInterval(interval);
        if (overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
        if (earned) {
          this.totalRewardedWatched++;
          hapticsEngine.pulseLevelComplete();
        }
        resolve(earned);
      };

      const skipBtn = document.getElementById('mock-ad-skip');
      skipBtn?.addEventListener('click', () => cleanup(false));

      const interval = setInterval(() => {
        secondsLeft--;
        const timerElem = document.getElementById('mock-ad-timer');
        const progElem = document.getElementById('mock-ad-progress');
        if (timerElem) {
          timerElem.textContent = `Reward unlocking in ${secondsLeft}s...`;
        }
        if (progElem) {
          progElem.style.width = `${((4 - secondsLeft) / 3) * 100}%`;
        }
        if (secondsLeft <= 0) {
          cleanup(true);
        }
      }, 900);
    });
  }

  getState(): AdsManagerState {
    return {
      initialized: this.initialized,
      isTestingMode: USE_TEST_ADS,
      rewardedLoaded: this.rewardedLoaded,
      interstitialLoaded: this.interstitialLoaded,
      bannerVisible: this.bannerVisible,
      isShowingAd: this.isShowingAd,
      lastInterstitialTimeMs: this.lastInterstitialTimeMs,
      lastRewardedTimeMs: this.lastRewardedTimeMs,
      totalRewardedWatched: this.totalRewardedWatched,
      totalInterstitialsShown: this.totalInterstitialsShown,
      levelsSinceLastInterstitial: this.levelsSinceLastInterstitial,
    };
  }
}

export const adsManager = new AdsManager();
