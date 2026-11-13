// Procedural Physical-Modeling Web Audio Synthesizer with Multi-Pack Mechanical Soundscape Engine
// Models stick-slip friction, pneumatic exhaust, inharmonic metallic resonators & transformer warmth.

import { PlateMaterialType } from './types';
import { AudioContextManager } from './audio/AudioContextManager';
import { NoiseGenerator } from './audio/NoiseGenerator';
import {
  renderBlocked,
  renderBoxComplete,
  renderButtonClick,
  renderDefeat,
  renderHammerStrike,
  renderPackPreview,
  renderPlateDrop,
  renderToolActivate,
  renderUiConfirm,
  renderUnscrew,
  renderVictory,
  WorkbenchToolAudioEvent,
} from './audio/SoundscapeProfiles';

export type SoundscapePackId = 'industrial' | 'cybernetic' | 'clockwork';
export type { WorkbenchToolAudioEvent };

export interface SoundscapePackMeta {
  id: SoundscapePackId;
  name: string;
  shortCode: string;
  tagline: string;
  description: string;
  accentHex: string;
  secondaryHex: string;
  waveformTag: string;
  baseFreqHz: number;
  specBars: [number, number, number, number, number, number, number, number];
}

export const SOUNDSCAPE_PACK_ORDER: SoundscapePackId[] = [
  'industrial',
  'cybernetic',
  'clockwork',
];

export const SOUNDSCAPE_PACKS: Record<SoundscapePackId, SoundscapePackMeta> = {
  industrial: {
    id: 'industrial',
    name: 'Industrial Factory',
    shortCode: 'IND',
    tagline: 'PNEUMATIC & ANVIL',
    description:
      'Pneumatic impact ratchet, pressurized air exhaust, steel forge anvil & hydraulic locks.',
    accentHex: '#F59E0B',
    secondaryHex: '#FDE047',
    waveformTag: 'VELVET / STEEL',
    baseFreqHz: 420,
    specBars: [0.92, 0.85, 0.74, 0.62, 0.78, 0.54, 0.42, 0.32],
  },
  cybernetic: {
    id: 'cybernetic',
    name: 'Cybernetic Tech',
    shortCode: 'CYB',
    tagline: 'MAG-RAIL & SERVO',
    description:
      'Linear stepper actuator ticks, inharmonic induction coils & cryo-solenoid rail locks.',
    accentHex: '#06B6D4',
    secondaryHex: '#67E8F9',
    waveformTag: 'COIL FM / TITANIUM',
    baseFreqHz: 680,
    specBars: [0.48, 0.72, 0.96, 0.64, 0.88, 0.94, 0.78, 0.91],
  },
  clockwork: {
    id: 'clockwork',
    name: 'Vintage Clockwork',
    shortCode: 'CLK',
    tagline: 'ESCAPEMENT & BRASS',
    description:
      'Swiss ruby escapement ticks, coiled mainspring ratchets & antique brass carillon tines.',
    accentHex: '#FACC15',
    secondaryHex: '#FEF08A',
    waveformTag: 'ESCAPEMENT / BRASS',
    baseFreqHz: 528,
    specBars: [0.35, 0.58, 0.86, 0.95, 0.82, 0.68, 0.88, 0.64],
  },
};

export interface SoundSettingsState {
  activePack: SoundscapePackId;
  packName: string;
  shortCode: string;
  tagline: string;
  accentHex: string;
  waveformTag: string;
  muted: boolean;
  volume: number;
  volumePercent: number;
  previewCount: number;
  lastPlayedEvent: string | null;
}

const STORAGE_KEY = 'torq_sound_settings_v1';
const VOLUME_STEPS = [0.25, 0.5, 0.75, 1.0];

export function isValidSoundscapePackId(val: unknown): val is SoundscapePackId {
  return val === 'industrial' || val === 'cybernetic' || val === 'clockwork';
}

export class SoundEngine {
  private readonly ctxManager = new AudioContextManager();
  private readonly noise = new NoiseGenerator();

