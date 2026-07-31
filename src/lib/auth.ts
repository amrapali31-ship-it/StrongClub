import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

const ADMIN_COOKIE = 'sc_admin';
const PROFILE_COOKIE = 'sc_profile';
const YEAR = 60 * 60 * 24 * 365;

/** Dev-only fallback so the app runs before any env file exists. */
const DEFAULT_PASSCODE = 'letmein';

function passcode(): string {
  return process.env.ADMIN_PASSCODE || DEFAULT_PASSCODE;
}

/**
 * The admin cookie holds an HMAC of the passcode rather than the passcode
 * itself, so a leaked cookie doesn't reveal what to type on another device.
 */
function token(): string {
  return createHmac('sha256', passcode()).update('strongclub-admin').digest('hex');
}

export function checkPasscode(attempt: string): boolean {
  const a = Buffer.from(attempt);
  const b = Buffer.from(passcode());
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function isAdmin(): Promise<boolean> {
  const value = (await cookies()).get(ADMIN_COOKIE)?.value;
  return value === token();
}

export async function signInAdmin(): Promise<void> {
  (await cookies()).set(ADMIN_COOKIE, token(), {
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
