import { z } from 'zod';

export const OtpRequestSchema = z.object({
  email: z.email('Enter a valid email address'),
});

export const OtpVerifySchema = z.object({
  email: z.email('Enter a valid email address'),
  code: z.string().regex(/^\d{6}$/, 'Verification code must be 6 digits'),
});

export const AdminLoginSchema = z.object({
  password: z.string().min(1, 'Password is required').max(200),
});
