'use client';

import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Accessible name when the dialog has no visible DialogTitle. */
  label?: string;
}

export function Dialog({ open, onClose, children, label }: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  /**
   * Callers pass an inline `onClose`, so it is a new function on every render.
   * Held in a ref, the effect below can depend on `open` alone — with `onClose`
   * in the dependency array it tore down and re-ran on every keystroke, moving
   * focus back to the top of the dialog mid-word and dismissing the keyboard on
   * phones.
   */
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';

    // Escape to close, and Tab cycles inside the panel — a modal that lets
    // focus wander behind it is unusable with a keyboard or screen reader.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;

      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);

    // Focus the first real field, not the panel. On a phone, focusing the panel
    // means the on-screen keyboard opens only after a second tap, and the tap
    // that opens it scrolls the field somewhere the keyboard is already
    // covering. Falling back to the panel keeps dialogs without inputs sane.
    const firstField = panelRef.current?.querySelector<HTMLElement>(
      'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled])'
    );
    if (firstField) {
      firstField.focus({ preventScroll: true });
      firstField.scrollIntoView({ block: 'center' });
    } else {
      panelRef.current?.focus();
    }

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
      previouslyFocused?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    // Bottom sheet on phones, centred panel from `sm` up. Anchoring to the
    // bottom means the on-screen keyboard pushes the sheet up instead of
    // covering the field being typed into; `dvh` tracks the shrinking viewport.
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div
        className="animate-fade-in fixed inset-0 bg-black/50 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className="animate-scale-in relative z-10 flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-panel rounded-b-none border border-line bg-surface-raised pb-[env(safe-area-inset-bottom)] shadow-overlay focus:outline-none sm:max-h-[90dvh] sm:rounded-panel sm:pb-0"
      >
        {children}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute right-4 top-4 cursor-pointer rounded-full p-1 text-ink-subtle transition-colors hover:bg-surface-sunken hover:text-ink"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1.5 p-5 pr-12', className)} {...props} />;
}

export function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn('text-base font-semibold tracking-tight text-ink', className)} {...props} />;
}

export function DialogDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-xs leading-relaxed text-ink-muted', className)} {...props} />;
}

export function DialogContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('overflow-y-auto px-5 pb-1', className)} {...props} />;
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-col-reverse gap-2 p-5 sm:flex-row sm:justify-end', className)}
      {...props}
    />
  );
}
