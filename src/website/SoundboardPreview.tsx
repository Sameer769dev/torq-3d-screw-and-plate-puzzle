import React, { useState } from 'react';
import { Volume2, Play, Sparkles, Layers, Hammer, CheckCircle2 } from 'lucide-react';
import { soundEngine, SOUNDSCAPE_PACKS, SoundscapePackId } from '../game/sound';

export function SoundboardPreview() {
  const [activePack, setActivePack] = useState<SoundscapePackId>('industrial');
  const [lastPlayed, setLastPlayed] = useState<string>('Ready to test physical audio');

  const playEffect = (packId: SoundscapePackId, actionType: 'unscrew' | 'drop' | 'match' | 'hammer') => {
    try {
      soundEngine.setPack(packId, false);
      setActivePack(packId);

      if (actionType === 'unscrew') {
        soundEngine.playUnscrew(true, 1);
        setLastPlayed(`[${packId.toUpperCase()}] Unscrew Thread Ratchet`);
      } else if (actionType === 'drop') {
        soundEngine.playPlateDrop('blued-steel');
        setLastPlayed(`[${packId.toUpperCase()}] Plate Clatter & Rebound`);
      } else if (actionType === 'match') {
        soundEngine.playBoxComplete();
        setLastPlayed(`[${packId.toUpperCase()}] Match-3 Box Seal Chord`);
      } else if (actionType === 'hammer') {
        soundEngine.playHammerStrike();
        setLastPlayed(`[${packId.toUpperCase()}] Heavy Hammer Anvil Strike`);
      }
    } catch {
      // AudioContext requires initial user gesture
      setLastPlayed('Audio initialized! Click again to hear.');
    }
  };

  const packList: SoundscapePackId[] = ['industrial', 'cybernetic', 'clockwork'];

  return (
    <section id="soundscapes" className="py-24 relative overflow-hidden bg-[#070A0F]">
      {/* Background Subtle Gradient Grid */}
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-20 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-mono text-xs font-semibold uppercase tracking-wider mb-4">
            <Volume2 className="w-3.5 h-3.5" />
            <span>Zero Sample Files · 100% Procedural Web Audio API</span>
          </div>
          <h2 className="font-display font-black text-3xl sm:text-4xl lg:text-5xl tracking-tight text-white mb-4">
            Procedural ASMR Machine Soundscapes
          </h2>
          <p className="font-sans text-base sm:text-lg text-slate-400">
            TORQ synthesizes every metallic click, stick-slip friction ratchet, and hydraulic exhaust in real-time.
            Switch sound packs and audition live effects below!
          </p>
        </div>

        {/* 3 Pack Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
          {packList.map((packId) => {
            const pack = SOUNDSCAPE_PACKS[packId];
            const isSelected = activePack === packId;

            return (
              <div
                key={packId}
                className={`rounded-2xl p-6 transition-all duration-300 relative border flex flex-col justify-between ${
                  isSelected
                    ? 'bg-[#0E1522] border-amber-500/60 shadow-[0_12px_40px_rgba(245,158,11,0.15)] ring-1 ring-amber-500/40'
                    : 'bg-[#0A101A]/80 border-slate-800 hover:border-slate-700 shadow-xl'
                }`}
              >
                <div>
                  {/* Top Badge & Code */}
                  <div className="flex items-center justify-between mb-4">
                    <span
                      className="px-2.5 py-1 rounded-md font-mono text-xs font-black tracking-widest border"
                      style={{
                        backgroundColor: `${pack.accentHex}15`,
                        color: pack.accentHex,
                        borderColor: `${pack.accentHex}40`,
                      }}
                    >
                      {pack.shortCode}
                    </span>
                    <span className="font-mono text-xs text-slate-500 tracking-wider">
                      {pack.waveformTag}
                    </span>
                  </div>

                  {/* Title & Tagline */}
                  <h3 className="font-display font-bold text-2xl text-white mb-1">
                    {pack.name}
                  </h3>
                  <p
                    className="font-mono text-xs font-bold tracking-wider mb-3"
                    style={{ color: pack.accentHex }}
                  >
                    {pack.tagline}
                  </p>
                  <p className="font-sans text-xs text-slate-400 leading-relaxed mb-6">
                    {pack.description}
                  </p>

                  {/* Frequency Spectrum Visualizer Bars */}
                  <div className="h-10 bg-[#070A0F] rounded-lg p-2 border border-slate-800/80 flex items-end justify-between gap-1 mb-6">
                    {pack.specBars.map((barVal, idx) => (
                      <div
                        key={idx}
                        className="flex-1 rounded-t-sm transition-all duration-300"
                        style={{
                          height: `${Math.round(barVal * 100)}%`,
                          backgroundColor: isSelected ? pack.accentHex : '#334155',
                          opacity: isSelected ? 0.9 : 0.4,
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* Interactive Audio Triggers */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80">
                  <button
                    onClick={() => playEffect(packId, 'unscrew')}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-mono font-semibold bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700/60 hover:border-amber-400/50 transition-all cursor-pointer group"
                  >
                    <Play className="w-3 h-3 text-amber-400 fill-amber-400 group-hover:scale-110" />
                    <span>Unscrew</span>
                  </button>
                  <button
                    onClick={() => playEffect(packId, 'drop')}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-mono font-semibold bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700/60 hover:border-sky-400/50 transition-all cursor-pointer group"
                  >
                    <Layers className="w-3 h-3 text-sky-400 group-hover:scale-110" />
                    <span>Plate Drop</span>
                  </button>
                  <button
                    onClick={() => playEffect(packId, 'match')}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-mono font-semibold bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700/60 hover:border-emerald-400/50 transition-all cursor-pointer group"
                  >
                    <Sparkles className="w-3 h-3 text-emerald-400 group-hover:scale-110" />
                    <span>Match 3</span>
                  </button>
                  <button
                    onClick={() => playEffect(packId, 'hammer')}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-mono font-semibold bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700/60 hover:border-rose-400/50 transition-all cursor-pointer group"
                  >
                    <Hammer className="w-3 h-3 text-rose-400 group-hover:scale-110" />
                    <span>Hammer</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Live Audio Status Ticker */}
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-[#0C131F] border border-slate-800 text-center shadow-lg">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-mono text-xs text-slate-400">
              SYNTHESIZER STATUS: <span className="text-amber-400 font-bold">{lastPlayed}</span>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
