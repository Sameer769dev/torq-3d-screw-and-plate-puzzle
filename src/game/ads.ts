/**
 * TORQ: 3D Screw & Plate Puzzle - AdMob Monetization Engine
 *
 * Implements high-eCPM rewarded video placements, paced level-transition interstitials,
 * and adaptive banner ads using @capacitor-community/admob.
 * Includes automatic background pre-loading, interstitial cooldown timers, and a
 * browser fallback overlay for desktop dev/testing.
 */

import { Capacitor } from '@capacitor/core';
import {
  AdMob,
  AdMobRewardItem,
  BannerAdOptions,
  BannerAdPosition,
  BannerAdSize,
  InterstitialAdPluginEvents,
  RewardAdPluginEvents,
} from '@capacitor-community/admob';
import { hapticsEngine } from './haptics';
import { analyticsManager } from './analytics';

// Official Google AdMob Production-Safe Test Ad Unit IDs
export const AD_UNIT_IDS = {
  android: {
    banner: 'ca-app-pub-3940256099942544/6300978111',
    interstitial: 'ca-app-pub-3940256099942544/1033173712',
    rewarded: 'ca-app-pub-3940256099942544/5224354917',
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
  rewardedLoaded: boolean;
  interstitialLoaded: boolean;
  bannerVisible: boolean;
  lastInterstitialTimeMs: number;
  totalRewardedWatched: number;
  totalInterstitialsShown: number;
}

class AdsManager {
  private initialized = false;
  private rewardedLoaded = false;
  private interstitialLoaded = false;
  private bannerVisible = false;
  private lastInterstitialTimeMs = 0;
  private totalRewardedWatched = 0;
  private totalInterstitialsShown = 0;
  private isLoadingRewarded = false;
  private isLoadingInterstitial = false;

  // Interstitial pacing: at least 100 seconds between interstitials, and only after FTUE completes (Level 10+)
  readonly MIN_INTERSTITIAL_COOLDOWN_MS = 100_000;
  readonly MIN_INTERSTITIAL_LEVEL_INDEX = 9;

  /**
   * Initializes Google AdMob SDK on native mobile platforms.
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
      await AdMob.initialize({
        testingDevices: ['EMULATOR'],
        initializeForTesting: true,
      });

      this.setupEventListeners();
      this.initialized = true;

      // Preload first batch of ads
      this.preloadRewarded();
      this.preloadInterstitial();
    } catch (err) {
      console.warn('[AdsManager] AdMob initialization failed:', err);
      // Still set initialized so fallbacks can work gracefully
      this.initialized = true;
      this.rewardedLoaded = true;
      this.interstitialLoaded = true;
    }
  }

  private setupEventListeners(): void {
    AdMob.addListener(RewardAdPluginEvents.Loaded, () => {
      this.rewardedLoaded = true;
      this.isLoadingRewarded = false;
    });

    AdMob.addListener(RewardAdPluginEvents.FailedToLoad, (info) => {
      console.warn('[AdsManager] Rewarded ad failed to load:', info);
      this.rewardedLoaded = false;
      this.isLoadingRewarded = false;
    });

    AdMob.addListener(RewardAdPluginEvents.Dismissed, () => {
      this.rewardedLoaded = false;
      // Pre-load next rewarded ad immediately
      setTimeout(() => this.preloadRewarded(), 1500);
    });

    AdMob.addListener(InterstitialAdPluginEvents.Loaded, () => {
      this.interstitialLoaded = true;
      this.isLoadingInterstitial = false;
    });

    AdMob.addListener(InterstitialAdPluginEvents.FailedToLoad, (info) => {
      console.warn('[AdsManager] Interstitial ad failed to load:', info);
      this.interstitialLoaded = false;
      this.isLoadingInterstitial = false;
    });

    AdMob.addListener(InterstitialAdPluginEvents.Dismissed, () => {
      this.interstitialLoaded = false;
      this.lastInterstitialTimeMs = Date.now();
      // Pre-load next interstitial after cooldown
      setTimeout(() => this.preloadInterstitial(), 3000);
    });
  }

  async preloadRewarded(): Promise<void> {
    if (!Capacitor.isNativePlatform() || this.rewardedLoaded || this.isLoadingRewarded) return;
    this.isLoadingRewarded = true;
    try {
      await AdMob.prepareRewardVideoAd({
        adId: AD_UNIT_IDS.android.rewarded,
        isTesting: true,
      });
    } catch (err) {
      this.isLoadingRewarded = false;
      console.warn('[AdsManager] Failed preparing rewarded ad:', err);
    }
  }

  async preloadInterstitial(): Promise<void> {
    if (!Capacitor.isNativePlatform() || this.interstitialLoaded || this.isLoadingInterstitial) return;
    this.isLoadingInterstitial = true;
    try {
      await AdMob.prepareInterstitial({
        adId: AD_UNIT_IDS.android.interstitial,
        isTesting: true,
      });
    } catch (err) {
      this.isLoadingInterstitial = false;
      console.warn('[AdsManager] Failed preparing interstitial:', err);
    }
  }

  /**
   * Shows a rewarded video ad for a specific in-game reward placement.
   * Resolves to true if the player watched the full video and earned the reward.
   */
  async showRewarded(placement: RewardedPlacement): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
      return this.showWebMockRewarded(placement);
    }

    try {
      if (!this.rewardedLoaded) {
        await this.preloadRewarded();
      }

      let rewardEarned = false;
      const rewardListener = await AdMob.addListener(
        RewardAdPluginEvents.Rewarded,
        (reward: AdMobRewardItem) => {
          rewardEarned = true;
        }
      );

      await AdMob.showRewardVideoAd();
      rewardListener.remove();

      if (rewardEarned) {
        this.totalRewardedWatched++;
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
      console.warn('[AdsManager] Error showing rewarded ad, attempting fallback:', err);
      // Fallback: allow player to still enjoy reward in case of ad network timeout
      return this.showWebMockRewarded(placement);
    }
  }

  /**
   * Checks pacing & FTUE eligibility before showing an interstitial ad between level completions.
   * Zero interstitials run before FTUE complete or during Session 1.
   */
  async showLevelCompleteInterstitial(
    levelIndex: number,
    ftueContext?: { completed: boolean; sessionCount: number }
  ): Promise<boolean> {
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

    const elapsedMs = Date.now() - this.lastInterstitialTimeMs;
    if (elapsedMs < this.MIN_INTERSTITIAL_COOLDOWN_MS) {
      // Cooldown not yet reached
      return false;
    }

    if (!Capacitor.isNativePlatform()) {
      this.lastInterstitialTimeMs = Date.now();
      this.totalInterstitialsShown++;
      analyticsManager.logEvent('ad_impression', {
        ad_type: 'interstitial',
        level_index: levelIndex,
        blocked_by_ftue: false,
      });
      return true;
    }

    try {
      if (!this.interstitialLoaded) {
        await this.preloadInterstitial();
      }
      await AdMob.showInterstitial();
      this.lastInterstitialTimeMs = Date.now();
      this.totalInterstitialsShown++;
      analyticsManager.logEvent('ad_impression', {
        ad_type: 'interstitial',
        level_index: levelIndex,
        blocked_by_ftue: false,
      });
      return true;
    } catch (err) {
      console.warn('[AdsManager] Interstitial failed to show:', err);
      return false;
    }
  }

  /**
   * Directly triggers an AdMob interstitial test ad (used by native test ad billboard clicks or preview).
   */
  async showInterstitial(force: boolean = true): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
      this.lastInterstitialTimeMs = Date.now();
      this.totalInterstitialsShown++;
      return true;
    }

    try {
      if (!this.interstitialLoaded) {
        await this.preloadInterstitial();
      }
      await AdMob.showInterstitial();
      this.lastInterstitialTimeMs = Date.now();
      this.totalInterstitialsShown++;
      return true;
    } catch (err) {
      console.warn('[AdsManager] Direct interstitial failed to show:', err);
      return false;
    }
  }

  /**
   * Bottom banner ads are disabled per design in favor of the two 3D diegetic
   * native ad billboards flanking the workbench on left and right empty spaces.
   */
  async showBanner(): Promise<void> {
    await this.hideBanner();
  }

  /**
   * Hides the banner ad.
   */
  async hideBanner(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      this.bannerVisible = false;
      return;
    }
    try {
      await AdMob.hideBanner();
      this.bannerVisible = false;
    } catch {
      // Banner might not be loaded, ignore
      this.bannerVisible = false;
    }
  }

  /**
   * Browser / Dev Mock Rewarded Video Simulation
   */
  private showWebMockRewarded(placement: RewardedPlacement): Promise<boolean> {
    return new Promise((resolve) => {
      if (typeof document === 'undefined') {
        resolve(true);
        return;
      }

      const overlay = document.createElement('div');
      overlay.id = 'admob-web-mock-overlay';
      overlay.style.position = 'fixed';
      overlay.style.inset = '0';
      overlay.style.zIndex = '999999';
      overlay.style.backgroundColor = 'rgba(10, 14, 22, 0.96)';
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
            return '⚡ EMERGENCY REVIVE: WATCHING SPONSOR AD...';
          case 'extra_slot':
            return '🛠️ DRILLING EXTRA DOCK SLOT: WATCHING SPONSOR AD...';
          case 'hammer_refill':
            return '🔨 FORGING +1 MACHINIST HAMMER: WATCHING SPONSOR AD...';
          case 'autoplay_fuel':
            return '🧪 FILLING RADIOACTIVE AUTO-PLAY FUEL: WATCHING SPONSOR AD...';
          case 'streak_doubler':
            return '🔥 DOUBLING DAILY STREAK XP: WATCHING SPONSOR AD...';
        }
      };

      overlay.innerHTML = `
        <div style="max-width: 480px; width: 100%; text-align: center; border: 2px solid #E0A234; border-radius: 12px; padding: 24px; background: #161D29; box-shadow: 0 10px 40px rgba(0,0,0,0.8);">
          <div style="font-size: 11px; letter-spacing: 2px; color: #E0A234; margin-bottom: 8px;">GOOGLE ADMOB REWARDED VIDEO (SIMULATION)</div>
          <div style="font-size: 16px; font-weight: bold; margin-bottom: 16px; color: #38BDF8;">${getTitle()}</div>
          <div style="width: 100%; height: 8px; background: #0B0E14; border-radius: 4px; overflow: hidden; margin-bottom: 16px;">
            <div id="mock-ad-progress" style="width: 33%; height: 100%; background: linear-gradient(90deg, #F59E0B, #10B981); transition: width 1s linear;"></div>
          </div>
          <div id="mock-ad-timer" style="font-size: 14px; color: #94A3B8;">Reward unlocking in ${secondsLeft}s...</div>
        </div>
      `;

      document.body.appendChild(overlay);

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
          clearInterval(interval);
          if (overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
          }
          this.totalRewardedWatched++;
          hapticsEngine.pulseLevelComplete();
          resolve(true);
        }
      }, 900);
    });
  }

  getState(): AdsManagerState {
    return {
      initialized: this.initialized,
      rewardedLoaded: this.rewardedLoaded,
      interstitialLoaded: this.interstitialLoaded,
      bannerVisible: this.bannerVisible,
      lastInterstitialTimeMs: this.lastInterstitialTimeMs,
      totalRewardedWatched: this.totalRewardedWatched,
      totalInterstitialsShown: this.totalInterstitialsShown,
    };
  }
}

export const adsManager = new AdsManager();
