// Auth domain types.

/** How a customer proved who they are. Both are OTP-verified, one at a time. */
export type OtpChannel = 'email' | 'phone';

export interface User {
  id: string;
  /** Optional: a phone-first customer may never give an email address. */
  email?: string;
  name: string;
  /** E.164-ish, digits only with country code, e.g. `919876543210`. */
  phone?: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  /** Google `sub` claim, set when the account is linked to Google Sign-In. */
  googleId?: string;
  avatarUrl?: string;
  role: 'admin' | 'customer';
  createdAt: string;
  updatedAt?: string;
}

/**
 * Why the code was issued. `login` mints a session for whoever proves the
 * identifier; `change` only proves ownership so an existing account can move
 * its email or phone — it must never sign anybody in.
 */
export type OtpPurpose = 'login' | 'change';

export interface OtpRecord {
  /** Lower-cased email or digits-only phone. */
  identifier: string;
  channel: OtpChannel;
  purpose: OtpPurpose;
  /** SHA-256 of the code. The plaintext code is never stored. */
  codeHash: string;
  /** Carried through verification so a first-time login gets a real name. */
  name?: string;
  /** Stored as a BSON Date so the TTL index can expire it automatically. */
  expiresAt: Date;
  attempts: number;
  createdAt: Date;
}

export interface Address {
  id: string;
  userId: string;
  /** What the customer calls it — "Home", "Office". */
  label: string;
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pinCode: string;
  country: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}
