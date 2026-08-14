import type { User } from '@/features/auth/types';

/**
 * The shape of a user that is safe to hand to the browser. Kept in one place so
 * a field added to `User` (an internal flag, a note) is not leaked to the
 * client by a handler that spreads the whole document.
 */
export interface PublicUser {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  googleLinked: boolean;
  avatarUrl?: string;
  createdAt: string;
}

export function publicUser(user: User): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    emailVerified: Boolean(user.emailVerified),
    phoneVerified: Boolean(user.phoneVerified),
    googleLinked: Boolean(user.googleId),
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
  };
}
