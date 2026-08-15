'use client';

import { useCallback } from 'react';
import type React from 'react';
import { useRouter } from 'next/navigation';

/**
 * Anything that already does something when clicked. A row is only a shortcut
 * to the page its own action buttons lead to, so it must never swallow them —
 * `closest` catches portalled controls too, since a menu item is still a
 * `<button>` wherever React renders it.
 */
const INTERACTIVE = 'a,button,input,select,textarea,label,[role="menuitem"],[role="button"]';

/**
 * Makes a whole table row a shortcut to its detail page.
 *
 * The keyboard path stays the explicit link inside the row rather than the row
 * itself: a `<tr>` in the tab order would put every cell's content behind one
 * more stop for screen-reader users, for an action they already have.
 */
export function useRowNavigation(): (href: string) => {
  onClick: (event: React.MouseEvent<HTMLElement>) => void;
} {
  const router = useRouter();

  return useCallback(
    (href: string) => ({
      onClick: (event: React.MouseEvent<HTMLElement>) => {
        if ((event.target as HTMLElement).closest(INTERACTIVE)) return;
        // Dragging across a cell to copy an order number is not a click.
        if (window.getSelection()?.toString()) return;
        // Ctrl/⌘-click and middle-click mean "new tab" everywhere else.
        if (event.metaKey || event.ctrlKey) {
          window.open(href, '_blank', 'noopener');
          return;
        }
        router.push(href);
      },
    }),
    [router]
  );
}
