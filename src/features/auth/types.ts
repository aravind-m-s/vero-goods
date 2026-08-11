// Auth domain types.

export interface User {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: 'admin' | 'customer';
  createdAt: string;
}

export interface OtpRecord {
  email: string;
  /** SHA-256 of the code. The plaintext code is never stored. */
  codeHash: string;
  /** Stored as a BSON Date so the TTL index can expire it automatically. */
  expiresAt: Date;
  attempts: number;
  createdAt: Date;
}
