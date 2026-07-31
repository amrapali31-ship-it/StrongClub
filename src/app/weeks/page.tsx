import Link from 'next/link';
import { redirect } from 'next/navigation';

import { AppHeader } from '@/components/AppHeader';
import { formatWeek } from '@/components/WeekBoard';
import { getActiveProfileId } from '@/lib/auth';
import { db } from '@/lib/db';
import { getWeekBoard } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default async function Weeks() {
  const profileId = await getActiveProfileId();
  const profile = profileId ? await db.getProfile(profileId) : null;
  if (!profile) redirect('/');

  const weeks = await db.listWeeks({ publishedOnly: true });
  const summaries = await Promise.all(
    weeks.map(async (week) => {
      const board = await getWeekBoard(week.id, profile.id);
      return {
        week,
        total: board.length,
        done: board.filter((b) => b.status === 'done').length,
      };
    }),
  );

  return (
    <>
      <AppHeader profile={profile} />

      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-6">
        <Link href="/home" className="text-base font-semibold text-muted hover:text-ink">
          &larr; This week
        </Link>
        <h1 className="mt-3 mb-6 text-3xl font-extrabold tracking-tight">All weeks</h1>

        <ul className="flex flex-col gap-3">
          {summaries.map(({ week, total, done }) => {
            const dateLabel = formatWeek(week);
            return (
              <li key={week.id}>
                <Link
                  href={`/week/${week.id}`}
                  className="card flex items-center gap-4 p-4 transition hover:border-ink/25 active:scale-[0.99]"
                >
                  <div className="min-w-0 flex-1">
                    {dateLabel && (
                      <p className="text-xs font-semibold tracking-wide text-brand uppercase">
                        Week of {dateLabel}
                      </p>
                    )}
                    <h2 className="truncate text-lg font-bold">{week.title}</h2>
                    <p className="mt-0.5 text-sm text-muted">
                      {done} of {total} finished
                    </p>
                  </div>
                  <span className="text-2xl text-muted/50" aria-hidden>
                    &rsaquo;
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </main>
    </>
  );
}
