import Link from 'next/link';

import { switchProfile } from '@/app/actions';
import type { Profile } from '@/lib/types';

export function AppHeader({ profile }: { profile: Profile }) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-canvas/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-2xl items-center gap-3 px-5 py-3">
        <Link href="/home" className="text-lg font-extrabold tracking-tight">
          StrongClub
        </Link>

        <form action={switchProfile} className="ml-auto">
          <button
            type="submit"
            className="flex items-center gap-2 rounded-full border border-line bg-surface py-1.5 pr-3 pl-1.5 text-sm font-semibold transition hover:border-ink/25"
          >
            <span
              className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white"
              style={{ backgroundColor: profile.color }}
            >
              {profile.name.slice(0, 1).toUpperCase()}
            </span>
            {profile.name}
          </button>
        </form>
      </div>
    </header>
  );
}
