import Link from 'next/link';
import { redirect } from 'next/navigation';

import { chooseProfile } from '@/app/actions';
import { getActiveProfileId } from '@/lib/auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function ProfilePicker() {
  const active = await getActiveProfileId();
  if (active && (await db.getProfile(active))) redirect('/home');

  const profiles = await db.listProfiles();

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight">StrongClub</h1>
        <p className="mt-3 text-lg text-muted">Who&rsquo;s working out today?</p>
      </div>

      {profiles.length === 0 ? (
        <div className="card p-6 text-center">
          <p className="text-lg font-semibold">No one set up yet</p>
          <p className="mt-2 text-muted">
            Head to the admin area to add the people who&rsquo;ll be using this.
          </p>
          <Link href="/admin" className="btn-primary mt-6 w-full">
            Open admin
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {profiles.map((profile) => (
            <form key={profile.id} action={chooseProfile}>
              <input type="hidden" name="profileId" value={profile.id} />
              <button
                type="submit"
                className="card flex w-full items-center gap-4 p-4 text-left transition hover:border-ink/25 active:scale-[0.99]"
              >
                <span
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-xl font-bold text-white"
                  style={{ backgroundColor: profile.color }}
                >
                  {profile.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="text-xl font-semibold">{profile.name}</span>
                <span className="ml-auto text-2xl text-muted/50" aria-hidden>
                  &rsaquo;
                </span>
              </button>
            </form>
          ))}
        </div>
      )}

      {/* Your own way in. Fine for your parents to see — it asks for the
          passcode, and they have no reason to tap it. */}
      <Link
        href="/admin"
        className="mt-8 flex items-center gap-4 rounded-xl2 border-2 border-dashed border-line p-4 text-left transition hover:border-brand/50"
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-tint text-xl">
          🏋️
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold">Coach</span>
          <span className="block text-sm text-muted">Build workouts &middot; passcode needed</span>
        </span>
        <span className="text-2xl text-muted/50" aria-hidden>
          &rsaquo;
        </span>
      </Link>
    </main>
  );
}
