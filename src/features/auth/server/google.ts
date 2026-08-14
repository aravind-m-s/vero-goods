import 'server-only';

/**
 * Google Sign-In (Google Identity Services) token verification.
 *
 * The browser hands us an ID token; the token is verified against Google's own
 * tokeninfo endpoint rather than trusting any claim the page sent along with
 * it. Anything the client says about who they are is ignored — only the
 * verified claims below are used to find or create the account.
 *
 * Requires `GOOGLE_CLIENT_ID` (the same client id the button renders with).
 * `isGoogleSignInEnabled()` gates the UI so the button never appears half-wired.
 */
export interface GoogleIdentity {
  googleId: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

export function googleClientId(): string | undefined {
  return process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || undefined;
}

export function isGoogleSignInEnabled(): boolean {
  return Boolean(googleClientId());
}

interface TokenInfo {
  aud?: string;
  sub?: string;
  email?: string;
  email_verified?: string | boolean;
  name?: string;
  picture?: string;
  exp?: string;
  iss?: string;
}

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdentity | null> {
  const clientId = googleClientId();
  if (!clientId || !idToken) return null;

  const response = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
    { cache: 'no-store' }
  );
  if (!response.ok) return null;

  const info = (await response.json()) as TokenInfo;

  // Audience: a token minted for a different app must not log anyone in here.
  if (info.aud !== clientId) return null;
  if (info.iss !== 'accounts.google.com' && info.iss !== 'https://accounts.google.com') return null;
  if (!info.sub || !info.email) return null;
  if (info.email_verified !== true && info.email_verified !== 'true') return null;

  const expiresAt = Number(info.exp);
  if (!Number.isFinite(expiresAt) || expiresAt * 1000 <= Date.now()) return null;

  return {
    googleId: info.sub,
    email: info.email.toLowerCase(),
    name: info.name?.trim() || info.email.split('@')[0],
    avatarUrl: info.picture,
  };
}
