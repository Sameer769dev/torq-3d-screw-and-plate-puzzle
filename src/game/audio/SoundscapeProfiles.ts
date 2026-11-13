import { PlateMaterialType } from '../types';
import type { SoundscapePackId } from '../sound';
import { NoiseGenerator } from './NoiseGenerator';
import {
  AcousticMaterial,
  organicJitter,
  plateMaterialToAcoustic,
  triggerBodyThump,
  triggerFmCoilPulse,
  triggerMechanicalClick,
  triggerModalImpact,
  triggerPneumaticAir,
} from './PhysicalModel';

export type WorkbenchToolAudioEvent =
  | 'hammer_arm'
  | 'slot_expand'
  | 'peek_open'
  | 'peek_close'
  | 'cam'
  | 'auto_play';

const COMBO_PITCH_STEPS = [1.0, 1.06, 1.12, 1.19, 1.26, 1.33, 1.41, 1.5];

function comboPitch(combo: number): number {
  const idx = Math.max(0, Math.min(COMBO_PITCH_STEPS.length - 1, Math.floor(combo) - 1));
  return COMBO_PITCH_STEPS[idx] * organicJitter(0.02);
}

function packMaterial(pack: SoundscapePackId): AcousticMaterial {
  if (pack === 'cybernetic') return 'titanium';
  if (pack === 'clockwork') return 'brass';
  return 'steel';
}

/**
 * Auditions the active mechanical soundscape with a multi-phase physical demonstration motif.
 */
export function renderPackPreview(
  ctx: AudioContext,
  dest: AudioNode,
  noise: NoiseGenerator,
  pack: SoundscapePackId,
  vol: number
): void {
  const now = ctx.currentTime;
  const g = (v: number) => Math.max(0.001, v * vol);

  if (pack === 'industrial') {
    // Pneumatic torque driver double-impact + compressed air burst + steel forge ring
    for (let i = 0; i < 2; i++) {
      const t = now + i * 0.055;
      triggerMechanicalClick(ctx, dest, noise, {
        startTime: t,
        clickFreq: 2100 + i * 420,
        cavityFreq: 480 + i * 110,
        duration: 0.026,
        gain: g(0.28),
        q: 3.4,
      });
      triggerBodyThump(ctx, dest, noise, {
        startTime: t,
        startFreq: 165,
        endFreq: 54,
        duration: 0.06,
        gain: g(0.22),
      });
    }
    triggerPneumaticAir(ctx, dest, noise, {
      startTime: now + 0.09,
      duration: 0.14,
      freqStart: 1600,
      freqEnd: 420,
      gain: g(0.18),
      q: 1.5,
    });
    triggerModalImpact(ctx, dest, noise, {
      startTime: now + 0.13,
      baseFreq: 587.33,
      material: 'steel',
      duration: 0.36,
      gain: g(0.28),
      pitchBendRatio: 1.01,
    });
    return;
  }

  if (pack === 'cybernetic') {
    // 3 micro-stepper clicks + electromagnetic FM rail lock + titanium chime
    for (let i = 0; i < 3; i++) {
      triggerMechanicalClick(ctx, dest, noise, {
        startTime: now + i * 0.024,
        clickFreq: 3600 + i * 450,
        cavityFreq: 860 + i * 160,
        duration: 0.014,
        gain: g(0.2),
        q: 6.5,
      });
    }
    triggerFmCoilPulse(ctx, dest, {
      startTime: now + 0.075,
      carrierStart: 540,
      carrierEnd: 1080,
      modRatio: 2.31,
      modDepthStart: 280,
      duration: 0.16,
      gain: g(0.22),
    });
    triggerModalImpact(ctx, dest, noise, {
      startTime: now + 0.11,
      baseFreq: 880,
      material: 'titanium',
      duration: 0.34,
      gain: g(0.26),
    });
    return;
  }

  // Clockwork: Swiss ruby escapement triple tick-tock-tick + antique brass bell
  const tickFreqs = [1320, 1740, 1420];
  tickFreqs.forEach((tf, i) => {
    triggerMechanicalClick(ctx, dest, noise, {
      startTime: now + i * 0.04,
      clickFreq: tf * 2.1,
      cavityFreq: tf,
      duration: 0.015,
      gain: g(0.24),
      q: 5.4,
    });
  });
  triggerModalImpact(ctx, dest, noise, {
    startTime: now + 0.14,
    baseFreq: 659.25,
    material: 'brass',
    duration: 0.42,
    gain: g(0.28),
  });
}

