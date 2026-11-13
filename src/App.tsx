import React, { Suspense, lazy } from 'react';
import { Capacitor } from '@capacitor/core';
import { useWebRouter } from './website/router';
import { LandingPage } from './website/LandingPage';
import { WebGameWrapper } from './website/WebGameWrapper';

// Code-split routes so landing page loads ultra-fast
const TorqGame = lazy(() => import('./TorqGame'));
const PrivacyPolicy = lazy(() => import('./website/PrivacyPolicy').then(m => ({ default: m.PrivacyPolicy })));
const TermsOfService = lazy(() => import('./website/TermsOfService').then(m => ({ default: m.TermsOfService })));
const SupportPage = lazy(() => import('./website/SupportPage').then(m => ({ default: m.SupportPage })));
const PressKitPage = lazy(() => import('./website/PressKitPage').then(m => ({ default: m.PressKitPage })));

function RouteFallback() {
  return (
    <div className="min-h-screen w-full bg-[#070A0F] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-amber-400/20 border-t-amber-400 animate-spin" />
        <span className="font-mono text-xs text-slate-400 tracking-widest uppercase">
          Initializing TORQ Engine...
        </span>
      </div>
    </div>
  );
}

export default function App() {
  const isNative = Capacitor.isNativePlatform();
  const { currentRoute, navigate } = useWebRouter();

  // If running inside Android/iOS native app, directly render the full-screen game
  if (isNative) {
    return (
      <div className="fixed inset-0 w-full h-full overflow-hidden bg-[#070A0F]">
        <Suspense fallback={<RouteFallback />}>
          <TorqGame />
        </Suspense>
      </div>
    );
  }

  // Web routes
  if (currentRoute === 'play') {
    return (
      <WebGameWrapper navigate={navigate}>
        <div className="fixed inset-0 w-full h-full overflow-hidden bg-[#070A0F]">
          <Suspense fallback={<RouteFallback />}>
            <TorqGame />
          </Suspense>
        </div>
      </WebGameWrapper>
    );
  }

  if (currentRoute === 'privacy') {
    return (
      <Suspense fallback={<RouteFallback />}>
        <PrivacyPolicy navigate={navigate} />
      </Suspense>
    );
  }

  if (currentRoute === 'terms') {
    return (
      <Suspense fallback={<RouteFallback />}>
        <TermsOfService navigate={navigate} />
      </Suspense>
    );
  }

  if (currentRoute === 'support') {
    return (
      <Suspense fallback={<RouteFallback />}>
        <SupportPage navigate={navigate} />
      </Suspense>
    );
  }

  if (currentRoute === 'press') {
    return (
      <Suspense fallback={<RouteFallback />}>
        <PressKitPage navigate={navigate} />
      </Suspense>
    );
  }

  // Default is Landing Page ('home')
  return <LandingPage currentRoute={currentRoute} navigate={navigate} />;
}
