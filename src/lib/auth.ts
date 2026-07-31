import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

const ADMIN_COOKIE = 'sc_admin';
const PROFILE_COOKIE = 'sc_profile';
const YEAR = 60 * 60 * 24 * 365;

/** Dev-only fallback so the app runs before any env file exists. */
const DEFAULT_PASSCODE = 'letmein';

/**
 * Null means "no passcode will ever be accepted". This fallback is published —
 * it sits in .env.example and in this file, both of which go to GitHub — so in
 * production an unset ADMIN_PASSCODE locks the admin area rather than quietly
 * leaving it open to anyone who has read the repo.
 */
function passcode(): string | null {
  const configured = process.env.ADMIN_PASSCODE?.trim();
  if (configured) return configured;
  return process.env.NODE_ENV === 'production' ? null : DEFAULT_PASSCODE;
}

/** True when a real passcode is set, or we're in dev and the fallback applies. */
export function adminPasscodeIsSet(): boolean {
  return passcode() !== null;
}

/**
 * The admin cookie holds an HMAC of the passcode rather than the passcode
 * itself, so a leaked cookie doesn't reveal what to type on another device.
 */
function token(secret: string): string {
  return createHmac('sha256', secret).update('strongclub-admin').digest('hex');
}

export function checkPasscode(attempt: string): boolean {
  const secret = passcode();
  if (secret === null) return false;

  const a = Buffer.from(attempt);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function isAdmin(): Promise<boolean> {
  const secret = passcode();
  if (secret === null) return false;

  const value = (await cookies()).get(ADMIN_COOKIE)?.value;
  return value === token(secret);
}

export async function signInAdmin(): Promise<void> {
  const secret = passcode();
  if (secret === null) return;

  (await cookies()).set(ADMIN_COOKIE, token(secret), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: YEAR,
  });
}

export async function signOutAdmin(): Promise<void> {
  (await cookies()).delete(ADMIN_COOKIE);
}

/** Which parent is using the app on this device. Not a security boundary. */
export async function getActiveProfileId(): Promise<string | null> {
  return (await cookies()).get(PROFILE_COOKIE)?.value ?? null;
}

export async function setActiveProfileId(id: string): Promise<void> {
  (await cookies()).set(PROFILE_COOKIE, id, {
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: YEAR,
  });
}

export async function clearActiveProfile(): Promise<void> {
  (await cookies()).delete(PROFILE_COOKIE);
}
