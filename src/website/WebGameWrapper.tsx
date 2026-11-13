import React, { useState } from 'react';
import { ArrowLeft, Download, ChevronUp, ChevronDown, Sparkles } from 'lucide-react';
import { WebRoute } from './router';

interface WebGameWrapperProps {
  navigate: (route: WebRoute) => void;
  children: React.ReactNode;
}

export function WebGameWrapper({ navigate, children }: WebGameWrapperProps) {
  const [isBannerVisible, setIsBannerVisible] = useState(true);

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#070A0F]">
      {/* Sleek Floating Top Navigation Banner for Web Visitors */}
      {isBannerVisible ? (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 flex items-center justify-between gap-4 px-4 py-2 rounded-xl bg-[#0C131F]/95 border border-amber-500/40 backdrop-blur-md shadow-[0_8px_30px_rgba(0,0,0,0.85)] max-w-4xl w-[95%] sm:w-auto transition-all animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Return to Website */}
          <button
            onClick={() => navigate('home')}
            className="flex items-center gap-1.5 text-xs font-mono font-bold text-amber-400 hover:text-amber-300 cursor-pointer transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Website</span>
          </button>

          {/* Web Mode Badge */}
          <div className="hidden sm:flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-mono text-xs text-slate-300 font-semibold tracking-wide">
              TORQ 3D Web Edition
            </span>
          </div>

          {/* Google Play CTA */}
          <div className="flex items-center gap-2">
            <a
              href="https://play.google.com/store/apps/details?id=com.torq.screwplatepuzzle"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-display font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 shadow-md transition-all cursor-pointer"
            >
              <Download className="w-3 h-3 stroke-[2.5]" />
              <span>Get Android App</span>
            </a>

            {/* Collapse button */}
            <button
              onClick={() => setIsBannerVisible(false)}
              className="p-1 text-slate-400 hover:text-white cursor-pointer"
              title="Minimize Header"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        /* Minimized pill */
        <button
          onClick={() => setIsBannerVisible(true)}
          className="absolute top-2 right-4 z-50 px-2.5 py-1 rounded-lg bg-[#0C131F]/90 border border-slate-700/80 text-[11px] font-mono text-slate-400 hover:text-amber-400 backdrop-blur-md shadow-lg flex items-center gap-1 cursor-pointer"
        >
          <span>Web Menu</span>
          <ChevronDown className="w-3 h-3" />
        </button>
      )}

      {/* The Full Game Canvas & HUD */}
      <div className="w-full h-full">{children}</div>
    </div>
  );
}