/**
 * Renders the 3-phase physical bolt extraction model:
 * Phase A: Break-torque static friction snap
 * Phase B: Multi-tooth mechanical ratchet spin
 * Phase C: Socket dock thud or matched harmonic tine lock
 */
export function renderUnscrew(
  ctx: AudioContext,
  dest: AudioNode,
  noise: NoiseGenerator,
  pack: SoundscapePackId,
  matched: boolean,
  combo: number,
  vol: number
): void {
  const now = ctx.currentTime;
  const g = (v: number) => Math.max(0.001, v * vol);
  const pitch = comboPitch(combo);
  const baseMat = packMaterial(pack);

  if (pack === 'cybernetic') {
    // Phase A: Crisp piezo solenoid engage snap
    triggerMechanicalClick(ctx, dest, noise, {
      startTime: now,
      clickFreq: 4200 * organicJitter(0.04),
      cavityFreq: 1120,
      duration: 0.011,
      gain: g(0.22),
      q: 5.5,
    });

    // Phase B: 4 rapid linear stepper-motor micro-pulses + metallic induction chirp
    for (let i = 0; i < 4; i++) {
      const t = now + 0.014 + i * 0.019;
      const pan = i % 2 === 0 ? -0.14 : 0.14;
      triggerMechanicalClick(ctx, dest, noise, {
        startTime: t,
        clickFreq: (3100 + i * 380) * pitch,
        cavityFreq: (720 + i * 140) * pitch,
        duration: 0.012,
        gain: g(0.16),
        q: 6.2,
        pan,
      });
    }
    triggerFmCoilPulse(ctx, dest, {
      startTime: now + 0.02,
      carrierStart: 480 * pitch,
      carrierEnd: 920 * pitch,
      modRatio: 2.31,
      modDepthStart: 190,
      duration: 0.075,
      gain: g(0.1),
    });

    // Phase C: Target rail lock vs cryo-dock seat
    const latchTime = now + 0.098;
    if (matched) {
      triggerPneumaticAir(ctx, dest, noise, {
        startTime: latchTime - 0.01,
        duration: 0.055,
        freqStart: 900,
        freqEnd: 2600,
        gain: g(0.14),
        q: 2.4,
      });
      triggerModalImpact(ctx, dest, noise, {
        startTime: latchTime,
        baseFreq: 698.46 * pitch,
        material: 'titanium',
        duration: 0.28,
        gain: g(0.26),
        pitchBendRatio: 1.03,
      });
    } else {
      triggerBodyThump(ctx, dest, noise, {
        startTime: latchTime,
        startFreq: 195,
        endFreq: 62,
        duration: 0.07,
        gain: g(0.26),
      });
      triggerMechanicalClick(ctx, dest, noise, {
        startTime: latchTime + 0.004,
        clickFreq: 2450,
        cavityFreq: 640,
        duration: 0.015,
        gain: g(0.22),
      });
    }
    return;
  }

  if (pack === 'clockwork') {
    // Phase A: Tiny jewel bearing static break tick
    triggerMechanicalClick(ctx, dest, noise, {
      startTime: now,
      clickFreq: 3600 * organicJitter(0.04),
      cavityFreq: 1450,
      duration: 0.01,
      gain: g(0.22),
      q: 6.0,
    });

    // Phase B: 4 Swiss gear-train escapement clicks
    const tickRatios = [1.0, 1.24, 1.08, 1.36];
    for (let i = 0; i < 4; i++) {
      const t = now + 0.016 + i * 0.025;
      const pan = i % 2 === 0 ? -0.16 : 0.16;
      triggerMechanicalClick(ctx, dest, noise, {
        startTime: t,
        clickFreq: 2450 * tickRatios[i] * pitch,
        cavityFreq: 960 * tickRatios[i] * pitch,
        duration: 0.013,
        gain: g(0.2),
        q: 5.2,
        pan,
      });
    }

    // Phase C: Horological bell tine ping (matched) vs brass pocket socket knock (dock)
    const latchTime = now + 0.116;
    if (matched) {
      triggerModalImpact(ctx, dest, noise, {
        startTime: latchTime,
        baseFreq: 659.25 * pitch,
        material: 'brass',
        duration: 0.34,
        gain: g(0.28),
        pitchBendRatio: 1.015,
      });
    } else {
      triggerBodyThump(ctx, dest, noise, {
        startTime: latchTime,
        startFreq: 240,
        endFreq: 92,
        duration: 0.055,
        gain: g(0.24),
        noiseCutHz: 540,
      });
      triggerMechanicalClick(ctx, dest, noise, {
        startTime: latchTime + 0.004,
        clickFreq: 1950,
        cavityFreq: 780,
        duration: 0.014,
        gain: g(0.18),
      });
    }
    return;
  }

  // Default: Industrial Factory (pneumatic stick-slip + torque impact ratchet + heavy steel lock)
  // Phase A: Break-torque metal stick-slip snap
  triggerMechanicalClick(ctx, dest, noise, {
    startTime: now,
    clickFreq: 2500 * organicJitter(0.05),
    cavityFreq: 420 * organicJitter(0.04),
    duration: 0.018,
    gain: g(0.26),
    q: 3.0,
  });
  triggerBodyThump(ctx, dest, noise, {
    startTime: now,
    startFreq: 145,
    endFreq: 58,
    duration: 0.036,
    gain: g(0.18),
  });

  // Phase B: 3 heavy pneumatic ratchet blows + micro exhaust burst
  for (let i = 0; i < 3; i++) {
    const t = now + 0.018 + i * 0.031;
    const pan = i % 2 === 0 ? -0.12 : 0.12;
    triggerMechanicalClick(ctx, dest, noise, {
      startTime: t,
      clickFreq: (1900 + i * 310) * pitch,
      cavityFreq: (490 + i * 115) * pitch,
      duration: 0.019,
      gain: g(0.22),
      q: 3.6,
      pan,
    });
  }
  triggerPneumaticAir(ctx, dest, noise, {
    startTime: now + 0.072,
    duration: 0.065,
    freqStart: 1350,
    freqEnd: 460,
    gain: g(0.12),
    q: 1.6,
  });

  // Phase C: Pneumatic socket lock / magnetic chuck clunk
  const latchTime = now + 0.112;
  if (matched) {
    triggerModalImpact(ctx, dest, noise, {
      startTime: latchTime,
      baseFreq: 554.37 * pitch,
      material: baseMat,
      duration: 0.28,
      gain: g(0.26),
      pitchBendRatio: 1.02,
    });
    triggerMechanicalClick(ctx, dest, noise, {
      startTime: latchTime,
      clickFreq: 2900,
      cavityFreq: 840,
      duration: 0.014,
      gain: g(0.2),
    });
  } else {
    triggerBodyThump(ctx, dest, noise, {
      startTime: latchTime,
      startFreq: 160,
      endFreq: 52,
      duration: 0.075,
      gain: g(0.28),
      noiseCutHz: 360,
    });
    triggerMechanicalClick(ctx, dest, noise, {
      startTime: latchTime + 0.005,
      clickFreq: 1650,
      cavityFreq: 380,
      duration: 0.016,
      gain: g(0.22),
    });
  }
}

