#!/usr/bin/env node
/**
 * Generates the value for ADMIN_PASSWORD_HASH.
 *
 *   node scripts/hash-password.mjs "your admin password"
 *
 * Storing a scrypt hash means a leaked .env or config dump does not hand over
 * a usable admin password.
 */
import crypto from 'node:crypto';

const password = process.argv[2];

if (!password) {
  console.error('Usage: node scripts/hash-password.mjs "<password>"');
  process.exit(1);
}

if (password.length < 12) {
  console.error('Refusing to hash a password shorter than 12 characters.');
  process.exit(1);
}

const salt = crypto.randomBytes(16);
const derived = crypto.scryptSync(password, salt, 64);

console.log(`ADMIN_PASSWORD_HASH=scrypt$${salt.toString('hex')}$${derived.toString('hex')}`);
console.log(`SESSION_SECRET=${crypto.randomBytes(32).toString('hex')}`);
