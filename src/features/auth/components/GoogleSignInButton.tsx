'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Google Identity Services button.
 *
 * Renders nothing unless `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is set — a dead button
 * that errors on click is worse than no button. The credential it produces is
 * verified server-side in `/api/auth/google`; nothing here is trusted.
 */
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
            ux_mode?: 'popup' | 'redirect';
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: Record<string, string | number | undefined>
          ) => void;
        };
      };
    };
  }
}

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

export function GoogleSignInButton({
  onSignedIn,
  onError,
}: {
  onSignedIn: () => void;
  onError: (message: string) => void;
}) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);

  const handleCredential = useCallback(
    async (credential: string) => {
      try {
        const response = await fetch('/api/auth/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ credential }),
        });
        const data = (await response.json()) as { error?: string };
        if (!response.ok) {
          onError(data.error ?? 'Google sign-in failed');
          return;
        }
        onSignedIn();
      } catch {
        onError('Could not reach the server');
      }
    },
    [onSignedIn, onError]
  );

  useEffect(() => {
    if (!clientId) return;

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    if (existing) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsReady(true);
      return;
    }

    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => setIsReady(true);
    script.onerror = () => onError('Could not load Google sign-in');
    document.head.appendChild(script);
  }, [clientId, onError]);

  useEffect(() => {
    if (!clientId || !isReady || !containerRef.current || !window.google) return;

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: (response) => {
        if (response.credential) void handleCredential(response.credential);
      },
    });
    window.google.accounts.id.renderButton(containerRef.current, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      shape: 'rectangular',
      width: 320,
    });
  }, [clientId, isReady, handleCredential]);

  if (!clientId) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-line" />
        <span className="text-2xs uppercase tracking-wider text-ink-subtle">or</span>
        <span className="h-px flex-1 bg-line" />
      </div>
      <div ref={containerRef} className="flex justify-center [color-scheme:light]" />
    </div>
  );
}
