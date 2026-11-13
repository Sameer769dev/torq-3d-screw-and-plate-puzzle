import React from 'react';
import { Shield, ArrowLeft, Lock, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { WebRoute } from './router';

interface PrivacyPolicyProps {
  navigate: (route: WebRoute) => void;
}

export function PrivacyPolicy({ navigate }: PrivacyPolicyProps) {
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
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-xs font-semibold uppercase tracking-wider mb-4">
            <Shield className="w-3.5 h-3.5" />
            <span>Google Play Policy Compliant</span>
          </div>
          <h1 className="font-display font-black text-3xl sm:text-4xl lg:text-5xl text-white tracking-tight mb-3">
            Privacy Policy
          </h1>
          <p className="font-mono text-xs text-slate-400">
            Last Updated: November 13, 2026 · TORQ: 3D Screw &amp; Plate Puzzle
          </p>
        </div>

        {/* Main Policy Content */}
        <div className="space-y-10 text-sm leading-relaxed text-slate-300 font-sans">
          <section className="space-y-3">
            <h2 className="font-display font-bold text-xl text-white flex items-center gap-2">
              <span className="text-amber-400 font-mono">1.</span> Introduction &amp; Scope
            </h2>
            <p>
              This Privacy Policy explains how <strong>TORQ: 3D Screw &amp; Plate Puzzle</strong> (&quot;we&quot;, &quot;our&quot;, or &quot;the Game&quot;)
              handles player information. We are committed to transparency, player privacy, and compliance with the{' '}
              <a
                href="https://play.google.com/about/developer-content-policy/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-400 underline hover:text-amber-300"
              >
                Google Play Developer Program Policies
              </a>
              , including the User Data Policy and Families Policy.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display font-bold text-xl text-white flex items-center gap-2">
              <span className="text-amber-400 font-mono">2.</span> Information We Process
            </h2>
            <p>
              TORQ is designed with a privacy-first approach. We do <strong>not</strong> require you to register an account with real names,
              email addresses, physical addresses, or phone numbers to play the game.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="p-4 rounded-xl bg-[#0C131F] border border-slate-800">
                <h3 className="font-display font-bold text-base text-amber-300 mb-2 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Gameplay Progression Data
                </h3>
                <p className="text-xs text-slate-400">
                  Current level, board state, score, unlocked soundscape packs (Industrial, Cybernetic, Clockwork), and daily streak history.
                  This data is stored locally on your device and optionally synchronized to your Google Play Games account.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#0C131F] border border-slate-800">
                <h3 className="font-display font-bold text-base text-amber-300 mb-2 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Cloud Save Data (Saved Games)
                </h3>
                <p className="text-xs text-slate-400">
                  When signed in with Google Play Games, progress binary blobs (&lt;100 KB) are transmitted securely using Google Play Games
                  Services APIs to allow seamless cross-device resumption and backup.
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="font-display font-bold text-xl text-white flex items-center gap-2">
              <span className="text-amber-400 font-mono">3.</span> Third-Party Services &amp; SDKs
            </h2>
            <p>
              The Game integrates certified, industry-standard third-party SDKs provided by Google to deliver essential game features:
            </p>
            <ul className="list-disc list-inside space-y-2 pl-2 text-slate-300 text-xs sm:text-sm">
              <li>
                <strong>Google Play Games Services:</strong> Used for player authentication, cloud save synchronization, and achievement tracking.
                Subject to the{' '}
                <a
                  href="https://policies.google.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-400 underline hover:text-sky-300"
                >
                  Google Privacy Policy
                </a>.
              </li>
              <li>
                <strong>Google Mobile Ads (AdMob):</strong> Used to deliver optional rewarded videos and native ads. AdMob may collect pseudonymous
                device identifiers and diagnostic data. Personalized ads are restricted according to user settings and family guidelines.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-display font-bold text-xl text-white flex items-center gap-2">
              <span className="text-amber-400 font-mono">4.</span> Children&apos;s Online Privacy (COPPA Compliance)
            </h2>
            <p>
              TORQ is a physics puzzle designed for a general audience. We do not knowingly collect personal data from children under the age of 13
              (or the applicable age in your jurisdiction). If you believe a child has provided us with personal information, please contact us immediately
              and we will delete such data from our records.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display font-bold text-xl text-white flex items-center gap-2">
              <span className="text-amber-400 font-mono">5.</span> User Rights &amp; Data Deletion (Google Play Compliance)
            </h2>
            <p>
              In accordance with Google Play&apos;s Data Deletion Policy, players have full control over their game data and can request deletion at any time:
            </p>
            <div className="p-4 rounded-xl bg-[#0C131F] border border-amber-500/30 text-xs sm:text-sm space-y-2">
              <p className="font-bold text-white flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-400" />
                How to Delete Your Saved Game Data:
              </p>
              <ol className="list-decimal list-inside space-y-1.5 pl-2 text-slate-300">
                <li>
                  <strong>Local Device Data:</strong> On your Android device, go to <em>Settings &gt; Apps &gt; TORQ &gt; Storage &gt; Clear Data</em>.
                </li>
                <li>
                  <strong>Google Play Games Cloud Save:</strong> Open the <em>Google Play Games</em> app, tap your Profile, go to <em>Settings &gt; Delete Play Games account &amp; data</em>, and select TORQ to permanently delete all cloud saves.
                </li>
                <li>
                  <strong>Direct Developer Assistance:</strong> You may also email us directly at{' '}
                  <span className="font-mono text-amber-400 font-bold">support@torqgame.com</span> with your Player ID for manual cloud save purge.
                </li>
              </ol>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="font-display font-bold text-xl text-white flex items-center gap-2">
              <span className="text-amber-400 font-mono">6.</span> Security Standards
            </h2>
            <p>
              All communication between the Game and Google Play Games Services utilizes encrypted HTTPS/TLS protocols. We maintain strict internal safeguards
              against unauthorized access, modification, or disclosure of data.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display font-bold text-xl text-white flex items-center gap-2">
              <span className="text-amber-400 font-mono">7.</span> Contact Us
            </h2>
            <p>
              If you have any questions or concerns regarding this Privacy Policy or your data, please contact our Data Protection Team at:
            </p>
            <div className="p-4 rounded-xl bg-[#0A101A] border border-slate-800 font-mono text-xs text-slate-300 space-y-1">
              <p><span className="text-slate-500">Project:</span> TORQ: 3D Screw &amp; Plate Puzzle</p>
              <p><span className="text-slate-500">Support Email:</span> <span className="text-amber-400">support@torqgame.com</span></p>
              <p><span className="text-slate-500">Website:</span> https://torqgame.com</p>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-slate-800 flex justify-between items-center text-xs text-slate-500 font-mono">
          <span>© 2026 TORQ Studio. All rights reserved.</span>
          <button
            onClick={() => navigate('terms')}
            className="text-amber-400 hover:underline cursor-pointer"
          >
            Terms of Service →
          </button>
        </div>
      </div>
    </div>
  );
}

