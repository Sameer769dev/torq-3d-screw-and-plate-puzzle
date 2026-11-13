export type NoiseKind = 'white' | 'pink' | 'velvet';

export interface NoiseGrainOptions {
  startTime: number;
  duration: number;
  gain: number;
  filterType?: BiquadFilterType;
  freqStart?: number;
  freqEnd?: number;
  q?: number;
  attackSec?: number;
  pan?: number;
}

const BUFFER_SECONDS = 1.2;

/**
 * Generates and caches procedural noise buffers (white, 7-pole pink, and sparse bipolar velvet
 * impulses) per AudioContext so triggering high-rate mechanical transients incurs zero allocations.
 */
export class NoiseGenerator {
  private ctx: AudioContext | null = null;
  private buffers: Partial<Record<NoiseKind, AudioBuffer>> = {};
  private seed = 0x517cc1b7;

  private nextRand(): number {
    // Fast xorshift32 PRNG for deterministic noise generation
    let x = this.seed | 0;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.seed = x;
    return ((x >>> 0) / 4294967296) * 2 - 1;
  }

  public getBuffer(ctx: AudioContext, kind: NoiseKind): AudioBuffer {
    if (this.ctx !== ctx) {
      this.ctx = ctx;
      this.buffers = {};
    }
    const existing = this.buffers[kind];
    if (existing) return existing;

    const length = Math.max(1024, Math.floor(ctx.sampleRate * BUFFER_SECONDS));
    const buf = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buf.getChannelData(0);

    if (kind === 'white') {
      for (let i = 0; i < length; i++) {
        data[i] = this.nextRand();
      }
    } else if (kind === 'pink') {
      // Paul Kellet's 7-pole pink noise approximation (-3 dB/oct)
      let b0 = 0;
      let b1 = 0;
      let b2 = 0;
      let b3 = 0;
      let b4 = 0;
      let b5 = 0;
      let b6 = 0;
      for (let i = 0; i < length; i++) {
        const w = this.nextRand();
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.96900 * b2 + w * 0.1538520;
        b3 = 0.86650 * b3 + w * 0.3104856;
        b4 = 0.55000 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.0168980;
        const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362;
        b6 = w * 0.115926;
        data[i] = Math.max(-1, Math.min(1, pink * 0.11));
      }
    } else {
      // Sparse bipolar velvet impulse noise (~3000 impulses/sec) for authentic metal grit & teeth meshing
      const impulsesPerSec = 3000;
      const gridSize = Math.max(4, ctx.sampleRate / impulsesPerSec);
      const totalCells = Math.floor(length / gridSize);
      for (let cell = 0; cell < totalCells; cell++) {
        const offset = Math.floor(((this.nextRand() + 1) * 0.5) * gridSize);
        const idx = Math.min(length - 1, Math.floor(cell * gridSize) + offset);
        data[idx] = this.nextRand() >= 0 ? 1.0 : -1.0;
      }
    }

    this.buffers[kind] = buf;
    return buf;
  }

  /**
   * Plays a shaped, filter-swept noise burst from a random slice of the cached buffer
   * so consecutive mechanical events never produce identical phase patterns.
   */
  public triggerGrain(
    ctx: AudioContext,
    dest: AudioNode,
    kind: NoiseKind,
    opts: NoiseGrainOptions
  ): void {
    const buffer = this.getBuffer(ctx, kind);
    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const dur = Math.max(0.004, opts.duration);
    const maxOffset = Math.max(0.01, BUFFER_SECONDS - dur - 0.02);
    const startOffset = ((this.nextRand() + 1) * 0.5) * maxOffset;

    const filter = ctx.createBiquadFilter();
    filter.type = opts.filterType ?? 'bandpass';
    const fStart = Math.max(40, opts.freqStart ?? 1800);
    const fEnd = Math.max(40, opts.freqEnd ?? fStart);
    filter.frequency.setValueAtTime(fStart, opts.startTime);
    if (fEnd !== fStart) {
      filter.frequency.exponentialRampToValueAtTime(fEnd, opts.startTime + dur);
    }
    filter.Q.setValueAtTime(Math.max(0.3, opts.q ?? 2.2), opts.startTime);

    const env = ctx.createGain();
    const peak = Math.max(0.001, opts.gain);
    const atk = Math.max(0.001, Math.min(dur * 0.4, opts.attackSec ?? 0.002));
    env.gain.setValueAtTime(0.0001, opts.startTime);
    env.gain.linearRampToValueAtTime(peak, opts.startTime + atk);
    env.gain.exponentialRampToValueAtTime(0.0001, opts.startTime + dur);

    src.connect(filter);
    filter.connect(env);

    if (
      typeof opts.pan === 'number' &&
      Math.abs(opts.pan) > 0.01 &&
      typeof ctx.createStereoPanner === 'function'
    ) {
      const panner = ctx.createStereoPanner();
      panner.pan.setValueAtTime(Math.max(-1, Math.min(1, opts.pan)), opts.startTime);
      env.connect(panner);
      panner.connect(dest);
    } else {
      env.connect(dest);
    }

    src.start(opts.startTime, startOffset, dur + 0.015);
  }
}