/**
 * Pure mechanical interference rattle + damped dead-stop clank when attempting
 * to unscrew a bolt trapped beneath a higher layer plate.
 */
export function renderBlocked(
  ctx: AudioContext,
  dest: AudioNode,
  noise: NoiseGenerator,
  pack: SoundscapePackId,
  vol: number
): void {
  const now = ctx.currentTime;
  const g = (v: number) => Math.max(0.001, v * vol);

  if (pack === 'cybernetic') {
    // Repulsion coil stutter clack
    triggerMechanicalClick(ctx, dest, noise, {
      startTime: now,
      clickFreq: 2600,
      cavityFreq: 290,
      duration: 0.02,
      gain: g(0.26),
      q: 3.5,
    });
    triggerFmCoilPulse(ctx, dest, {
      startTime: now + 0.018,
      carrierStart: 220,
      carrierEnd: 110,
      modRatio: 2.71,
      modDepthStart: 140,
      duration: 0.08,
      gain: g(0.2),
    });
    return;
  }

  // Industrial / Clockwork: Dual dead-stop metallic knock + stuck plate micro-rattle
  triggerBodyThump(ctx, dest, noise, {
    startTime: now,
    startFreq: 142,
    endFreq: 58,
    duration: 0.065,
    gain: g(0.28),
    noiseCutHz: 320,
  });
  triggerMechanicalClick(ctx, dest, noise, {
    startTime: now,
    clickFreq: pack === 'clockwork' ? 2550 : 1780,
    cavityFreq: pack === 'clockwork' ? 420 : 280,
    duration: 0.022,
    gain: g(0.26),
    q: 4.0,
  });
  triggerMechanicalClick(ctx, dest, noise, {
    startTime: now + 0.036,
    clickFreq: pack === 'clockwork' ? 1950 : 1380,
    cavityFreq: 210,
    duration: 0.018,
    gain: g(0.18),
    q: 3.6,
    pan: 0.18,
  });
}

