import Link from 'next/link';

import { switchProfile } from '@/app/actions';
import { Avatar } from '@/components/Avatar';
import { BottomNav, type NavItem } from '@/components/BottomNav';
import type { Profile } from '@/lib/types';

const NAV: NavItem[] = [
  // A workout or another week is still "this week" as far as the bar goes.
  { href: '/home', label: 'This week', icon: 'calendar', also: ['/workout', '/week'] },
  { href: '/progress', label: 'Progress', icon: 'chart' },
  { href: '/', label: 'Switch', icon: 'person' },
];

/**
 * The frame every signed-in parent screen sits in: who you are at the top,
 * where you can go at the bottom, and the page in between.
 *
 * The profile picker deliberately doesn't use this — there's nobody to be yet.
 */
export function ParentShell({
  profile,
  children,
}: {
  profile: Profile;
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="sticky top-0 z-20 border-b border-line bg-canvas/85 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-3 px-5 py-3">
          <Link href="/home" className="text-lg font-extrabold tracking-tight">
            StrongClub
          </Link>

          <form action={switchProfile} className="ml-auto">
            <button
              type="submit"
              className="flex items-center gap-2 rounded-full border border-line bg-surface py-1.5 pr-3 pl-1.5 text-sm font-semibold transition hover:border-ink/25"
            >
              <Avatar profile={profile} size="sm" />
              {profile.name}
            </button>
          </form>
        </div>
      </header>

      {/* pb-28 clears the fixed bar; the bar itself is out of the flow. */}
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 pt-6 pb-28">{children}</main>

      <BottomNav items={NAV} />
    </>
  );
}
