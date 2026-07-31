import Link from 'next/link';

import { logout } from '@/app/admin/actions';
import { LoginForm } from '@/app/admin/LoginForm';
import { adminPasscodeIsSet, isAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAdmin())) return <LoginForm passcodeIsSet={adminPasscodeIsSet()} />;

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-line bg-cream/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-4 px-5 py-3">
          <Link href="/admin" className="shrink-0 text-lg font-extrabold tracking-tight">
            StrongClub <span className="hidden text-muted sm:inline">coach</span>
          </Link>

          <nav className="ml-auto flex items-center gap-4 text-sm font-semibold">
            <Link href="/admin/library" className="text-muted hover:text-ink">
              Library
            </Link>
            <Link href="/admin/progress" className="text-muted hover:text-ink">
              Progress
            </Link>
            <Link href="/home" className="hidden text-muted hover:text-ink sm:inline">
              View as parent
            </Link>
            <form action={logout}>
              <button type="submit" className="text-muted hover:text-ink">
                Sign out
              </button>
            </form>
          </nav>
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl flex-1 px-5 py-6">{children}</div>
    </>
  );
}
