import React, { useState } from 'react';
import { HelpCircle, ArrowLeft, Send, CheckCircle2, Cloud, Trash2, Cpu, Volume2, Shield } from 'lucide-react';
import { WebRoute } from './router';

interface SupportPageProps {
  navigate: (route: WebRoute) => void;
}

export function SupportPage({ navigate }: SupportPageProps) {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    playerId: '',
    category: 'cloud_save',
    message: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

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
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Player Support &amp; Knowledge Base</span>
          </div>
          <h1 className="font-display font-black text-3xl sm:text-4xl lg:text-5xl text-white tracking-tight mb-3">
            Support &amp; Data Center
          </h1>
          <p className="font-sans text-sm text-slate-400">
            Troubleshooting guides, Google Play Cloud Save assistance, and data deletion requests.
          </p>
        </div>

        {/* FAQ Cards */}
        <div className="space-y-6 mb-16">
          <h2 className="font-display font-bold text-2xl text-white mb-6">Frequently Asked Questions</h2>

          {/* 1. Cloud Save Sync */}
          <div className="p-6 rounded-2xl bg-[#0C131F] border border-slate-800">
            <h3 className="font-display font-bold text-lg text-amber-400 mb-2 flex items-center gap-2">
              <Cloud className="w-5 h-5 text-sky-400" />
              How does Cloud Save work across multiple devices?
            </h3>
            <p className="font-sans text-sm text-slate-300 leading-relaxed">
              TORQ uses <strong>Google Play Games Saved Games</strong>. When signed in, your game automatically backs up after every level
              completion and pause. If you install the game on a second tablet or phone, sign in with the same Google Play account and your
              progress will restore seamlessly. In case of any version discrepancy, TORQ presents an in-engine Conflict Resolution dialog
              allowing you to choose between your cloud save or local progress.
            </p>
          </div>

          {/* 2. Account & Data Deletion */}
          <div className="p-6 rounded-2xl bg-[#0C131F] border border-rose-500/30">
            <h3 className="font-display font-bold text-lg text-rose-400 mb-2 flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-rose-400" />
              How do I request account or saved game data deletion?
            </h3>
            <p className="font-sans text-sm text-slate-300 leading-relaxed mb-3">
              In compliance with Google Play&apos;s Data Deletion Policy, you have the right to request permanent deletion of all saved game progress:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-xs text-slate-300 pl-2">
              <li>
                <strong>Self-Service:</strong> In your device&apos;s <em>Google Play Games app &gt; Settings &gt; Delete Play Games account &amp; data</em>, select TORQ to purge all cloud save records instantly.
              </li>
              <li>
                <strong>Assisted Purge:</strong> Submit the contact form below with your Player ID, or email{' '}
                <span className="font-mono text-amber-400">support@torqgame.com</span> with the subject &quot;Data Deletion Request&quot;. We will purge all associated cloud data within 48 hours.
              </li>
            </ul>
          </div>

          {/* 3. Audio & Soundscapes */}
          <div className="p-6 rounded-2xl bg-[#0C131F] border border-slate-800">
            <h3 className="font-display font-bold text-lg text-amber-400 mb-2 flex items-center gap-2">
              <Volume2 className="w-5 h-5 text-cyan-400" />
              How do I unlock more Soundscape Packs?
            </h3>
            <p className="font-sans text-sm text-slate-300 leading-relaxed">
              TORQ features three procedural soundscape engines: <strong>Industrial Factory (IND)</strong> (unlocked by default),{' '}
              <strong>Cybernetic Synth (CYB)</strong> (unlocked by beating Level 5), and <strong>Clockwork Brass (CLK)</strong> (unlocked by beating Level 10).
              You can switch between them at any time in the Pause menu or Sound Settings panel.
            </p>
          </div>

          {/* 4. Offline Play */}
          <div className="p-6 rounded-2xl bg-[#0C131F] border border-slate-800">
            <h3 className="font-display font-bold text-lg text-amber-400 mb-2 flex items-center gap-2">
              <Cpu className="w-5 h-5 text-emerald-400" />
              Can I play TORQ offline without Wi-Fi?
            </h3>
            <p className="font-sans text-sm text-slate-300 leading-relaxed">
              Yes! 100% of the game simulation, Three.js 3D models, procedural level generator, and Web Audio synthesizers are embedded directly
              into the app bundle. No internet connection is required to play. When you reconnect to Wi-Fi, your offline progress will automatically
              sync to the cloud.
            </p>
          </div>
        </div>

        {/* Contact Form */}
        <div className="p-8 rounded-2xl bg-[#0A101A] border border-amber-500/30 shadow-2xl">
          <h2 className="font-display font-bold text-2xl text-white mb-2">Submit a Support Ticket</h2>
          <p className="font-sans text-xs sm:text-sm text-slate-400 mb-6">
            Have a bug report, cloud save question, or data deletion request? Fill out the form below.
          </p>

          {submitted ? (
            <div className="p-6 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center animate-in fade-in duration-300">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
              <h3 className="font-display font-bold text-xl text-white mb-1">Ticket Received!</h3>
              <p className="text-xs text-slate-300 font-sans">
                Our support team has logged your inquiry. We typically respond within 24–48 hours at{' '}
                <span className="font-mono text-amber-400">{formData.email}</span>.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1.5 uppercase tracking-wider">
                    Your Email <span className="text-amber-400">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="player@example.com"
                    className="w-full px-4 py-2.5 rounded-xl bg-[#070A0F] border border-slate-700 text-white text-sm focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1.5 uppercase tracking-wider">
                    Google Play Games Player ID (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.playerId}
                    onChange={(e) => setFormData({ ...formData, playerId: e.target.value })}
                    placeholder="e.g. Player#123456"
                    className="w-full px-4 py-2.5 rounded-xl bg-[#070A0F] border border-slate-700 text-white text-sm focus:outline-none focus:border-amber-400 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1.5 uppercase tracking-wider">
                  Issue Category <span className="text-amber-400">*</span>
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#070A0F] border border-slate-700 text-white text-sm focus:outline-none focus:border-amber-400"
                >
                  <option value="cloud_save">Cloud Save &amp; Progress Issue</option>
                  <option value="bug_report">Bug / Graphical Glitch</option>
                  <option value="data_deletion">Data Deletion Request</option>
                  <option value="general">Feedback / General Inquiry</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1.5 uppercase tracking-wider">
                  Message Details <span className="text-amber-400">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="Describe what occurred, your device model, and how we can assist..."
                  className="w-full px-4 py-2.5 rounded-xl bg-[#070A0F] border border-slate-700 text-white text-sm focus:outline-none focus:border-amber-400"
                />
              </div>

              <button
                type="submit"
                className="w-full sm:w-auto px-8 py-3 rounded-xl font-display font-bold text-sm text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
              >
                <Send className="w-4 h-4 stroke-[2.5]" />
                <span>Transmit Support Ticket</span>
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-slate-800 flex justify-between items-center text-xs text-slate-500 font-mono">
          <span>© 2026 TORQ Studio. Direct support: support@torqgame.com</span>
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