/**
 * High-kinetic anvil/rail/mallet smash + broadband metallic fracture + ringing decay.
 */
export function renderHammerStrike(
  ctx: AudioContext,
  dest: AudioNode,
  noise: NoiseGenerator,
  pack: SoundscapePackId,
  vol: number
): void {
  const now = ctx.currentTime;
  const g = (v: number) => Math.max(0.001, v * vol);
  const mat = packMaterial(pack);

  // Heavy kinetic sub + mid-bass strike punch
  triggerBodyThump(ctx, dest, noise, {
    startTime: now,
    startFreq: pack === 'cybernetic' ? 240 : 185,
    endFreq: 42,
    duration: 0.24,
    gain: g(0.45),
    noiseCutHz: 780,
  });

  // High-energy shatter transient burst
  triggerPneumaticAir(ctx, dest, noise, {
    startTime: now,
    duration: 0.09,
    freqStart: pack === 'cybernetic' ? 3800 : 2600,
    freqEnd: 620,
    gain: g(0.32),
    q: 1.4,
  });

  // Shimmering forge anvil / resonant core ringdown
  triggerModalImpact(ctx, dest, noise, {
    startTime: now + 0.008,
    baseFreq: pack === 'cybernetic' ? 740 : pack === 'clockwork' ? 466.16 : 540,
    material: mat,
    duration: 0.44,
    gain: g(0.34),
    pitchBendRatio: pack === 'cybernetic' ? 0.88 : 0.96,
    strikeMix: 0.9,
  });
}

/**
 * Multi-material plate detachment pop + falling aerodynamic whoosh + dual-bounce workbench impact.
 */
