export interface MasterAudioBus {
  ctx: AudioContext;
  input: GainNode;
  compressor: DynamicsCompressorNode;
  saturator: WaveShaperNode;
}

/**
 * Manages the shared Web Audio API context and builds a non-linear analog-warmth
 * master chain (WaveShaper transformer saturation + DynamicsCompressor peak limiter)
 * so layered mechanical transients punch cleanly on mobile speakers without clipping.
 */
export class AudioContextManager {
  private ctx: AudioContext | null = null;
  private bus: MasterAudioBus | null = null;

  private buildSaturationCurve(drive = 1.75, samples = 2048): Float32Array<ArrayBuffer> {
    const curve = new Float32Array(new ArrayBuffer(samples * Float32Array.BYTES_PER_ELEMENT));
    const norm = Math.tanh(drive);
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / (samples - 1) - 1;
      curve[i] = Math.tanh(x * drive) / norm;
    }
    return curve;
  }

  public getContext(muted: boolean): AudioContext | null {
    if (muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Returns the initialized master bus routed to `ctx.destination`.
   * Rebuilds automatically if the AudioContext instance changes.
   */
  public getMasterBus(muted: boolean): MasterAudioBus | null {
    const ctx = this.getContext(muted);
    if (!ctx) return null;

    if (this.bus && this.bus.ctx === ctx) {
      return this.bus;
    }

    const input = ctx.createGain();
    input.gain.value = 1.0;

    const saturator = ctx.createWaveShaper();
    saturator.curve = this.buildSaturationCurve(1.75);
    saturator.oversample = '2x';

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-12, ctx.currentTime);
    compressor.knee.setValueAtTime(10, ctx.currentTime);
    compressor.ratio.setValueAtTime(6, ctx.currentTime);
    compressor.attack.setValueAtTime(0.002, ctx.currentTime);
    compressor.release.setValueAtTime(0.12, ctx.currentTime);

    input.connect(saturator);
    saturator.connect(compressor);
    compressor.connect(ctx.destination);

    this.bus = { ctx, input, compressor, saturator };
    return this.bus;
  }

  public unlock(muted: boolean): void {
    const bus = this.getMasterBus(muted);
    if (!bus) return;
    if (bus.ctx.state === 'suspended') {
      bus.ctx.resume().catch(() => {});
    }
  }
}

