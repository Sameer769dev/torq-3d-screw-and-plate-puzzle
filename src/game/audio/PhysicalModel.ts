import { PlateMaterialType } from '../types';
import { NoiseGenerator } from './NoiseGenerator';

export type AcousticMaterial = 'steel' | 'brass' | 'titanium' | 'acrylic';

interface MaterialModalProfile {
  ratios: number[];
  amps: number[];
  decayScales: number[];
  clickBrightnessHz: number;
}

const MATERIAL_PROFILES: Record<AcousticMaterial, MaterialModalProfile> = {
  steel: {
    ratios: [1.0, 1.58, 2.24, 2.91],
    amps: [1.0, 0.56, 0.34, 0.18],
    decayScales: [1.0, 0.72, 0.48, 0.32],
    clickBrightnessHz: 3200,
  },
  brass: {
    ratios: [1.0, 1.41, 1.93, 2.68, 3.42],
    amps: [1.0, 0.62, 0.44, 0.25, 0.14],
    decayScales: [1.0, 0.85, 0.64, 0.45, 0.3],
    clickBrightnessHz: 2600,
  },
  titanium: {
    ratios: [1.0, 1.49, 2.13, 3.17],
    amps: [1.0, 0.48, 0.28, 0.14],
    decayScales: [1.0, 0.66, 0.44, 0.28],
    clickBrightnessHz: 3600,
  },
  acrylic: {
    ratios: [1.0, 1.72, 2.84],
    amps: [1.0, 0.52, 0.22],
    decayScales: [1.0, 0.45, 0.25],
    clickBrightnessHz: 2100,
  },
};

export function plateMaterialToAcoustic(material?: PlateMaterialType): AcousticMaterial {
  switch (material) {
    case 'brushed-brass':
      return 'brass';
    case 'blued-steel':
      return 'steel';
    case 'anodized-slate':
      return 'titanium';
    case 'acrylic-cyan':
    case 'acrylic-amber':
    case 'acrylic-rose':
      return 'acrylic';
    default:
      return 'steel';
  }
}

export function organicJitter(spread = 0.028): number {
  return 1 + (Math.random() * 2 - 1) * spread;
}

/**
 * Fires an inharmonic physical modal strike (metallic tine, plate, bell, or forged bar).
 * Higher vibrational modes damp proportionally faster than the fundamental.
 */
export function triggerModalImpact(
  ctx: AudioContext,
  dest: AudioNode,
  noise: NoiseGenerator,
  opts: {
    startTime: number;
    baseFreq: number;
    material: AcousticMaterial;
    duration: number;
    gain: number;
    pitchBendRatio?: number;
    strikeMix?: number;
    pan?: number;
  }
): void {
  const profile = MATERIAL_PROFILES[opts.material];
  const bend = opts.pitchBendRatio ?? 1.0;

  let outNode: AudioNode = dest;
  if (
    typeof opts.pan === 'number' &&
    Math.abs(opts.pan) > 0.01 &&
    typeof ctx.createStereoPanner === 'function'
  ) {
    const panner = ctx.createStereoPanner();
    panner.pan.setValueAtTime(Math.max(-1, Math.min(1, opts.pan)), opts.startTime);
    panner.connect(dest);
    outNode = panner;
  }

  // Microscopic striker hardness impact grain
  const strikeMix = opts.strikeMix ?? 0.55;
  if (strikeMix > 0) {
    noise.triggerGrain(ctx, outNode, 'velvet', {
      startTime: opts.startTime,
      duration: 0.014,
      gain: opts.gain * 0.45 * strikeMix,
      filterType: 'bandpass',
      freqStart: profile.clickBrightnessHz * organicJitter(0.05),
      freqEnd: profile.clickBrightnessHz * 0.6,
      q: 2.8,
      attackSec: 0.001,
    });
  }

  profile.ratios.forEach((ratio, idx) => {
    const freq = opts.baseFreq * ratio;
    if (freq > ctx.sampleRate * 0.44) return;

    const modeDur = Math.max(0.028, opts.duration * profile.decayScales[idx]);
    const osc = ctx.createOscillator();
    const env = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, opts.startTime);
    if (Math.abs(bend - 1.0) > 0.005) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(40, freq * bend),
        opts.startTime + modeDur * 0.85
      );
    }

    const modeGain = Math.max(0.001, opts.gain * profile.amps[idx] * 0.48);
    env.gain.setValueAtTime(0.0001, opts.startTime);
    env.gain.linearRampToValueAtTime(modeGain, opts.startTime + 0.002);
    env.gain.exponentialRampToValueAtTime(0.0001, opts.startTime + modeDur);

    osc.connect(env);
    env.connect(outNode);
    osc.start(opts.startTime);
    osc.stop(opts.startTime + modeDur + 0.015);
  });
}

/**
 * Crisp dry physical click / gear tooth engagement / microswitch detent.
 * Pairs a bandpass-filtered velvet impulse with a short damped cavity pop.
 */