export function renderPlateDrop(
  ctx: AudioContext,
  dest: AudioNode,
  noise: NoiseGenerator,
  pack: SoundscapePackId,
  plateMaterial: PlateMaterialType | undefined,
  vol: number
): void {
  const now = ctx.currentTime;
  const g = (v: number) => Math.max(0.001, v * vol);
  const mat = plateMaterial ? plateMaterialToAcoustic(plateMaterial) : packMaterial(pack);

  // 1. Thread pop + aerodynamic falling sweep
  triggerPneumaticAir(ctx, dest, noise, {
    startTime: now,
    duration: 0.13,
    freqStart: mat === 'acrylic' ? 1150 : 760,
    freqEnd: 210,
    gain: g(0.18),
    q: 1.7,
  });

  // 2. Primary heavy workbench impact bounce
  const hit1 = now + 0.088;
  const baseHz =
    mat === 'acrylic'
      ? 620 * organicJitter(0.06)
      : mat === 'brass'
        ? 392 * organicJitter(0.05)
        : mat === 'titanium'
          ? 440 * organicJitter(0.05)
          : 310 * organicJitter(0.05);

  triggerBodyThump(ctx, dest, noise, {
    startTime: hit1,
    startFreq: mat === 'acrylic' ? 210 : 150,
    endFreq: 52,
    duration: mat === 'acrylic' ? 0.055 : 0.095,
    gain: g(0.3),
    noiseCutHz: mat === 'acrylic' ? 900 : 420,
    pan: -0.18,
  });

  triggerModalImpact(ctx, dest, noise, {
    startTime: hit1,
    baseFreq: baseHz,
    material: mat,
    duration: mat === 'acrylic' ? 0.11 : 0.24,
    gain: g(0.24),
    pan: -0.18,
  });

  // 3. Secondary resting clatter bounce
  const hit2 = hit1 + 0.058;
  triggerMechanicalClick(ctx, dest, noise, {
    startTime: hit2,
    clickFreq: mat === 'acrylic' ? 2400 : 1850,
    cavityFreq: baseHz * 0.9,
    duration: 0.022,
    gain: g(0.2),
    pan: 0.22,
  });
}

/**
 * Target Box 3/3 seal: brushed cover slide + pneumatic seal snap + harmonic modal latch triad.
 */
export function renderBoxComplete(
  ctx: AudioContext,
  dest: AudioNode,
  noise: NoiseGenerator,
  pack: SoundscapePackId,
  vol: number
): void {
  const now = ctx.currentTime;
  const g = (v: number) => Math.max(0.001, v * vol);
  const mat = packMaterial(pack);

  // 1. Metallic cover slide
  triggerPneumaticAir(ctx, dest, noise, {
    startTime: now,
    duration: 0.085,
    freqStart: 950,
    freqEnd: 2400,
    gain: g(0.16),
    q: 2.2,
  });

  // 2. Heavy latch lock thud
  triggerBodyThump(ctx, dest, noise, {
    startTime: now + 0.06,
    startFreq: 175,
    endFreq: 55,
    duration: 0.09,
    gain: g(0.32),
  });
  triggerMechanicalClick(ctx, dest, noise, {
    startTime: now + 0.062,
    clickFreq: 3100,
    cavityFreq: 780,
    duration: 0.02,
    gain: g(0.26),
  });

  // 3. Struck metallic bar cadence (zero plain electronic organ sine wave!)
  const chord =
    pack === 'cybernetic'
      ? [587.33, 880, 1174.66]
      : pack === 'clockwork'
        ? [659.25, 830.61, 987.77]
        : [523.25, 659.25, 783.99];
  chord.forEach((freq, idx) => {
    triggerModalImpact(ctx, dest, noise, {
      startTime: now + 0.08 + idx * 0.048,
      baseFreq: freq,
      material: mat,
      duration: 0.34,
      gain: g(0.24),
      strikeMix: 0.45,
      pan: (idx - 1) * 0.16,
    });
  });
}

/**
 * Tactile 3D push-button microswitch click (press down) and cap spring return (release up).
 */
export function renderButtonClick(
  ctx: AudioContext,
  dest: AudioNode,
  noise: NoiseGenerator,
  pack: SoundscapePackId,
  down: boolean,
  vol: number
): void {
  const now = ctx.currentTime;
  const g = (v: number) => Math.max(0.001, v * vol);

  if (down) {
    triggerMechanicalClick(ctx, dest, noise, {
      startTime: now,
      clickFreq: pack === 'cybernetic' ? 4100 : pack === 'clockwork' ? 3500 : 2900,
      cavityFreq: pack === 'cybernetic' ? 760 : pack === 'clockwork' ? 680 : 480,
      duration: 0.011,
      gain: g(0.24),
      q: 5.5,
    });
  } else {
    triggerMechanicalClick(ctx, dest, noise, {
      startTime: now,
      clickFreq: 1850,
      cavityFreq: 360,
      duration: 0.01,
      gain: g(0.14),
      q: 4.0,
    });
  }
}

