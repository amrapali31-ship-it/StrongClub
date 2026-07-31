import Link from 'next/link';

import { addProfile, addWeek, removeProfile } from '@/app/admin/actions';
import { formatWeek } from '@/components/WeekBoard';
import { db, usingSupabase } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function AdminHome() {
  const [weeks, profiles] = await Promise.all([db.listWeeks(), db.listProfiles()]);

  const weekSummaries = await Promise.all(
    weeks.map(async (week) => ({
      week,
      workouts: (await db.listWorkouts(week.id)).length,
    })),
  );

  return (
    <>
      <section>
        <div className="flex items-end justify-between gap-4">
          <h1 className="text-2xl font-extrabold tracking-tight">Weeks</h1>
        </div>

        <ul className="mt-4 flex flex-col gap-2">
          {weekSummaries.map(({ week, workouts }) => {
            const dateLabel = formatWeek(week);
            return (
              <li key={week.id}>
                <Link
                  href={`/admin/week/${week.id}`}
                  className="card flex items-center gap-3 p-4 transition hover:border-ink/25"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate font-bold">{week.title}</h2>
                      {week.published ? (
                        <span className="rounded-full bg-success-tint px-2 py-0.5 text-xs font-bold text-success">
                          Live
                        </span>
                      ) : (
                        <span className="rounded-full bg-line px-2 py-0.5 text-xs font-bold text-muted">
                          Draft
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-muted">
                      {dateLabel && <>Week of {dateLabel} &middot; </>}
                      {workouts} {workouts === 1 ? 'workout' : 'workouts'}
                    </p>
                  </div>
                  <span className="text-xl text-muted/50" aria-hidden>
                    &rsaquo;
                  </span>
                </Link>
              </li>
            );
          })}
          {weeks.length === 0 && (
            <li className="card p-4 text-muted">No weeks yet. Create your first one below.</li>
          )}
        </ul>

        <form action={addWeek} className="card mt-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor="title" className="label">
              New week name
            </label>
            <input
              id="title"
              name="title"
              placeholder="e.g. Week 1 — Getting started"
              className="field"
            />
          </div>
          <div>
            <label htmlFor="start_date" className="label">
              Starts
            </label>
            <input id="start_date" name="start_date" type="date" className="field" />
          </div>
          <button type="submit" className="btn-primary shrink-0 text-base">
            Add week
          </button>
        </form>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-extrabold tracking-tight">People</h2>
        <p className="mt-1 text-muted">
          Everyone who picks a name on the home screen. Their progress is tracked separately.
        </p>

        <ul className="mt-4 flex flex-col gap-2">
          {profiles.map((profile) => (
            <li key={profile.id} className="card flex items-center gap-3 p-3">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold text-white"
                style={{ backgroundColor: profile.color }}
              >
                {profile.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="flex-1 font-semibold">{profile.name}</span>
              <form action={removeProfile}>
                <input type="hidden" name="profileId" value={profile.id} />
                <button type="submit" className="px-2 text-sm font-semibold text-muted hover:text-brand">
                  Remove
                </button>
              </form>
            </li>
          ))}
        </ul>

        <form action={addProfile} className="card mt-4 flex items-end gap-3 p-4">
          <div className="flex-1">
            <label htmlFor="name" className="label">
              Add a person
            </label>
            <input id="name" name="name" placeholder="e.g. Mum" className="field" />
          </div>
          <button type="submit" className="btn-secondary shrink-0 text-base">
            Add
          </button>
        </form>
      </section>

      <p className="mt-10 text-center text-sm text-muted">
        Storing data in {usingSupabase ? 'Supabase' : 'a local file (.data/db.json)'}.
      </p>
    </>
  );
}
