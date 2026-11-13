import React, { useState } from 'react';
import { Maximize2, X, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';

interface ScreenshotItem {
  id: string;
  src: string;
  badge: string;
  title: string;
  desc: string;
  accent: string;
}

const SCREENSHOTS: ScreenshotItem[] = [
  {
    id: 'shot1',
    src: '/assets/store/screenshot_1_action_hook.png',
    badge: 'TACTILE 3D MECHANICAL PUZZLE',
    title: 'Unscrew & Disassemble',
    desc: 'Multi-layer puzzle assemblies with realistic physical modeling & ASMR tactile feedback.',
    accent: '#F59E0B',
  },
  {
    id: 'shot2',
    src: '/assets/store/screenshot_2_match_and_sort.png',
    badge: 'COLOR MATCHING LOOP',
    title: 'Match 3 of a Color',
    desc: 'Strategically sort bolts into matching target boxes before filling up your spare dock.',
    accent: '#38BDF8',
  },
  {
    id: 'shot3',
    src: '/assets/store/screenshot_3_exploded_3d_view.png',
    badge: 'SPATIAL DEPTH & INSPECTION',
    title: 'Exploded 3D View',
    desc: 'Rotate 360° around the workbench to inspect hidden bolts beneath overlapping plates.',
    accent: '#A855F7',
  },
  {
    id: 'shot4',
    src: '/assets/store/screenshot_4_tactical_boosters.png',
    badge: 'FORGE & UNLOCK TOOLS',
    title: 'Tactical Boosters & Hammer',
    desc: 'Use the Heavy Anvil Hammer, Dock Expansions, and Smart Solvers when jammed.',
    accent: '#F59E0B',
  },
  {
    id: 'shot5',
    src: '/assets/store/screenshot_5_auto_play_reactor.png',
    badge: 'AUTONOMOUS SOLVER',
    title: 'Uranium Auto-Play Reactor',
    desc: 'Charge radioactive reactor fuel and watch the AI solver power through complex levels.',
    accent: '#10B981',
  },
  {
    id: 'shot6',
    src: '/assets/store/screenshot_6_infinite_levels.png',
    badge: 'ENDLESS PROCEDURAL MASTERY',
    title: 'Infinite 3D Challenges',
    desc: 'Dynamic difficulty adjusts in real-time with procedural multi-plate assemblies.',
    accent: '#F43F5E',
  },
];

export function ScreenshotGallery() {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const openLightbox = (idx: number) => setSelectedIdx(idx);
  const closeLightbox = () => setSelectedIdx(null);

  const prevShot = () => {
    if (selectedIdx !== null) {
      setSelectedIdx((selectedIdx - 1 + SCREENSHOTS.length) % SCREENSHOTS.length);
    }
  };

  const nextShot = () => {
    if (selectedIdx !== null) {
      setSelectedIdx((selectedIdx + 1) % SCREENSHOTS.length);
    }
  };

  return (
    <section id="screenshots" className="py-24 bg-[#05080C] relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono text-xs font-semibold uppercase tracking-wider mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>100% Real Gameplay · Zero Fake Ads</span>
          </div>
          <h2 className="font-display font-black text-3xl sm:text-4xl lg:text-5xl tracking-tight text-white mb-4">
            In-Engine 3D Gameplay Gallery
          </h2>
          <p className="font-sans text-base sm:text-lg text-slate-400">
            What you see is what you play. Every screenshot is rendered directly from our Three.js physics engine in native 1080p.
          </p>
        </div>

        {/* 6-Card Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {SCREENSHOTS.map((item, idx) => (
            <div
              key={item.id}
              onClick={() => openLightbox(idx)}
              className="group relative rounded-2xl overflow-hidden bg-[#0A101A] border border-slate-800 hover:border-amber-500/50 transition-all duration-300 shadow-xl cursor-pointer hover:shadow-2xl hover:scale-[1.02]"
            >
              {/* Aspect Ratio 16:9 Image Container */}
              <div className="relative aspect-video w-full overflow-hidden bg-[#070A0F]">
                <img
                  src={item.src}
                  alt={item.title}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0A101A] via-transparent to-transparent opacity-80" />

                {/* Hover overlay hint */}
                <div className="absolute inset-0 bg-amber-500/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="p-3 rounded-full bg-[#070A0F]/80 border border-amber-400/60 text-amber-300 shadow-2xl">
                    <Maximize2 className="w-5 h-5" />
                  </div>
                </div>
              </div>

              {/* Card Meta Content */}
              <div className="p-5">
                <span
                  className="inline-block px-2.5 py-0.5 rounded text-[11px] font-mono font-bold tracking-wider mb-2"
                  style={{
                    backgroundColor: `${item.accent}15`,
                    color: item.accent,
                    border: `1px solid ${item.accent}40`,
                  }}
                >
                  {item.badge}
                </span>
                <h3 className="font-display font-bold text-xl text-white group-hover:text-amber-400 transition-colors mb-1.5">
                  {item.title}
                </h3>
                <p className="font-sans text-xs text-slate-400 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Lightbox Modal */}
      {selectedIdx !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center p-4 sm:p-8 animate-in fade-in duration-200"
          onClick={closeLightbox}
        >
          <div
            className="relative max-w-6xl w-full flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={closeLightbox}
              className="absolute -top-12 right-0 p-2 text-slate-400 hover:text-white cursor-pointer focus:outline-none"
              aria-label="Close Preview"
            >
              <X className="w-7 h-7" />
            </button>

            {/* Prev / Next Navigation Arrows */}
            <button
              onClick={prevShot}
              className="absolute left-2 sm:-left-14 top-1/2 -translate-y-1/2 p-3 rounded-full bg-[#0C131F]/90 text-white hover:text-amber-400 border border-slate-700/80 cursor-pointer shadow-2xl focus:outline-none"
              aria-label="Previous image"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              onClick={nextShot}
              className="absolute right-2 sm:-right-14 top-1/2 -translate-y-1/2 p-3 rounded-full bg-[#0C131F]/90 text-white hover:text-amber-400 border border-slate-700/80 cursor-pointer shadow-2xl focus:outline-none"
              aria-label="Next image"
            >
              <ChevronRight className="w-6 h-6" />
            </button>

            {/* Main Lightbox Image */}
            <div className="w-full rounded-2xl overflow-hidden border border-amber-500/40 shadow-2xl bg-[#070A0F]">
              <img
                src={SCREENSHOTS[selectedIdx].src}
                alt={SCREENSHOTS[selectedIdx].title}
                className="w-full h-auto max-h-[75vh] object-contain"
              />
            </div>

            {/* Lightbox Caption */}
            <div className="mt-4 text-center">
              <span
                className="font-mono text-xs font-bold tracking-widest uppercase mb-1 inline-block"
                style={{ color: SCREENSHOTS[selectedIdx].accent }}
              >
                {SCREENSHOTS[selectedIdx].badge}
              </span>
              <h4 className="font-display font-bold text-2xl text-white">
                {SCREENSHOTS[selectedIdx].title}
              </h4>
              <p className="font-sans text-sm text-slate-300 mt-1 max-w-xl mx-auto">
                {SCREENSHOTS[selectedIdx].desc}
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

