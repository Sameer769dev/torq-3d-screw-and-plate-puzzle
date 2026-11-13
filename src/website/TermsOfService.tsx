import React from 'react';
import { FileText, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { WebRoute } from './router';

interface TermsOfServiceProps {
  navigate: (route: WebRoute) => void;
}

export function TermsOfService({ navigate }: TermsOfServiceProps) {
  return (
    <div className="min-h-screen bg-[#070A0F] text-slate-200 py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
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
            <span>Legal Agreement</span>
          </div>
          <h1 className="font-display font-black text-3xl sm:text-4xl lg:text-5xl text-white tracking-tight mb-3">
            Terms of Service
          </h1>
          <p className="font-mono text-xs text-slate-400">
            Effective Date: November 13, 2026 · TORQ: 3D Screw &amp; Plate Puzzle
          </p>
        </div>

        {/* Terms Content */}
        <div className="space-y-10 text-sm leading-relaxed text-slate-300 font-sans">
          <section className="space-y-3">
            <h2 className="font-display font-bold text-xl text-white flex items-center gap-2">
              <span className="text-amber-400 font-mono">1.</span> Acceptance of Terms
            </h2>
            <p>
              By downloading, installing, accessing, or playing <strong>TORQ: 3D Screw &amp; Plate Puzzle</strong> (the &quot;Game&quot;),
              you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not install or use the Game.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display font-bold text-xl text-white flex items-center gap-2">
              <span className="text-amber-400 font-mono">2.</span> Limited License
            </h2>
            <p>
              We grant you a personal, non-exclusive, non-transferable, revocable license to access and play the Game for your personal,
              non-commercial entertainment on supported Android devices and compatible web browsers.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display font-bold text-xl text-white flex items-center gap-2">
              <span className="text-amber-400 font-mono">3.</span> Virtual Boosters &amp; Gameplay Items
            </h2>
            <p>
              The Game includes virtual power-ups (such as the Heavy Hammer, Dock Expansions, and Uranium Reactor charges) earned through puzzle
              completion or voluntary rewarded advertisements. These virtual items have no real-world monetary value, cannot be redeemed for cash,
              and are strictly non-transferable.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display font-bold text-xl text-white flex items-center gap-2">
              <span className="text-amber-400 font-mono">4.</span> Intellectual Property
            </h2>
            <p>
              All titles, ownership rights, and intellectual property rights in and to the Game (including without limitation all 3D procedural models,
              physics routines, software code, UI designs, soundscape algorithms, and visual branding) are owned exclusively by TORQ Studio.
              You agree not to reverse engineer, decompile, or modify any part of the Game.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display font-bold text-xl text-white flex items-center gap-2">
              <span className="text-amber-400 font-mono">5.</span> Disclaimer of Warranties
            </h2>
            <p>
              The Game is provided on an &quot;AS IS&quot; and &quot;AS AVAILABLE&quot; basis without warranties of any kind, whether express or implied.
              We do not guarantee uninterrupted, error-free, or bug-free operation across all third-party Android hardware configurations.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display font-bold text-xl text-white flex items-center gap-2">
              <span className="text-amber-400 font-mono">6.</span> Limitation of Liability
            </h2>
            <p>
              To the maximum extent permitted by applicable law, in no event shall TORQ Studio be liable for any indirect, incidental, special,
              or consequential damages resulting from the use or inability to use the Game.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display font-bold text-xl text-white flex items-center gap-2">
              <span className="text-amber-400 font-mono">7.</span> Contact Information
            </h2>
            <p>
              For any questions or legal inquiries, please contact:
            </p>
            <div className="p-4 rounded-xl bg-[#0A101A] border border-slate-800 font-mono text-xs text-slate-300">
              <p>Email: <span className="text-amber-400">legal@torqgame.com</span></p>
              <p>Website: https://torqgame.com</p>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-slate-800 flex justify-between items-center text-xs text-slate-500 font-mono">
          <span>© 2026 TORQ Studio. All rights reserved.</span>
          <button
            onClick={() => navigate('privacy')}
            className="text-amber-400 hover:underline cursor-pointer"
          >
            Privacy Policy →
          </button>
        </div>
      </div>
    </div>
  );
}

