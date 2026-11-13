import React from 'react';
import {
  Play,
  Download,
  Shield,
  Layers,
  Sparkles,
  Hammer,
  Radio,
  Cpu,
  Compass,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  Flame,
} from 'lucide-react';
import { Navbar } from './Navbar';
import { Hero3D } from './Hero3D';
import { SoundboardPreview } from './SoundboardPreview';
import { ScreenshotGallery } from './ScreenshotGallery';
import { WebRoute } from './router';

interface LandingPageProps {
  currentRoute: WebRoute;
  navigate: (route: WebRoute) => void;
}

export function LandingPage({ currentRoute, navigate }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-[#070A0F] text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-black">
      {/* Sticky Top Navbar */}
      <Navbar currentRoute={currentRoute} navigate={navigate} />

      {/* 1. Hero Section */}
      <section className="relative pt-12 pb-20 md:pt-16 md:pb-28 overflow-hidden">
        {/* Subtle radial background glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-amber-500/10 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute top-1/3 right-10 w-[400px] h-[400px] bg-sky-500/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Column: Headlines & Call to Actions */}
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              {/* Tactical Badge Pill */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#0E1626] border border-amber-500/40 shadow-lg">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="font-mono text-xs font-bold text-amber-300 tracking-wider uppercase">
                  Tactile 3D Mechanical Physics Puzzle
                </span>
              </div>

              {/* Main Display Headline */}
              <h1 className="font-display font-black text-4xl sm:text-6xl lg:text-7xl tracking-tight text-white leading-[1.08]">
                UNSCREW. <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500">
                  MATCH.
                </span>{' '}
                SOLVE.
              </h1>

              {/* Sub-Headline */}
              <p className="font-sans text-base sm:text-lg text-slate-300 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                Experience realistic 3D physical modeling and ASMR stick-slip friction feedback.
                Unscrew anodized bolts, drop layered metallic plates, and sort into matching target boxes without jamming your dock.
              </p>

              {/* Dual Action CTAs */}
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-2">
                {/* Google Play CTA */}
                <a
                  href="https://play.google.com/store/apps/details?id=com.torq.screwplatepuzzle"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto px-8 py-4 rounded-2xl font-display font-bold text-base text-slate-950 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400 hover:from-amber-300 hover:to-amber-500 shadow-[0_0_30px_rgba(245,158,11,0.45)] hover:shadow-[0_0_40px_rgba(245,158,11,0.65)] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 cursor-pointer group"
                >
                  <Download className="w-5 h-5 stroke-[2.5]" />
                  <span>Get on Google Play</span>
                </a>

                {/* Play Free in Browser CTA */}
                <button
                  onClick={() => navigate('play')}
                  className="w-full sm:w-auto px-8 py-4 rounded-2xl font-display font-bold text-base text-white bg-slate-900/90 hover:bg-slate-800 border border-slate-700 hover:border-sky-400/60 shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 cursor-pointer group"
                >
                  <Play className="w-5 h-5 text-sky-400 fill-sky-400 group-hover:scale-110 transition-transform" />
                  <span>Play Free in Browser</span>
                </button>
              </div>

              {/* Telemetry Spec Bar */}
              <div className="pt-6 border-t border-slate-800/80 flex flex-wrap items-center justify-center lg:justify-start gap-4 sm:gap-6 text-slate-400 text-xs font-mono">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>60 FPS 3D Engine</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Automatic Cloud Save</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>100% Offline Ready</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-amber-400" />
                  <span>Zero Fake Ads</span>
                </div>
              </div>
            </div>

            {/* Right Column: Live Interactive Three.js 3D Hero */}
            <div className="lg:col-span-5 w-full">
              <Hero3D />
            </div>
          </div>
        </div>
      </section>

      {/* 2. Tactical Features Matrix */}
      <section id="features" className="py-24 bg-[#05080C] relative border-t border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono text-xs font-semibold uppercase tracking-wider mb-4">
              <Layers className="w-3.5 h-3.5" />
              <span>Core Game Architecture</span>
            </div>
            <h2 className="font-display font-black text-3xl sm:text-4xl lg:text-5xl text-white tracking-tight mb-4">
              Engineered for Tactile Mastery
            </h2>
            <p className="font-sans text-base sm:text-lg text-slate-400">
              TORQ combines satisfying spatial puzzle mechanics with authentic physical modeling.
            </p>
          </div>

          {/* 6 Feature Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="p-7 rounded-2xl bg-[#0A101A] border border-slate-800 hover:border-amber-500/40 transition-all duration-300 shadow-xl group">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-5 group-hover:scale-110 transition-transform">
                <Compass className="w-6 h-6" />
              </div>
              <h3 className="font-display font-bold text-xl text-white mb-2">
                Real-Time 3D Physics
              </h3>
              <p className="font-sans text-sm text-slate-400 leading-relaxed">
                Plates don&apos;t just disappear—they fall, collide, and interact dynamically under gravity when freed from their retaining screws.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-7 rounded-2xl bg-[#0A101A] border border-slate-800 hover:border-sky-500/40 transition-all duration-300 shadow-xl group">
              <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 mb-5 group-hover:scale-110 transition-transform">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="font-display font-bold text-xl text-white mb-2">
                Color Match &amp; Sort Loops
              </h3>
              <p className="font-sans text-sm text-slate-400 leading-relaxed">
                Extract matching screws into conveyor boxes. Clear the dock before running out of slots to keep your tactical flow going.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-7 rounded-2xl bg-[#0A101A] border border-purple-500/40 transition-all duration-300 shadow-xl group">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-5 group-hover:scale-110 transition-transform">
                <Layers className="w-6 h-6" />
              </div>
              <h3 className="font-display font-bold text-xl text-white mb-2">
                360° Orbit Inspection
              </h3>
              <p className="font-sans text-sm text-slate-400 leading-relaxed">
                Swipe or drag to orbit around the assembly in true 3D perspective to reveal screws trapped beneath lower plate layers.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="p-7 rounded-2xl bg-[#0A101A] border border-slate-800 hover:border-amber-500/40 transition-all duration-300 shadow-xl group">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-5 group-hover:scale-110 transition-transform">
                <Hammer className="w-6 h-6" />
              </div>
              <h3 className="font-display font-bold text-xl text-white mb-2">
                Heavy Anvil Hammer &amp; Boosters
              </h3>
              <p className="font-sans text-sm text-slate-400 leading-relaxed">
                Stuck on a stubborn board? Shatter obstructing plates with the heavy hammer, expand your spare dock, or invoke the smart solver.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="p-7 rounded-2xl bg-[#0A101A] border border-emerald-500/40 transition-all duration-300 shadow-xl group">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-5 group-hover:scale-110 transition-transform">
                <Radio className="w-6 h-6" />
              </div>
              <h3 className="font-display font-bold text-xl text-white mb-2">
                Uranium Auto-Play Reactor
              </h3>
              <p className="font-sans text-sm text-slate-400 leading-relaxed">
                Fuel the radioactive neon-green reactor core and watch the autonomous puzzle solver analyze and clear moves in real time.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="p-7 rounded-2xl bg-[#0A101A] border border-rose-500/40 transition-all duration-300 shadow-xl group">
              <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-5 group-hover:scale-110 transition-transform">
                <Cpu className="w-6 h-6" />
              </div>
              <h3 className="font-display font-bold text-xl text-white mb-2">
                Infinite Procedural Assembly
              </h3>
              <p className="font-sans text-sm text-slate-400 leading-relaxed">
                Dynamic difficulty algorithms craft intricate multi-layer assemblies tailored to your skill. No two puzzle runs are ever identical.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Procedural Soundscape Engine Section */}
      <SoundboardPreview />

      {/* 4. In-Engine Screenshots Gallery */}
      <ScreenshotGallery />

      {/* 5. Final Download & Play Call To Action */}
      <section className="py-20 relative overflow-hidden bg-gradient-to-b from-[#05080C] to-[#070A0F] border-t border-slate-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <div className="p-10 sm:p-14 rounded-3xl bg-[#0C131F] border border-amber-500/40 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-[100px] pointer-events-none" />

            <span className="inline-block px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 font-mono text-xs font-bold uppercase tracking-wider mb-4 border border-amber-500/30">
              Instant Access · Free to Play
            </span>

            <h2 className="font-display font-black text-3xl sm:text-5xl text-white mb-4">
              Ready to Test Your Mechanical IQ?
            </h2>

            <p className="font-sans text-base sm:text-lg text-slate-300 max-w-xl mx-auto mb-8">
              Play directly in your browser or install on Android for full physical haptics and seamless cloud sync across all your devices.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href="https://play.google.com/store/apps/details?id=com.torq.screwplatepuzzle"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto px-8 py-4 rounded-2xl font-display font-bold text-base text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.5)] transition-all flex items-center justify-center gap-3 cursor-pointer"
              >
                <Download className="w-5 h-5 stroke-[2.5]" />
                <span>Download on Google Play</span>
              </a>

              <button
                onClick={() => navigate('play')}
                className="w-full sm:w-auto px-8 py-4 rounded-2xl font-display font-bold text-base text-white bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-sky-400/60 transition-all flex items-center justify-center gap-2.5 cursor-pointer"
              >
                <Play className="w-5 h-5 text-sky-400 fill-sky-400" />
                <span>Launch Web Edition</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Comprehensive Footer */}
      <footer className="bg-[#05080C] border-t border-slate-800/80 py-12 text-sm text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
            {/* Col 1: Brand Info */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="font-display font-black text-2xl tracking-wider text-white">
                  TORQ
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40">
                  3D
                </span>
              </div>
              <p className="font-sans text-xs text-slate-400 leading-relaxed">
                The authentic 3D screw-matching mechanical puzzle simulation. Built with Three.js, Web Audio API, and tactile physics.
              </p>
            </div>

            {/* Col 2: Navigation */}
            <div>
              <h4 className="font-display font-bold text-sm text-white uppercase tracking-wider mb-3">
                Explore
              </h4>
              <ul className="space-y-2 text-xs">
                <li>
                  <button onClick={() => navigate('play')} className="hover:text-amber-400 cursor-pointer">
                    Play Web Edition
                  </button>
                </li>
                <li>
                  <a href="#features" className="hover:text-amber-400 cursor-pointer">
                    Gameplay Features
                  </a>
                </li>
                <li>
                  <a href="#soundscapes" className="hover:text-amber-400 cursor-pointer">
                    Soundscape Synthesizer
                  </a>
                </li>
                <li>
                  <a href="#screenshots" className="hover:text-amber-400 cursor-pointer">
                    In-Engine Screenshots
                  </a>
                </li>
              </ul>
            </div>

            {/* Col 3: Legal & Compliance */}
            <div>
              <h4 className="font-display font-bold text-sm text-white uppercase tracking-wider mb-3">
                Compliance &amp; Policy
              </h4>
              <ul className="space-y-2 text-xs">
                <li>
                  <button onClick={() => navigate('privacy')} className="hover:text-amber-400 cursor-pointer">
                    Privacy Policy (Google Play)
                  </button>
                </li>
                <li>
                  <button onClick={() => navigate('terms')} className="hover:text-amber-400 cursor-pointer">
                    Terms of Service
                  </button>
                </li>
                <li>
                  <button onClick={() => navigate('support')} className="hover:text-amber-400 cursor-pointer">
                    Data Deletion &amp; Help Desk
                  </button>
                </li>
                <li>
                  <button onClick={() => navigate('press')} className="hover:text-amber-400 cursor-pointer">
                    Press Kit &amp; Media Assets
                  </button>
                </li>
              </ul>
            </div>

            {/* Col 4: Platform & Support */}
            <div>
              <h4 className="font-display font-bold text-sm text-white uppercase tracking-wider mb-3">
                Platforms &amp; Help
              </h4>
              <ul className="space-y-2 text-xs">
                <li>
                  <a
                    href="https://play.google.com/store/apps/details?id=com.torq.screwplatepuzzle"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-amber-400 flex items-center gap-1"
                  >
                    <span>Google Play Store</span>
                    <ExternalLink className="w-3 h-3 text-slate-500" />
                  </a>
                </li>
                <li>
                  <span className="text-slate-500">Direct Support: support@torqgame.com</span>
                </li>
                <li>
                  <span className="text-slate-500">Press Inquiries: press@torqgame.com</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 font-mono gap-4">
            <p>© 2026 TORQ Studio. All rights reserved.</p>
            <p>Designed for Google Play Games Level Up Experience Guidelines.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

