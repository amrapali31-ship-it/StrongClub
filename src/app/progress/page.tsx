import { redirect } from 'next/navigation';

import { ParentShell } from '@/components/ParentShell';
import { formatWeek } from '@/components/WeekBoard';
import { getActiveProfileId } from '@/lib/auth';
import { db } from '@/lib/db';
import { getWeekBoard, relativeWeekLabel } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default async function ParentProgress() {
  const profileId = await getActiveProfileId();
  const profile = profileId ? await db.getProfile(profileId) : null;
  if (!profile) redirect('/');

  const weeks = (await db.listWeeks({ publishedOnly: true })).slice(0, 8);
  const rows = await Promise.all(
    weeks.map(async (week) => {
      const board = await getWeekBoard(week.id, profile.id);
      return {
        week,
        total: board.length,
        done: board.filter((entry) => entry.status === 'done').length,
        started: board.filter((entry) => entry.status === 'in-progress').length,
      };
    }),
  );

  const withWorkouts = rows.filter((row) => row.total > 0);
  const finished = withWorkouts.reduce((sum, row) => sum + row.done, 0);

  return (
    <ParentShell profile={profile}>
      <h1 className="text-3xl font-extrabold tracking-tight">How it&rsquo;s going</h1>
      <p className="mt-1 text-base text-muted">
        Just so you can see what you&rsquo;ve done. Nobody&rsquo;s keeping score.
      </p>

      {withWorkouts.length === 0 ? (
        <p className="card mt-6 p-5 text-muted">
          Nothing finished yet. Tick exercises off as you go and they&rsquo;ll show up here.
        </p>
      ) : (
        <>
          <div className="card mt-6 flex items-center gap-5 p-5">
            <p className="text-5xl leading-none font-extrabold text-brand tabular-nums">
              {finished}
            </p>
            <p className="text-base text-muted">
              workout{finished === 1 ? '' : 's'} finished across{' '}
              {withWorkouts.length === 1 ? 'this week' : `${withWorkouts.length} weeks`}
            </p>
          </div>

          <ul className="mt-4 flex flex-col gap-3">
            {withWorkouts.map(({ week, total, done, started }) => {
              const label = relativeWeekLabel(week.start_date) || week.title;
              const date = formatWeek(week);

              return (
                <li key={week.id} className="card p-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <p className="font-bold">{label}</p>
                    <p className="text-sm text-muted">
                      {done} of {total} done
                      {started > 0 && `, ${started} started`}
                    </p>
                  </div>

                  {/* One pip per workout: at four a week, a bar would be
                      precision no one asked for. */}
                  <div className="mt-3 flex gap-1.5">
                    {Array.from({ length: total }, (_, i) => (
                      <span
                        key={i}
                        className={`h-2.5 flex-1 rounded-full ${
                          i < done ? 'bg-success' : 'bg-line'
                        }`}
                      />
                    ))}
                  </div>

                  {date && <p className="mt-3 text-sm text-muted">Week of {date}</p>}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </ParentShell>
  );
}