export function triggerMechanicalClick(
  ctx: AudioContext,
  dest: AudioNode,
  noise: NoiseGenerator,
  opts: {
    startTime: number;
    clickFreq: number;
    cavityFreq: number;
    duration?: number;
    gain: number;
    q?: number;
    pan?: number;
  }
): void {
  const dur = Math.max(0.008, opts.duration ?? 0.018);

  noise.triggerGrain(ctx, dest, 'velvet', {
    startTime: opts.startTime,
    duration: dur,
    gain: opts.gain * 0.9,
    filterType: 'bandpass',
    freqStart: opts.clickFreq,
    freqEnd: opts.clickFreq * 0.58,
    q: opts.q ?? 4.2,
    attackSec: 0.001,
    pan: opts.pan,
  });

  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(opts.cavityFreq, opts.startTime);
  osc.frequency.exponentialRampToValueAtTime(
    Math.max(55, opts.cavityFreq * 0.42),
    opts.startTime + dur
  );

  env.gain.setValueAtTime(Math.max(0.001, opts.gain * 0.55), opts.startTime);
  env.gain.exponentialRampToValueAtTime(0.0001, opts.startTime + dur);

  osc.connect(env);
  env.connect(dest);
  osc.start(opts.startTime);
  osc.stop(opts.startTime + dur + 0.008);
}

/**
 * Punchy physical chassis/anvil thump tuned with audible mid-bass harmonic weight
 * so low impacts read loudly through both phone speakers and headphones.
 */
export function triggerBodyThump(
  ctx: AudioContext,
  dest: AudioNode,
  noise: NoiseGenerator,
  opts: {
    startTime: number;
    startFreq: number;
    endFreq: number;
    duration: number;
    gain: number;
    noiseCutHz?: number;
    pan?: number;
  }
): void {
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(Math.max(45, opts.startFreq), opts.startTime);
  osc.frequency.exponentialRampToValueAtTime(
    Math.max(36, opts.endFreq),
    opts.startTime + opts.duration * 0.65
  );

  env.gain.setValueAtTime(0.0001, opts.startTime);
  env.gain.linearRampToValueAtTime(Math.max(0.001, opts.gain), opts.startTime + 0.003);
  env.gain.exponentialRampToValueAtTime(0.0001, opts.startTime + opts.duration);

  osc.connect(env);
  env.connect(dest);
  osc.start(opts.startTime);
  osc.stop(opts.startTime + opts.duration + 0.015);

  noise.triggerGrain(ctx, dest, 'pink', {
    startTime: opts.startTime,
    duration: Math.min(0.06, opts.duration * 0.6),
    gain: opts.gain * 0.48,
    filterType: 'lowpass',
    freqStart: opts.noiseCutHz ?? 420,
    freqEnd: 110,
    q: 1.2,
    attackSec: 0.002,
    pan: opts.pan,
  });
}

/**
 * Pressurized air release / vacuum suction seal / sliding metal mechanism sweep.
 */
export function triggerPneumaticAir(
  ctx: AudioContext,
  dest: AudioNode,
  noise: NoiseGenerator,
  opts: {
    startTime: number;
    duration: number;
    freqStart: number;
    freqEnd: number;
    gain: number;
    q?: number;
    pan?: number;
  }
): void {
  noise.triggerGrain(ctx, dest, 'pink', {
    startTime: opts.startTime,
    duration: opts.duration,
    gain: opts.gain,
    filterType: 'bandpass',
    freqStart: opts.freqStart,
    freqEnd: opts.freqEnd,
    q: opts.q ?? 1.8,
    attackSec: Math.min(0.015, opts.duration * 0.25),
    pan: opts.pan,
  });
}

/**
 * Inharmonic FM electromagnetic actuator pulse (servo whine, coil lock, magnetic latch).
 */
export function triggerFmCoilPulse(
  ctx: AudioContext,
  dest: AudioNode,
  opts: {
    startTime: number;
    carrierStart: number;
    carrierEnd: number;
    modRatio: number;
    modDepthStart: number;
    duration: number;
    gain: number;
  }
): void {
  const carrier = ctx.createOscillator();
  const mod = ctx.createOscillator();
  const modGain = ctx.createGain();
  const outGain = ctx.createGain();

  carrier.type = 'sine';
  carrier.frequency.setValueAtTime(opts.carrierStart, opts.startTime);
  carrier.frequency.exponentialRampToValueAtTime(
    Math.max(50, opts.carrierEnd),
    opts.startTime + opts.duration
  );

  mod.type = 'sine';
  mod.frequency.setValueAtTime(opts.carrierStart * opts.modRatio, opts.startTime);
  mod.frequency.exponentialRampToValueAtTime(
    Math.max(40, opts.carrierEnd * opts.modRatio),
    opts.startTime + opts.duration
  );

  modGain.gain.setValueAtTime(opts.modDepthStart, opts.startTime);
  modGain.gain.exponentialRampToValueAtTime(8, opts.startTime + opts.duration);

  outGain.gain.setValueAtTime(0.0001, opts.startTime);
  outGain.gain.linearRampToValueAtTime(Math.max(0.001, opts.gain), opts.startTime + 0.003);
  outGain.gain.exponentialRampToValueAtTime(0.0001, opts.startTime + opts.duration);

  mod.connect(modGain);
  modGain.connect(carrier.frequency);
  carrier.connect(outGain);
  outGain.connect(dest);

  mod.start(opts.startTime);
  carrier.start(opts.startTime);
  mod.stop(opts.startTime + opts.duration + 0.015);
  carrier.stop(opts.startTime + opts.duration + 0.015);
}

