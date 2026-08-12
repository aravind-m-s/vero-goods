'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  DARK_MEDIA_QUERY,
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  applyThemeAttribute,
  isThemeChoice,
  readStoredTheme,
  resolveTheme,
  type ResolvedTheme,
  type ThemeChoice,
} from './theme';

interface ThemeContextValue {
  /** What the user picked: `light`, `dark`, or `system`. */
  theme: ThemeChoice;
  /** What is on screen right now — `system` already resolved against the OS. */
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemeChoice) => void;
  /**
   * False during SSR and the first client render. Anything that would differ
   * between server and client markup — an `aria-checked`, a label — must wait
   * for this, otherwise React reports a hydration mismatch.
   */
  isMounted: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

// useLayoutEffect does nothing on the server and React says so, loudly.
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

const SWITCH_ANIMATION_MS = 220;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // The server has no way to know the stored choice, so it renders the default
  // and the inline script in <head> corrects the DOM before first paint. State
  // catches up in the layout effect below.
  const [theme, setThemeState] = useState<ThemeChoice>(DEFAULT_THEME);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('light');
  const [isMounted, setIsMounted] = useState(false);
  const switchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useIsomorphicLayoutEffect(() => {
    const stored = readStoredTheme();
    // Re-apply rather than trust the inline script: React's Strict Mode remount
    // in development resets <html> to the attributes it manages from JSX and
    // drops the one the script set. A no-op in production.
    applyThemeAttribute(stored);
    setThemeState(stored);
    setIsMounted(true);
  }, []);

  // Track the OS scheme so `system` follows it live, without a reload.
  useEffect(() => {
    const query = window.matchMedia(DARK_MEDIA_QUERY);
    const sync = () => setResolvedTheme(resolveTheme(theme));
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, [theme]);

  // Keep every open tab in agreement.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY) return;
      const next = isThemeChoice(event.newValue) ? event.newValue : DEFAULT_THEME;
      applyThemeAttribute(next);
      setThemeState(next);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => () => {
    if (switchTimer.current) clearTimeout(switchTimer.current);
  }, []);

  const setTheme = useCallback((next: ThemeChoice) => {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Private mode or blocked storage: the choice still applies to this page.
    }

    // Cross-fade the colours, but only for this switch — a standing transition
    // on background-color would also animate every hover and route change.
    const root = document.documentElement;
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      root.setAttribute('data-theme-switching', '');
      if (switchTimer.current) clearTimeout(switchTimer.current);
      switchTimer.current = setTimeout(() => {
        root.removeAttribute('data-theme-switching');
      }, SWITCH_ANIMATION_MS);
    }

    applyThemeAttribute(next);
    setThemeState(next);
  }, []);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme, isMounted }),
    [theme, resolvedTheme, setTheme, isMounted]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside <ThemeProvider>');
  return context;
}
