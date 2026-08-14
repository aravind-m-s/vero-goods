import { z } from 'zod';

/** 10 digits, optionally with +91 / 91 / leading 0 — what Indian customers type. */
export const PhoneSchema = z
  .string()
  .trim()
  .regex(/^(\+?91[-\s]?|0)?[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number');

export const EmailSchema = z.email('Enter a valid email address');

export const FullNameSchema = z
  .string()
  .trim()
  .min(2, 'Enter your full name')
  .max(80, 'Name is too long');

export const OtpChannelSchema = z.enum(['email', 'phone']);
export const OtpCodeSchema = z.string().regex(/^\d{6}$/, 'Verification code must be 6 digits');

/**
 * Works out whether a single "Email or mobile number" box holds an address or a
 * number, so the customer never has to tell us which one they typed.
 *
 * An `@` means email — nothing else does. Otherwise it must look like an Indian
 * mobile number once punctuation is stripped. Anything else is neither, and the
 * caller reports one clear error instead of guessing wrong.
 */
export function identifyChannel(value: string): 'email' | 'phone' | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.includes('@')) {
    return z.email().safeParse(trimmed).success ? 'email' : null;
  }
  return PhoneSchema.safeParse(trimmed).success ? 'phone' : null;
}

const IdentifierSchema = z
  .string()
  .trim()
  .min(1, 'Enter your email address or mobile number')
  .max(120)
  .refine((value) => identifyChannel(value) !== null, {
    message: 'Enter a valid email address or 10-digit mobile number',
  });

/** One box, one value. The server derives the channel — the client never sends it. */
export const OtpRequestSchema = z.object({
  identifier: IdentifierSchema,
  /** Collected on the sign-up form; ignored for accounts that already exist. */
  name: FullNameSchema.optional(),
  /**
   * What the customer thinks they are doing. It changes the copy and whether a
   * name was collected — never whether the code is sent, because refusing to
   * send would tell an anonymous caller which identifiers have accounts.
   */
  intent: z.enum(['login', 'signup']).default('login'),
});

export const OtpVerifySchema = z.object({
  identifier: IdentifierSchema,
  name: FullNameSchema.optional(),
  code: OtpCodeSchema,
});

/** Profile edits keep an explicit channel: the row being edited decides it. */
export const ProfileIdentifierSchema = z.object({
  channel: OtpChannelSchema,
  value: z.string().trim().min(1, 'Enter the new email address or mobile number').max(120),
});

export const GoogleSignInSchema = z.object({
  credential: z.string().min(20, 'Google sign-in failed'),
});

export const AdminLoginSchema = z.object({
  password: z.string().min(1, 'Password is required').max(200),
});

/**
 * Profile edit. Changing an email or phone requires a code for the *new*
 * value, so ownership is proven before the account moves.
 */
export const ProfileUpdateSchema = z
  .object({
    name: FullNameSchema.optional(),
    email: z.email('Enter a valid email address').optional(),
    phone: PhoneSchema.optional(),
    code: OtpCodeSchema.optional(),
  })
  .refine((data) => data.name !== undefined || data.email !== undefined || data.phone !== undefined, {
    message: 'Nothing to update',
  })
  .refine((data) => (data.email === undefined && data.phone === undefined) || Boolean(data.code), {
    message: 'Enter the verification code sent to the new email or mobile number',
    path: ['code'],
  })
  .refine((data) => !(data.email !== undefined && data.phone !== undefined), {
    message: 'Change the email address and the mobile number one at a time',
    path: ['phone'],
  });

export const AddressSchema = z.object({
  label: z.string().trim().min(1, 'Give this address a label').max(40),
  fullName: FullNameSchema,
  phone: PhoneSchema,
  line1: z.string().trim().min(4, 'Enter the house / flat and street').max(120),
  line2: z.string().trim().max(120).optional().or(z.literal('')),
  city: z.string().trim().min(2, 'Enter the city').max(60),
  state: z.string().trim().min(2, 'Enter the state').max(60),
  pinCode: z.string().trim().regex(/^\d{6}$/, 'PIN code must be 6 digits'),
  country: z.string().trim().max(60).default('India'),
  isDefault: z.boolean().default(false),
});

export const AddressUpdateSchema = AddressSchema.partial();

export type AddressValues = z.input<typeof AddressSchema>;
