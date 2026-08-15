'use client';

import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

/**
 * An overflow menu.
 *
 * Exists so a row of actions does not put a destructive one within a stray
 * click of a routine one. Everything a menu needs to be usable without a mouse
 * is here — arrow keys move between items, Escape closes and hands focus back,
 * Tab leaves — because a menu that only works by pointer quietly removes those
 * actions from anyone navigating by keyboard.
 */

const MenuContext = React.createContext<{ close: () => void }>({ close: () => {} });

const PANEL_WIDTH = 208;
const GAP = 4;
const VIEWPORT_MARGIN = 8;

export function DropdownMenu({
  label,
  align = 'end',
  children,
}: {
  /** Accessible name for the trigger, e.g. "More actions for Blue Widget". */
  label: string;
  align?: 'start' | 'end';
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  /**
   * The panel is rendered into `document.body`, not next to its trigger.
   *
   * The table scrolls horizontally, and an absolutely positioned panel inside
   * that container is clipped by it — the menu was cut off at the table edge
   * and needed the table scrolled to be read. A portal escapes every ancestor's
   * overflow; the cost is positioning it by hand, which is what this does.
   */
  const place = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const height = panelRef.current?.offsetHeight ?? 0;
    // Flip above the trigger when the panel would run off the bottom, so the
    // last row of a long table still opens a readable menu.
    const flipUp = height > 0 && rect.bottom + GAP + height > window.innerHeight - VIEWPORT_MARGIN;

    const preferredLeft = align === 'end' ? rect.right - PANEL_WIDTH : rect.left;

    setPosition({
      top: flipUp ? rect.top - GAP - height : rect.bottom + GAP,
      // Clamped so a trigger near either edge cannot push the panel off-screen.
      left: Math.min(
        Math.max(VIEWPORT_MARGIN, preferredLeft),
        window.innerWidth - PANEL_WIDTH - VIEWPORT_MARGIN
      ),
    });
  }, [align]);

  // Layout effect: the panel is measured and moved before the browser paints,
  // so it never appears in the wrong place first.
  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;

    // `true` catches scrolling inside the table itself, not just the window.
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, place]);

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;

    const items = () =>
      Array.from(panelRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);

    items()[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }
      // Tab is a deliberate exit, not a trap: unlike a modal, a menu should not
      // hold focus hostage.
      if (event.key === 'Tab') {
        setOpen(false);
        return;
      }
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;

      event.preventDefault();
      const all = items();
      if (all.length === 0) return;
      const index = all.indexOf(document.activeElement as HTMLElement);
      const next =
        event.key === 'ArrowDown'
          ? all[(index + 1) % all.length]
          : all[(index - 1 + all.length) % all.length];
      next?.focus();
    };

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      // The panel is no longer a DOM child of the trigger, so both have to be
      // checked or clicking an item would count as clicking outside.
      if (containerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open, close]);

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-control text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            id={menuId}
            role="menu"
            aria-label={label}
            style={{
              top: position?.top ?? 0,
              left: position?.left ?? 0,
              width: PANEL_WIDTH,
              // Hidden until measured, so it never flashes at the origin.
              visibility: position ? 'visible' : 'hidden',
            }}
            className={cn(
              'animate-scale-in fixed z-50 overflow-hidden rounded-card border border-line',
              'bg-surface-raised py-1 shadow-overlay'
            )}
          >
            <MenuContext.Provider value={{ close: () => setOpen(false) }}>
              {children}
            </MenuContext.Provider>
          </div>,
          document.body
        )}
    </div>
  );
}

export function DropdownMenuItem({
  onSelect,
  destructive,
  children,
}: {
  onSelect: () => void;
  /** Renders in the danger colour. Pair with a separator above it. */
  destructive?: boolean;
  children: React.ReactNode;
}) {
  const { close } = React.useContext(MenuContext);

  return (
    <button
      type="button"
      role="menuitem"
      onClick={() => {
        // Closed before the action runs: several of these open a dialog, and a
        // menu still sitting open behind it is focus nobody asked for.
        close();
        onSelect();
      }}
      className={cn(
        'flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left text-xs font-medium transition-colors focus:outline-none',
        destructive
          ? 'text-danger hover:bg-danger/10 focus:bg-danger/10'
          : 'text-ink-muted hover:bg-surface-sunken hover:text-ink focus:bg-surface-sunken focus:text-ink'
      )}
    >
      {children}
    </button>
  );
}

/**
 * A menu entry that navigates rather than acts.
 *
 * A real anchor, so opening in a new tab and copying the link both work — a
 * button that calls `router.push` looks identical and silently loses both.
 */
export function DropdownMenuLink({
  href,
  external,
  children,
}: {
  href: string;
  external?: boolean;
  children: React.ReactNode;
}) {
  const { close } = React.useContext(MenuContext);

  return (
    <a
      href={href}
      role="menuitem"
      target={external ? '_blank' : undefined}
      rel={external ? 'noreferrer' : undefined}
      onClick={close}
      className="flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left text-xs font-medium text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink focus:bg-surface-sunken focus:text-ink focus:outline-none"
    >
      {children}
    </a>
  );
}

export function DropdownMenuSeparator() {
  return <div role="separator" className="my-1 h-px bg-line" />;
}