/**
 * Signature mechanical actuation SFX for workbench power-ups and controls.
 */
export function renderToolActivate(
  ctx: AudioContext,
  dest: AudioNode,
  noise: NoiseGenerator,
  pack: SoundscapePackId,
  tool: WorkbenchToolAudioEvent,
  vol: number
): void {
  const now = ctx.currentTime;
  const g = (v: number) => Math.max(0.001, v * vol);
  const mat = packMaterial(pack);

  if (tool === 'hammer_arm') {
    // Pneumatic hammer cocking rack click-clack
    triggerMechanicalClick(ctx, dest, noise, {
      startTime: now,
      clickFreq: 2600,
      cavityFreq: 520,
      duration: 0.018,
      gain: g(0.24),
    });
    triggerModalImpact(ctx, dest, noise, {
      startTime: now + 0.032,
      baseFreq: 680,
      material: mat,
      duration: 0.16,
      gain: g(0.2),
    });
    return;
  }

  if (tool === 'slot_expand') {
    // Sliding steel dock rail extension + heavy locking pin snap
    triggerPneumaticAir(ctx, dest, noise, {
      startTime: now,
      duration: 0.11,
      freqStart: 700,
      freqEnd: 2100,
      gain: g(0.22),
      q: 2.0,
    });
    triggerBodyThump(ctx, dest, noise, {
      startTime: now + 0.085,
      startFreq: 190,
      endFreq: 64,
      duration: 0.08,
      gain: g(0.28),
    });
    triggerModalImpact(ctx, dest, noise, {
      startTime: now + 0.095,
      baseFreq: 783.99,
      material: mat,
      duration: 0.25,
      gain: g(0.24),
    });
    return;
  }

  if (tool === 'peek_open' || tool === 'peek_close') {
    const opening = tool === 'peek_open';
    triggerPneumaticAir(ctx, dest, noise, {
      startTime: now,
      duration: 0.14,
      freqStart: opening ? 1650 : 420,
      freqEnd: opening ? 380 : 1280,
      gain: g(0.24),
      q: 1.5,
    });
    triggerMechanicalClick(ctx, dest, noise, {
      startTime: now + (opening ? 0.01 : 0.09),
      clickFreq: 2400,
      cavityFreq: 420,
      duration: 0.016,
      gain: g(0.2),
    });
    return;
  }

  if (tool === 'cam') {
    // Precision gimbal swivel micro-servo ticks
    for (let i = 0; i < 3; i++) {
      triggerMechanicalClick(ctx, dest, noise, {
        startTime: now + i * 0.022,
        clickFreq: 2800 + i * 300,
        cavityFreq: 620 + i * 90,
        duration: 0.01,
        gain: g(0.15),
        q: 5.0,
      });
    }
    return;
  }

  // auto_play: Magnetic turbine spin-up surge + reactor lock
  triggerFmCoilPulse(ctx, dest, {
    startTime: now,
    carrierStart: 220,
    carrierEnd: 880,
    modRatio: 1.93,
    modDepthStart: 220,
    duration: 0.24,
    gain: g(0.26),
  });
  triggerPneumaticAir(ctx, dest, noise, {
    startTime: now + 0.04,
    duration: 0.22,
    freqStart: 480,
    freqEnd: 2400,
    gain: g(0.18),
    q: 2.2,
  });
  triggerModalImpact(ctx, dest, noise, {
    startTime: now + 0.21,
    baseFreq: 1046.5,
    material: mat,
    duration: 0.34,
    gain: g(0.26),
  });
}

