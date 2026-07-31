import Link from 'next/link';

import { formatWeek } from '@/components/WeekBoard';
import { db } from '@/lib/db';
import { getWeekBoard } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default async function AdminProgress() {
  const [weeks, profiles] = await Promise.all([
    db.listWeeks({ publishedOnly: true }),
    db.listProfiles(),
  ]);

  // Recent weeks only — older history isn't what you check on a Sunday night.
  const recent = weeks.slice(0, 6);

  const rows = await Promise.all(
    recent.map(async (week) => ({
      week,
      perProfile: await Promise.all(
        profiles.map(async (profile) => {
          const board = await getWeekBoard(week.id, profile.id);
          return {
            profile,
            total: board.length,
            done: board.filter((b) => b.status === 'done').length,
            started: board.filter((b) => b.status === 'in-progress').length,
          };
        }),
      ),
    })),
  );

  return (
    <>
      <h1 className="text-2xl font-extrabold tracking-tight">Progress</h1>
      <p className="mt-1 text-muted">How each week has gone, per person.</p>

      {profiles.length === 0 && (
        <p className="card mt-6 p-4 text-muted">
          Add people on the <Link href="/admin" className="font-semibold text-brand">main admin page</Link> first.
        </p>
      )}

      <div className="mt-6 flex flex-col gap-4">
        {rows.map(({ week, perProfile }) => {
          const dateLabel = formatWeek(week);
          return (
            <section key={week.id} className="card p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <h2 className="font-bold">{week.title}</h2>
                {dateLabel && <span className="text-sm text-muted">Week of {dateLabel}</span>}
              </div>

              <ul className="mt-4 flex flex-col gap-4">
                {perProfile.map(({ profile, total, done, started }) => (
                  <li key={profile.id}>
                    <div className="flex items-center gap-3">
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                        style={{ backgroundColor: profile.color }}
                      >
                        {profile.name.slice(0, 1).toUpperCase()}
                      </span>

                      <span className="flex-1 truncate font-semibold">{profile.name}</span>

                      <span className="shrink-0 text-sm text-muted tabular-nums">
                        {done}/{total} done
                        {started > 0 && <span className="text-brand"> · {started} started</span>}
                      </span>
                    </div>

                    {/* Full-width bar on its own line so it stays readable on a phone. */}
                    <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-line">
                      <div
                        className="h-full rounded-full bg-success transition-[width]"
                        style={{ width: total ? `${(done / total) * 100}%` : '0%' }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}

        {recent.length === 0 && (
          <p className="card p-4 text-muted">
            Nothing published yet, so there&rsquo;s nothing to track.
          </p>
        )}
      </div>
    </>
  );
}