  public muted: boolean = false;
  public volume: number = 0.85;
  public activePack: SoundscapePackId = 'industrial';
  public previewCount: number = 0;
  public lastPlayedEvent: string | null = null;

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<{
        activePack: SoundscapePackId;
        muted: boolean;
        volume: number;
      }>;
      if (isValidSoundscapePackId(parsed.activePack)) {
        this.activePack = parsed.activePack;
      }
      if (typeof parsed.muted === 'boolean') {
        this.muted = parsed.muted;
      }
      if (typeof parsed.volume === 'number' && Number.isFinite(parsed.volume)) {
        this.volume = Math.max(0.1, Math.min(1.0, parsed.volume));
      }
    } catch {
      // Ignore storage access errors in restricted environments
    }
  }

  private saveToStorage(): void {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          activePack: this.activePack,
          muted: this.muted,
          volume: this.volume,
        })
      );
    } catch {
      // Ignore storage access errors
    }
  }

  private getBus() {
    return this.ctxManager.getMasterBus(this.muted);
  }

  /**
   * Warms up and unlocks Web Audio AudioContext on first touch / mobile user gestures.
   */
  public unlock(): void {
    if (this.muted || typeof window === 'undefined') return;
    try {
      this.ctxManager.unlock(this.muted);
      const bus = this.getBus();
      if (bus) {
        // Pre-warm procedural noise buffers during first user gesture
        this.noise.getBuffer(bus.ctx, 'velvet');
        this.noise.getBuffer(bus.ctx, 'pink');
      }
    } catch {
      // Ignore unlock errors before user interaction
    }
  }

  public getPack(): SoundscapePackId {
    return this.activePack;
  }

  public getPackMeta(packId: SoundscapePackId = this.activePack): SoundscapePackMeta {
    return SOUNDSCAPE_PACKS[packId] ?? SOUNDSCAPE_PACKS.industrial;
  }

  public getState(): SoundSettingsState {
    const meta = this.getPackMeta();
    return {
      activePack: this.activePack,
      packName: meta.name,
      shortCode: meta.shortCode,
      tagline: meta.tagline,
      accentHex: meta.accentHex,
      waveformTag: meta.waveformTag,
      muted: this.muted,
      volume: Number(this.volume.toFixed(2)),
      volumePercent: Math.round(this.volume * 100),
      previewCount: this.previewCount,
      lastPlayedEvent: this.lastPlayedEvent,
    };
  }

  public setPack(
    packId: SoundscapePackId,
    playPreview = true
  ): SoundSettingsState {
    if (isValidSoundscapePackId(packId)) {
      this.activePack = packId;
      this.saveToStorage();
      if (playPreview) {
        this.playPackPreview(packId);
      }
    }
    return this.getState();
  }

  public cyclePack(playPreview = true): SoundSettingsState {
    const idx = SOUNDSCAPE_PACK_ORDER.indexOf(this.activePack);
    const nextPack =
      SOUNDSCAPE_PACK_ORDER[(idx + 1) % SOUNDSCAPE_PACK_ORDER.length];
    return this.setPack(nextPack, playPreview);
  }

  public setVolume(vol: number, playPreview = false): SoundSettingsState {
    const clamped = Math.max(0.1, Math.min(1.0, vol));
    this.volume = clamped;
    if (this.muted && clamped > 0) {
      this.muted = false;
    }
    this.saveToStorage();
    if (playPreview) {
      this.playPackPreview(this.activePack);
    }
    return this.getState();
  }

  public cycleVolume(playPreview = true): SoundSettingsState {
    let nextVol = VOLUME_STEPS[0];
    for (const step of VOLUME_STEPS) {
      if (step > this.volume + 0.04) {
        nextVol = step;
        break;
      }
    }
    return this.setVolume(nextVol, playPreview);
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    this.saveToStorage();
    return this.muted;
  }

  public setMuted(muted: boolean): SoundSettingsState {
    this.muted = muted;
    this.saveToStorage();
    return this.getState();
  }

  /**
   * Auditions the selected mechanical soundscape pack with a physical 2-stage mechanical motif.
   */
  public playPackPreview(packId: SoundscapePackId = this.activePack): void {
    this.previewCount += 1;
    this.lastPlayedEvent = `preview:${packId}`;
    const bus = this.getBus();
    if (!bus) return;
    renderPackPreview(bus.ctx, bus.input, this.noise, packId, this.volume);
  }

  /**
   * 3-phase mechanical extraction: break-torque crack -> ratchet spin -> socket dock / harmonic lock.
   */
  public playUnscrew(matched: boolean, combo = 1): void {
    this.lastPlayedEvent = `unscrew:${this.activePack}:${matched ? 'match' : 'dock'}`;
    const bus = this.getBus();
    if (!bus) return;
    renderUnscrew(
      bus.ctx,
      bus.input,
      this.noise,
      this.activePack,
      matched,
      combo,
      this.volume
    );
  }

  /**
   * Pure mechanical resistance clank & plate chatter when tapping a bolt trapped beneath a higher plate.
   */
  public playBlocked(): void {
    this.lastPlayedEvent = `blocked:${this.activePack}`;
    const bus = this.getBus();
    if (!bus) return;
    renderBlocked(bus.ctx, bus.input, this.noise, this.activePack, this.volume);
  }

  /**
   * Kinetic anvil/rail strike + metallic fracture + steel ringdown when smashing a bolt.
   */
  public playHammerStrike(): void {
    this.lastPlayedEvent = `hammer:${this.activePack}`;
    const bus = this.getBus();
    if (!bus) return;
    renderHammerStrike(bus.ctx, bus.input, this.noise, this.activePack, this.volume);
  }

  /**
   * Material-aware plate detachment air whoosh + dual workbench impact bounce.
   */
  public playPlateDrop(plateMaterial?: PlateMaterialType): void {
    this.lastPlayedEvent = `plate-drop:${this.activePack}`;
    const bus = this.getBus();
    if (!bus) return;
    renderPlateDrop(
      bus.ctx,
      bus.input,
      this.noise,
      this.activePack,
      plateMaterial,
      this.volume
    );
  }

  /**
   * Target Box 3/3 seal: brushed cover slide + pneumatic snap + resonant bar triad.
   */
  public playBoxComplete(): void {
    this.lastPlayedEvent = `box-complete:${this.activePack}`;
    const bus = this.getBus();
    if (!bus) return;
    renderBoxComplete(bus.ctx, bus.input, this.noise, this.activePack, this.volume);
  }

  /**
   * Tactile Omron microswitch click (down) and spring return clack (up) for 3D UI push-buttons.
   */
  public playButtonClick(down = true): void {
    this.lastPlayedEvent = `button-${down ? 'down' : 'up'}:${this.activePack}`;
    const bus = this.getBus();
    if (!bus) return;
    renderButtonClick(bus.ctx, bus.input, this.noise, this.activePack, down, this.volume);
  }

  /**
   * Distinct mechanical actuation SFX for workbench power-ups and hardware controls.
   */
  public playToolActivate(tool: WorkbenchToolAudioEvent): void {
    this.lastPlayedEvent = `tool-${tool}:${this.activePack}`;
    const bus = this.getBus();
    if (!bus) return;
    renderToolActivate(bus.ctx, bus.input, this.noise, this.activePack, tool, this.volume);
  }

  /**
   * Crisp mechanical confirmation chime for cloud syncs, daily streak & ad rewards.
   */
  public playUiConfirm(): void {
    this.lastPlayedEvent = `ui-confirm:${this.activePack}`;
    const bus = this.getBus();
    if (!bus) return;
    renderUiConfirm(bus.ctx, bus.input, this.noise, this.activePack, this.volume);
  }

  public playVictory(): void {
    this.lastPlayedEvent = `victory:${this.activePack}`;
    const bus = this.getBus();
    if (!bus) return;
    renderVictory(bus.ctx, bus.input, this.noise, this.activePack, this.volume);
  }

  public playDefeat(): void {
    this.lastPlayedEvent = `defeat:${this.activePack}`;
    const bus = this.getBus();
    if (!bus) return;
    renderDefeat(bus.ctx, bus.input, this.noise, this.activePack, this.volume);
  }
}

export const soundEngine = new SoundEngine();
