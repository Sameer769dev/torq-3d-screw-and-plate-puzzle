import React, { useState } from 'react';
import { Play, Download, Menu, X, Shield, Volume2, Sparkles, FileText, HelpCircle } from 'lucide-react';
import { WebRoute } from './router';

interface NavbarProps {
  currentRoute: WebRoute;
  navigate: (route: WebRoute) => void;
}

export function Navbar({ currentRoute, navigate }: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNavClick = (route: WebRoute, anchorId?: string) => {
    setMobileMenuOpen(false);
    if (currentRoute !== 'home' && anchorId) {
      navigate('home');
      setTimeout(() => {
        const el = document.getElementById(anchorId);
        el?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } else if (anchorId) {
      const el = document.getElementById(anchorId);
      el?.scrollIntoView({ behavior: 'smooth' });
    } else {
      navigate(route);
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full backdrop-blur-xl bg-[#070A0F]/90 border-b border-amber-500/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        {/* Brand Logo & Emblem */}
        <button
          onClick={() => navigate('home')}
          className="flex items-center gap-3.5 group cursor-pointer focus:outline-none"
        >
          <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 via-amber-600 to-amber-700 p-[1.5px] shadow-[0_0_20px_rgba(245,158,11,0.35)] group-hover:scale-105 transition-transform duration-200">
            <div className="w-full h-full rounded-[10px] bg-[#070A0F] flex items-center justify-center overflow-hidden">
              <img
                src="/assets/store/app_icon_512x512.png"
                alt="TORQ Emblem"
                className="w-8 h-8 object-contain"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <span className="font-display font-black text-amber-400 text-lg tracking-tighter">T</span>
            </div>
          </div>
          <div className="text-left">
            <div className="flex items-center gap-1.5">
              <span className="font-display font-black text-2xl tracking-wider text-white group-hover:text-amber-400 transition-colors">
                TORQ
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40">
                3D
              </span>
            </div>
            <p className="text-[10px] font-mono tracking-widest text-slate-400 uppercase -mt-1">
              SCREW &amp; PLATE PUZZLE
            </p>
          </div>
        </button>

        {/* Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center gap-7">
          <button
            onClick={() => handleNavClick('home', 'features')}
            className="text-sm font-medium text-slate-300 hover:text-amber-400 transition-colors cursor-pointer"
          >
            Features
          </button>
          <button
            onClick={() => handleNavClick('home', 'soundscapes')}
            className="text-sm font-medium text-slate-300 hover:text-amber-400 transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
            Soundscapes
          </button>
          <button
            onClick={() => handleNavClick('home', 'screenshots')}
            className="text-sm font-medium text-slate-300 hover:text-amber-400 transition-colors cursor-pointer"
          >
            Screenshots
          </button>
          <button
            onClick={() => handleNavClick('press')}
            className={`text-sm font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              currentRoute === 'press' ? 'text-amber-400 font-bold' : 'text-slate-300 hover:text-amber-400'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-amber-400" />
            Press Kit
          </button>
          <button
            onClick={() => handleNavClick('support')}
            className={`text-sm font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              currentRoute === 'support' ? 'text-amber-400 font-bold' : 'text-slate-300 hover:text-amber-400'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5 text-emerald-400" />
            Support
          </button>
        </nav>

        {/* Action CTAs */}
        <div className="hidden sm:flex items-center gap-3">
          {/* Instant Web Demo CTA */}
          <button
            onClick={() => navigate('play')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-display font-bold text-white bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700 hover:border-sky-400/50 transition-all shadow-md cursor-pointer group"
          >
            <Play className="w-4 h-4 text-sky-400 fill-sky-400 group-hover:scale-110 transition-transform" />
            <span>Play Web Demo</span>
          </button>

          {/* Google Play Download CTA */}
          <a
            href="https://play.google.com/store/apps/details?id=com.torq.screwplatepuzzle"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-display font-bold text-slate-950 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400 hover:from-amber-300 hover:to-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.4)] hover:shadow-[0_0_28px_rgba(245,158,11,0.6)] transition-all cursor-pointer"
          >
            <Download className="w-4 h-4 stroke-[2.5]" />
            <span>Google Play</span>
          </a>
        </div>

        {/* Mobile Menu Hamburger */}
        <div className="flex lg:hidden items-center gap-2">
          <button
            onClick={() => navigate('play')}
            className="flex sm:hidden items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-bold text-white bg-slate-800 border border-slate-700"
          >
            <Play className="w-3 h-3 text-sky-400 fill-sky-400" />
            <span>Play</span>
          </button>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 focus:outline-none cursor-pointer"
            aria-label="Toggle Menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-[#0C131F] border-b border-amber-500/30 px-4 pt-3 pb-6 space-y-3 shadow-2xl animate-in slide-in-from-top-2 duration-200">
          <button
            onClick={() => handleNavClick('home', 'features')}
            className="w-full text-left py-2 px-3 rounded-lg text-sm font-medium text-slate-200 hover:bg-slate-800/80"
          >
            Gameplay Features
          </button>
          <button
            onClick={() => handleNavClick('home', 'soundscapes')}
            className="w-full text-left py-2 px-3 rounded-lg text-sm font-medium text-slate-200 hover:bg-slate-800/80 flex items-center gap-2"
          >
            <Volume2 className="w-4 h-4 text-cyan-400" />
            Soundscapes Synthesizer
          </button>
          <button
            onClick={() => handleNavClick('home', 'screenshots')}
            className="w-full text-left py-2 px-3 rounded-lg text-sm font-medium text-slate-200 hover:bg-slate-800/80"
          >
            In-Engine Screenshots
          </button>
          <button
            onClick={() => handleNavClick('press')}
            className="w-full text-left py-2 px-3 rounded-lg text-sm font-medium text-slate-200 hover:bg-slate-800/80 flex items-center gap-2"
          >
            <FileText className="w-4 h-4 text-amber-400" />
            Press Kit &amp; Media Assets
          </button>
          <button
            onClick={() => handleNavClick('support')}
            className="w-full text-left py-2 px-3 rounded-lg text-sm font-medium text-slate-200 hover:bg-slate-800/80 flex items-center gap-2"
          >
            <HelpCircle className="w-4 h-4 text-emerald-400" />
            Support &amp; Account Data
          </button>
          <button
            onClick={() => handleNavClick('privacy')}
            className="w-full text-left py-2 px-3 rounded-lg text-sm font-medium text-slate-200 hover:bg-slate-800/80 flex items-center gap-2"
          >
            <Shield className="w-4 h-4 text-slate-400" />
            Privacy Policy
          </button>
          <div className="pt-2 flex flex-col gap-2">
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                navigate('play');
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-display font-bold text-white bg-slate-800 border border-slate-700"
            >
              <Play className="w-4 h-4 text-sky-400 fill-sky-400" />
              <span>Launch Web Demo</span>
            </button>
            <a
              href="https://play.google.com/store/apps/details?id=com.torq.screwplatepuzzle"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-display font-bold text-slate-950 bg-amber-400 hover:bg-amber-300"
            >
              <Download className="w-4 h-4 stroke-[2.5]" />
              <span>Get on Google Play</span>
            </a>
          </div>
        </div>
      )}
    </header>
  );
}

