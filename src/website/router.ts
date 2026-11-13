import { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';

export type WebRoute = 'home' | 'play' | 'privacy' | 'terms' | 'support' | 'press';

export function getInitialRoute(): WebRoute {
  // If running on native Android/iOS Capacitor app, ALWAYS boot straight to the game
  if (Capacitor.isNativePlatform()) {
    return 'play';
  }

  if (typeof window === 'undefined') return 'home';

  const path = window.location.pathname.toLowerCase();
  const hash = window.location.hash.toLowerCase().replace('#', '');
  const params = new URLSearchParams(window.location.search);
  const pageParam = params.get('page')?.toLowerCase();

  // Explicit query param
  if (pageParam === 'play' || pageParam === 'game') return 'play';
  if (pageParam === 'privacy') return 'privacy';
  if (pageParam === 'terms') return 'terms';
  if (pageParam === 'support') return 'support';
  if (pageParam === 'press') return 'press';

  // Check URL pathname
  if (path.includes('/play') || path.includes('/game')) return 'play';
  if (path.includes('/privacy')) return 'privacy';
  if (path.includes('/terms')) return 'terms';
  if (path.includes('/support')) return 'support';
  if (path.includes('/press')) return 'press';

  // Check hash fallback for static servers
  if (hash.includes('play') || hash.includes('game')) return 'play';
  if (hash.includes('privacy')) return 'privacy';
  if (hash.includes('terms')) return 'terms';
  if (hash.includes('support')) return 'support';
  if (hash.includes('press')) return 'press';

  return 'home';
}

export function useWebRouter() {
  const [currentRoute, setCurrentRoute] = useState<WebRoute>(() => getInitialRoute());

  useEffect(() => {
    if (Capacitor.isNativePlatform()) return;

    const handleLocationChange = () => {
      setCurrentRoute(getInitialRoute());
    };

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  const navigate = useCallback((route: WebRoute) => {
    if (Capacitor.isNativePlatform()) return;

    const targetPath = route === 'home' ? '/' : `/${route}`;
    try {
      window.history.pushState({}, '', targetPath);
    } catch {
      window.location.hash = route;
    }
    setCurrentRoute(route);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return { currentRoute, navigate };
}

