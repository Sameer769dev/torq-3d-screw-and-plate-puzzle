import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

/**
 * Mobile Haptic Vibration Feedback System using Capacitor Native Haptics
 * with graceful fallback to Web Vibration API (`Navigator.vibrate`).
 * Provides distinct tactile mechanical pulse patterns for unscrewing bolts, plate drops,
 * target tray completions, blocked bolt clanks, 3D button presses, and stage completions.
 */

export type VibrationPattern = number | number[];

export const HAPTIC_PATTERNS = {
  buttonTap: 10,
  unscrewDock: 18,
  unscrewMatch: [14, 24, 22],
  hammerStrike: [42, 22, 55],
  blocked: [28, 35, 28],
  plateDrop: [32, 25, 45],
  boxComplete: [18, 28, 22, 28, 36],
  levelComplete: [30, 45, 30, 45, 60, 50, 95],
  defeat: [65, 55, 85],
} as const;

export class HapticsEngine {
  public enabled: boolean = true;
  private customVibrateFn: ((pattern: VibrationPattern) => boolean) | null = null;

  constructor(customVibrateFn?: (pattern: VibrationPattern) => boolean) {
    if (customVibrateFn) {
      this.customVibrateFn = customVibrateFn;
    }
  }

  /**
   * Checks whether the current device/browser supports vibration or Capacitor haptics
   */
  public isSupported(): boolean {
    if (this.customVibrateFn) return true;
    if (Capacitor.isNativePlatform()) return true;
    return (
      typeof navigator !== 'undefined' &&
      typeof navigator.vibrate === 'function'
    );
  }

  /**
   * Core safe wrapper around native haptics or navigator.vibrate()
   */
  public vibrate(pattern: VibrationPattern): boolean {
    if (!this.enabled) return false;
    try {
      if (this.customVibrateFn) {
        return this.customVibrateFn(pattern);
      }
      if (Capacitor.isNativePlatform()) {
        const dur = Array.isArray(pattern) ? (pattern[0] ?? 20) : pattern;
        Haptics.vibrate({ duration: dur }).catch(() => {});
        return true;
      }
      if (
        typeof navigator !== 'undefined' &&
        typeof navigator.vibrate === 'function'
      ) {
        return navigator.vibrate(pattern);
      }
    } catch {
      // Ignore errors in restricted iframe or desktop contexts
    }
    return false;
  }

  /**
   * Short 10ms tactile tick when pressing a 3D mechanical button
   */
  public pulseButtonTap(): boolean {
    if (!this.enabled) return false;
    if (Capacitor.isNativePlatform() && !this.customVibrateFn) {
      Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
      return true;
    }
    return this.vibrate(HAPTIC_PATTERNS.buttonTap);
  }

  /**
   * Short haptic pulse when a screw is unscrewed (ratchet + snap when matched to a target box,
   * or crisp single pulse when placed in the spare dock)
   */
  public pulseUnscrew(matched: boolean): boolean {
    if (!this.enabled) return false;
    if (Capacitor.isNativePlatform() && !this.customVibrateFn) {
      Haptics.impact({
        style: matched ? ImpactStyle.Medium : ImpactStyle.Light,
      }).catch(() => {});
      return true;
    }
    return this.vibrate(
      matched
        ? [...HAPTIC_PATTERNS.unscrewMatch]
        : HAPTIC_PATTERNS.unscrewDock
    );
  }

  /**
   * Heavy impact haptic pulse when smashing and removing a bolt with the 3D Hammer
   */
  public pulseHammerStrike(): boolean {
    if (!this.enabled) return false;
    if (Capacitor.isNativePlatform() && !this.customVibrateFn) {
      Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {});
      return true;
    }
    return this.vibrate([...HAPTIC_PATTERNS.hammerStrike]);
  }

  /**
   * Double-stutter haptic feedback when a screw is blocked by an overlapping plate
   */
  public pulseBlocked(): boolean {
    if (!this.enabled) return false;
    if (Capacitor.isNativePlatform() && !this.customVibrateFn) {
      Haptics.notification({ type: NotificationType.Warning }).catch(() => {});
      return true;
    }
    return this.vibrate([...HAPTIC_PATTERNS.blocked]);
  }

  /**
   * Heavy mechanical thud when a plate detaches and drops off the board
   */
  public pulsePlateDrop(): boolean {
    if (!this.enabled) return false;
    if (Capacitor.isNativePlatform() && !this.customVibrateFn) {
      Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {});
      return true;
    }
    return this.vibrate([...HAPTIC_PATTERNS.plateDrop]);
  }

  /**
   * Triple lock-in pulse when a 3-bolt Target Collector Tray is filled and sealed
   */
  public pulseBoxComplete(): boolean {
    if (!this.enabled) return false;
    if (Capacitor.isNativePlatform() && !this.customVibrateFn) {
      Haptics.notification({ type: NotificationType.Success }).catch(() => {});
      return true;
    }
    return this.vibrate([...HAPTIC_PATTERNS.boxComplete]);
  }

  /**
   * Celebratory multi-pulse vibration pattern when a level is completed
   */
  public pulseLevelComplete(): boolean {
    if (!this.enabled) return false;
    if (Capacitor.isNativePlatform() && !this.customVibrateFn) {
      Haptics.notification({ type: NotificationType.Success }).catch(() => {});
      return true;
    }
    return this.vibrate([...HAPTIC_PATTERNS.levelComplete]);
  }

  /**
   * Low double buzz when the spare holding dock overflows
   */
  public pulseDefeat(): boolean {
    if (!this.enabled) return false;
    if (Capacitor.isNativePlatform() && !this.customVibrateFn) {
      Haptics.notification({ type: NotificationType.Error }).catch(() => {});
      return true;
    }
    return this.vibrate([...HAPTIC_PATTERNS.defeat]);
  }

  /**
   * Cancels any ongoing vibration
   */
  public stop(): void {
    try {
      if (this.customVibrateFn) {
        this.customVibrateFn(0);
        return;
      }
      if (
        typeof navigator !== 'undefined' &&
        typeof navigator.vibrate === 'function'
      ) {
        navigator.vibrate(0);
      }
    } catch {
      // Ignore
    }
  }
}

export const hapticsEngine = new HapticsEngine();
