'use client';

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from '@/shared/theme/ThemeProvider';
import { THEME_CHOICES, type ThemeChoice } from '@/shared/theme/theme';
import { cn } from '@/shared/lib/utils';

const OPTIONS: Record<ThemeChoice, { label: string; hint: string; icon: typeof Sun }> = {
  light: { label: 'Light', hint: 'Always light', icon: Sun },
  dark: { label: 'Dark', hint: 'Always dark', icon: Moon },
  system: { label: 'System', hint: 'Match my device', icon: Monitor },
};

/**
 * Theme picker.
 *
 * The active option is highlighted by CSS attribute selectors on `<html>`
 * (see globals.css), not by React state, so it is already correct on the first
 * paint — before hydration has told this component what is stored. React state
 * only drives the ARIA attributes, which it fills in once mounted.
 */
export function ThemeToggle({
  variant = 'menu',
  className,
}: {
  /** `menu` for tight chrome (a header); `segmented` where there is room. */
  variant?: 'menu' | 'segmented';
  className?: string;
}) {
  if (variant === 'segmented') return <SegmentedToggle className={className} />;
  return <MenuToggle className={className} />;
}

function SegmentedToggle({ className }: { className?: string }) {
  const { theme, setTheme, isMounted } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className={cn(
        'inline-flex items-center gap-0.5 rounded-control border border-line bg-surface-sunken p-0.5',
        className
      )}
    >
      {THEME_CHOICES.map((choice) => {
        const { label, icon: Icon } = OPTIONS[choice];
        return (
          <button
            key={choice}
            type="button"
            role="radio"
            aria-checked={isMounted && theme === choice}
            aria-label={label}
            title={label}
            data-theme-value={choice}
            onClick={() => setTheme(choice)}
            className={cn(
              'theme-option theme-option-thumb flex h-7 w-8 cursor-pointer items-center justify-center rounded-[0.3rem]',
              'transition-colors duration-150 hover:text-ink'
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}

function MenuToggle({ className }: { className?: string }) {
  const { theme, setTheme, isMounted } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  const close = useCallback((returnFocus = false) => {
    setIsOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close(true);
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, close]);

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        aria-label={
          isMounted ? `Colour theme: ${OPTIONS[theme].label}. Change theme` : 'Change colour theme'
        }
        className="cursor-pointer rounded-control p-2 text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
      >
        {/* Both glyphs ship; CSS reveals the one matching the active scheme. */}
        <Sun className="theme-icon-light h-5 w-5" aria-hidden="true" />
        <Moon className="theme-icon-dark h-5 w-5" aria-hidden="true" />
      </button>

      {isOpen && (
        <div
          id={menuId}
          role="menu"
          aria-label="Colour theme"
          className="animate-scale-in absolute right-0 top-full z-50 mt-2 w-44 overflow-hidden rounded-card border border-line bg-surface-raised p-1 shadow-overlay"
        >
          {THEME_CHOICES.map((choice) => {
            const { label, hint, icon: Icon } = OPTIONS[choice];
            const isActive = isMounted && theme === choice;
            return (
              <button
                key={choice}
                type="button"
                role="menuitemradio"
                aria-checked={isActive}
                data-theme-value={choice}
                onClick={() => {
                  setTheme(choice);
                  close(true);
                }}
                className={cn(
                  'theme-option theme-option-row flex w-full cursor-pointer items-center gap-2.5 rounded-control px-2.5 py-2 text-left',
                  'transition-colors duration-150 hover:text-ink'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold">{label}</span>
                  <span className="block text-3xs text-ink-subtle">{hint}</span>
                </span>
                {isActive && <Check className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
