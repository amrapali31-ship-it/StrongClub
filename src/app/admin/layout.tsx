import Link from 'next/link';

import { logout } from '@/app/admin/actions';
import { LoginForm } from '@/app/admin/LoginForm';
import { ErrorWatch } from '@/components/admin/ErrorWatch';
import { BottomNav, type NavItem } from '@/components/BottomNav';
import { adminPasscodeIsSet, isAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * `match` keeps a section lit while you're deep inside it — editing an
 * exercise is still "Weeks", even though the URL no longer says so.
 */
const NAV: NavItem[] = [
  { href: '/admin', label: 'Weeks', icon: 'calendar' },
  { href: '/admin/library', label: 'Library', icon: 'library' },
  { href: '/admin/import', label: 'Import', icon: 'sparkle' },
  { href: '/admin/progress', label: 'Progress', icon: 'chart' },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAdmin())) return <LoginForm passcodeIsSet={adminPasscodeIsSet()} />;

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-line bg-canvas/85 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-4 px-5 py-3">
          <Link href="/admin" className="shrink-0 text-lg font-extrabold tracking-tight">
            StrongClub <span className="text-muted">coach</span>
          </Link>

          <div className="ml-auto flex items-center gap-4 text-sm font-semibold">
            <Link href="/home" className="hidden text-muted transition hover:text-ink sm:inline">
              View as parent
            </Link>
            <form action={logout}>
              <button type="submit" className="text-muted transition hover:text-ink">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl flex-1 px-5 pt-6 pb-28">{children}</div>

      <BottomNav items={NAV} />
      <ErrorWatch />
    </>
  );
}
