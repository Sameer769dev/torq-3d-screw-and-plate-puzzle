import React, { useState } from 'react';
import { Download, ArrowLeft, Copy, Check, FileText, Sparkles, ExternalLink, Image } from 'lucide-react';
import { WebRoute } from './router';

interface PressKitPageProps {
  navigate: (route: WebRoute) => void;
}

export function PressKitPage({ navigate }: PressKitPageProps) {
  const [copiedHex, setCopiedHex] = useState<string | null>(null);

  const copyColor = (hex: string) => {
    navigator.clipboard.writeText(hex);
    setCopiedHex(hex);
    setTimeout(() => setCopiedHex(null), 2000);
  };

  const screenshots = [
    { title: '1. Action Hook Overview', file: 'screenshot_1_action_hook.png' },
    { title: '2. Color Match & Sort', file: 'screenshot_2_match_and_sort.png' },
    { title: '3. Exploded 3D Orbit View', file: 'screenshot_3_exploded_3d_view.png' },
    { title: '4. Tactical Boosters & Hammer', file: 'screenshot_4_tactical_boosters.png' },
    { title: '5. Uranium Auto-Play Reactor', file: 'screenshot_5_auto_play_reactor.png' },
    { title: '6. Endless Procedural Assembly', file: 'screenshot_6_infinite_levels.png' },
  ];

  return (
    <div className="min-h-screen bg-[#070A0F] text-slate-200 py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Back navigation */}
        <button
          onClick={() => navigate('home')}
          className="inline-flex items-center gap-2 text-sm font-mono text-amber-400 hover:text-amber-300 mb-8 cursor-pointer group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Return to Homepage</span>
        </button>

        {/* Header */}
        <div className="border-b border-slate-800 pb-8 mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono text-xs font-semibold uppercase tracking-wider mb-4">
            <FileText className="w-3.5 h-3.5" />
            <span>Media &amp; Creator Press Kit</span>
          </div>
          <h1 className="font-display font-black text-3xl sm:text-4xl lg:text-5xl text-white tracking-tight mb-3">
            TORQ Press Kit &amp; Media Assets
          </h1>
          <p className="font-sans text-sm text-slate-400 max-w-2xl">
            Official high-resolution logos, in-engine marketing screenshots, factsheet, and brand styling for press, streamers, and reviewers.
          </p>
        </div>

        {/* Factsheet & Studio Information */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          <div className="md:col-span-2 space-y-6">
            <div className="p-6 rounded-2xl bg-[#0C131F] border border-slate-800">
              <h2 className="font-display font-bold text-xl text-white mb-3">About TORQ</h2>
              <p className="font-sans text-sm text-slate-300 leading-relaxed mb-4">
                <strong>TORQ: 3D Screw &amp; Plate Puzzle</strong> is a tactile 3D mechanical puzzle simulation where players unscrew anodized
                hex bolts, drop layered plates under real-time physics, and solve color-matching assemblies without jamming their spare dock.
              </p>
              <p className="font-sans text-sm text-slate-300 leading-relaxed">
                Featuring procedural physical-modeling sound synthesis, 360° orbit inspection, a radioactive Uranium Auto-Play Reactor,
                and infinite procedural assembly generation, TORQ delivers a pure ASMR puzzle experience with zero pre-rendered fake ads.
              </p>
            </div>

            {/* Brand Colors */}
            <div className="p-6 rounded-2xl bg-[#0C131F] border border-slate-800">
              <h3 className="font-display font-bold text-lg text-white mb-4">Official Brand Palette</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { name: 'Dark Slate', hex: '#070A0F', border: 'border-slate-700' },
                  { name: 'Amber Forge', hex: '#F59E0B', border: 'border-amber-500' },
                  { name: 'Cryo Sky Blue', hex: '#38BDF8', border: 'border-sky-400' },
                  { name: 'Uranium Green', hex: '#10B981', border: 'border-emerald-400' },
                ].map((c) => (
                  <button
                    key={c.hex}
                    onClick={() => copyColor(c.hex)}
                    className="p-3 rounded-xl bg-[#070A0F] border border-slate-800 text-left hover:border-slate-600 transition-all cursor-pointer group"
                  >
                    <div
                      className={`w-full h-8 rounded-lg mb-2 border ${c.border}`}
                      style={{ backgroundColor: c.hex }}
                    />
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[11px] font-sans text-slate-400">{c.name}</p>
                        <p className="font-mono text-xs font-bold text-white">{c.hex}</p>
                      </div>
                      {copiedHex === c.hex ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Facts Sidebar */}
          <div className="p-6 rounded-2xl bg-[#0C131F] border border-amber-500/30 space-y-4">
            <h3 className="font-display font-bold text-lg text-amber-400 border-b border-slate-800 pb-2">
              Quick Factsheet
            </h3>
            <div className="space-y-3 font-sans text-xs">
              <div>
                <span className="text-slate-500 block uppercase font-mono text-[10px]">Developer</span>
                <span className="text-white font-medium">TORQ Studio</span>
              </div>
              <div>
                <span className="text-slate-500 block uppercase font-mono text-[10px]">Release Platforms</span>
                <span className="text-white font-medium">Google Play (Android), Modern WebGL</span>
              </div>
              <div>
                <span className="text-slate-500 block uppercase font-mono text-[10px]">Pricing</span>
                <span className="text-white font-medium">Free-to-Play (Zero Paywalls)</span>
              </div>
              <div>
                <span className="text-slate-500 block uppercase font-mono text-[10px]">Tech Stack</span>
                <span className="text-white font-medium">Three.js (r187), React 19, Web Audio API, Capacitor 7</span>
              </div>
              <div>
                <span className="text-slate-500 block uppercase font-mono text-[10px]">Contact</span>
                <span className="text-amber-400 font-mono">press@torqgame.com</span>
              </div>
            </div>
          </div>
        </div>

        {/* High-Resolution Media Downloads */}
        <div className="space-y-8 mb-16">
          <h2 className="font-display font-bold text-2xl text-white">High-Resolution Production Assets</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* App Icon */}
            <div className="p-6 rounded-2xl bg-[#0C131F] border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="aspect-square max-w-[200px] mx-auto rounded-2xl overflow-hidden border border-amber-500/40 p-2 bg-[#070A0F] mb-4 shadow-xl">
                  <img
                    src="/assets/store/app_icon_512x512.png"
                    alt="TORQ App Icon 512x512"
                    className="w-full h-full object-contain rounded-xl"
                  />
                </div>
                <h4 className="font-display font-bold text-lg text-white text-center mb-1">
                  Official App Icon
                </h4>
                <p className="font-mono text-xs text-slate-400 text-center mb-4">
                  512 × 512 px · 32-bit PNG with Alpha
                </p>
              </div>
              <a
                href="/assets/store/app_icon_512x512.png"
                download="TORQ_App_Icon_512x512.png"
                className="w-full py-2.5 rounded-xl font-display font-bold text-xs text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <Download className="w-4 h-4 text-amber-400" />
                <span>Download Icon (512px)</span>
              </a>
            </div>

            {/* Feature Graphic */}
            <div className="p-6 rounded-2xl bg-[#0C131F] border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="aspect-[1024/500] w-full rounded-2xl overflow-hidden border border-amber-500/40 bg-[#070A0F] mb-4 shadow-xl">
                  <img
                    src="/assets/store/feature_graphic_1024x500.png"
                    alt="TORQ Feature Graphic 1024x500"
                    className="w-full h-full object-cover"
                  />
                </div>
                <h4 className="font-display font-bold text-lg text-white text-center mb-1">
                  Google Play Feature Banner
                </h4>
                <p className="font-mono text-xs text-slate-400 text-center mb-4">
                  1,024 × 500 px · 24-bit PNG
                </p>
              </div>
              <a
                href="/assets/store/feature_graphic_1024x500.png"
                download="TORQ_Feature_Graphic_1024x500.png"
                className="w-full py-2.5 rounded-xl font-display font-bold text-xs text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <Download className="w-4 h-4 text-amber-400" />
                <span>Download Feature Graphic</span>
              </a>
            </div>
          </div>

          {/* 6 In-Engine 1080p Screenshots */}
          <div>
            <h3 className="font-display font-bold text-xl text-white mb-4">
              1080p In-Engine Screenshots (Direct Three.js Screencaps)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {screenshots.map((s) => (
                <div key={s.file} className="p-4 rounded-xl bg-[#0C131F] border border-slate-800 flex flex-col justify-between">
                  <div>
                    <div className="aspect-video w-full rounded-lg overflow-hidden bg-[#070A0F] mb-3 border border-slate-800">
                      <img
                        src={`/assets/store/${s.file}`}
                        alt={s.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <p className="font-display font-semibold text-xs text-white mb-2">{s.title}</p>
                  </div>
                  <a
                    href={`/assets/store/${s.file}`}
                    download={s.file}
                    className="w-full py-1.5 rounded-lg font-mono text-[11px] text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-700 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3 h-3 text-sky-400" />
                    <span>Download (1920x1080)</span>
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-slate-800 flex justify-between items-center text-xs text-slate-500 font-mono">
          <span>© 2026 TORQ Studio. For press inquiries: press@torqgame.com</span>
          <button
            onClick={() => navigate('home')}
            className="text-amber-400 hover:underline cursor-pointer"
          >
            ← Return to Homepage
          </button>
        </div>
      </div>
    </div>
  );
}

