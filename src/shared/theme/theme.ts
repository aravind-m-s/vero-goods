/**
 * Theme model, shared by the inline boot script, the provider and the picker.
 *
 * `system` is the default and is represented by the *absence* of the
 * `data-theme` attribute, so the `prefers-color-scheme` rules in globals.css
 * stay in charge. `light` and `dark` are explicit overrides.
 */
export const THEME_CHOICES = ['light', 'dark', 'system'] as const;

export type ThemeChoice = (typeof THEME_CHOICES)[number];
/** What is actually painted — `system` has already been resolved. */
export type ResolvedTheme = 'light' | 'dark';

export const DEFAULT_THEME: ThemeChoice = 'system';

export const THEME_STORAGE_KEY = 'vero-theme';

export const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)';

export function isThemeChoice(value: unknown): value is ThemeChoice {
  return typeof value === 'string' && (THEME_CHOICES as readonly string[]).includes(value);
}

/** Reads the stored choice. Returns the default when storage is blocked. */
export function readStoredTheme(): ThemeChoice {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeChoice(stored) ? stored : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function getSystemTheme(): ResolvedTheme {
  return window.matchMedia(DARK_MEDIA_QUERY).matches ? 'dark' : 'light';
}

export function resolveTheme(choice: ThemeChoice): ResolvedTheme {
  return choice === 'system' ? getSystemTheme() : choice;
}

/** Writes the choice to `<html>`. Removing the attribute *is* "system". */
export function applyThemeAttribute(choice: ThemeChoice): void {
  const root = document.documentElement;
  if (choice === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', choice);
}

/**
 * Runs synchronously in <head>, before the browser paints anything, so a
 * visitor who chose dark never sees a white page first. Kept as a hand-minified
 * string because it is inlined into every HTML response.
 *
 * See node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY
)});var d=document.documentElement;if(t==="light"||t==="dark"){d.setAttribute("data-theme",t)}else{d.removeAttribute("data-theme")}}catch(e){}})()`;