/**
 * Clean mechanical confirmation chime for rewards, upgrades & sync completion.
 */
export function renderUiConfirm(
  ctx: AudioContext,
  dest: AudioNode,
  noise: NoiseGenerator,
  pack: SoundscapePackId,
  vol: number
): void {
  const now = ctx.currentTime;
  const g = (v: number) => Math.max(0.001, v * vol);
  const mat = packMaterial(pack);
  triggerMechanicalClick(ctx, dest, noise, {
    startTime: now,
    clickFreq: 3000,
    cavityFreq: 720,
    duration: 0.015,
    gain: g(0.2),
  });
  triggerModalImpact(ctx, dest, noise, {
    startTime: now + 0.025,
    baseFreq: 659.25,
    material: mat,
    duration: 0.24,
    gain: g(0.22),
  });
  triggerModalImpact(ctx, dest, noise, {
    startTime: now + 0.09,
    baseFreq: 987.77,
    material: mat,
    duration: 0.32,
    gain: g(0.24),
  });
}

/**
 * Celebratory mechanical unlock cadence + resonant metal bar fanfare on Level Victory.
 */
export function renderVictory(
  ctx: AudioContext,
  dest: AudioNode,
  noise: NoiseGenerator,
  pack: SoundscapePackId,
  vol: number
): void {
  const now = ctx.currentTime;
  const g = (v: number) => Math.max(0.001, v * vol);
  const mat = packMaterial(pack);

  // Heavy victory chassis latch downbeat
  triggerBodyThump(ctx, dest, noise, {
    startTime: now,
    startFreq: 165,
    endFreq: 48,
    duration: 0.14,
    gain: g(0.32),
  });

  const fanfare =
    pack === 'cybernetic'
      ? [587.33, 739.99, 880, 1174.66]
      : pack === 'clockwork'
        ? [587.33, 739.99, 987.77, 1318.51]
        : [523.25, 659.25, 783.99, 1046.5];

  fanfare.forEach((freq, i) => {
    const t = now + 0.03 + i * 0.072;
    triggerMechanicalClick(ctx, dest, noise, {
      startTime: t,
      clickFreq: 2800 + i * 320,
      cavityFreq: 680 + i * 110,
      duration: 0.015,
      gain: g(0.18),
    });
    triggerModalImpact(ctx, dest, noise, {
      startTime: t,
      baseFreq: freq,
      material: mat,
      duration: i === fanfare.length - 1 ? 0.65 : 0.34,
      gain: g(0.26),
      pan: (i - 1.5) * 0.14,
    });
  });
}

/**
 * Mechanical flywheel spool-down & dead-bolt lock stall on Dock Jam / Defeat.
 */
export function renderDefeat(
  ctx: AudioContext,
  dest: AudioNode,
  noise: NoiseGenerator,
  pack: SoundscapePackId,
  vol: number
): void {
  const now = ctx.currentTime;
  const g = (v: number) => Math.max(0.001, v * vol);

  // Mechanical flywheel powering down
  triggerFmCoilPulse(ctx, dest, {
    startTime: now,
    carrierStart: 320,
    carrierEnd: 78,
    modRatio: pack === 'cybernetic' ? 2.41 : 1.73,
    modDepthStart: 120,
    duration: 0.38,
    gain: g(0.24),
  });

  // Heavy jam dead-bolt thud
  triggerBodyThump(ctx, dest, noise, {
    startTime: now + 0.04,
    startFreq: 145,
    endFreq: 46,
    duration: 0.22,
    gain: g(0.32),
  });

  // Muted descending mechanical lock clicks
  const lockFreqs = [392, 311.13, 246.94];
  lockFreqs.forEach((f, i) => {
    const t = now + i * 0.1;
    triggerMechanicalClick(ctx, dest, noise, {
      startTime: t,
      clickFreq: 1450 - i * 240,
      cavityFreq: f,
      duration: 0.025,
      gain: g(0.2),
      q: 3.0,
    });
  });
}

