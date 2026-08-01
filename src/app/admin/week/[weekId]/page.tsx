import Link from 'next/link';
import { notFound } from 'next/navigation';

import {
  addWorkout,
  duplicateWeek,
  duplicateWorkout,
  moveWorkout,
  removeWeek,
  saveWeek,
} from '@/app/admin/actions';
import { db } from '@/lib/db';
import { estimateMinutes } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default async function AdminWeek({ params }: { params: Promise<{ weekId: string }> }) {
  const { weekId } = await params;

  const week = await db.getWeek(weekId);
  if (!week) notFound();

  const workouts = await db.listWorkouts(week.id);
  const withCounts = await Promise.all(
    workouts.map(async (workout) => {
      const exercises = await db.listExercises(workout.id);
      return { workout, count: exercises.length, minutes: estimateMinutes(exercises) };
    }),
  );

  return (
    <>
      <Link href="/admin" className="text-sm font-semibold text-muted hover:text-ink">
        &larr; All weeks
      </Link>

      <form action={saveWeek} className="card mt-3 p-5">
        <input type="hidden" name="weekId" value={week.id} />

        <label htmlFor="title" className="label">
          Week name
        </label>
        <input id="title" name="title" defaultValue={week.title} className="field" />

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="start_date" className="label">
              Starts on
            </label>
            <input
              id="start_date"
              name="start_date"
              type="date"
              defaultValue={week.start_date ?? ''}
              className="field"
            />
          </div>
          <div className="flex items-end">
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-line bg-surface px-4 py-3">
              <input
                type="checkbox"
                name="published"
                defaultChecked={week.published}
                className="h-5 w-5 accent-brand"
              />
              <span className="font-semibold">Visible to your parents</span>
            </label>
          </div>
        </div>

        <label htmlFor="note" className="label mt-4">
          A note for them (optional)
        </label>
        <textarea
          id="note"
          name="note"
          rows={2}
          defaultValue={week.note}
          placeholder="e.g. Try to do three of these four. Rest whenever you need to."
          className="field"
        />

        <button type="submit" className="btn-primary mt-5 w-full text-base sm:w-auto">
          Save week
        </button>
      </form>

      <section className="mt-8">
        <h2 className="text-xl font-extrabold tracking-tight">Workouts</h2>
        <p className="mt-1 text-muted">
          They can do these in any order. Four is a good number for a week.
        </p>

        <ul className="mt-4 flex flex-col gap-2">
          {withCounts.map(({ workout, count, minutes }, i) => (
            <li key={workout.id} className="card flex items-center gap-2 p-3">
              <div className="flex flex-col">
                <MoveButton workoutId={workout.id} direction="up" disabled={i === 0} />
                <MoveButton
                  workoutId={workout.id}
                  direction="down"
                  disabled={i === withCounts.length - 1}
                />
              </div>

              <Link href={`/admin/workout/${workout.id}`} className="min-w-0 flex-1">
                <p className="truncate font-bold">
                  {workout.emoji && <span className="mr-1.5">{workout.emoji}</span>}
                  {workout.title}
                </p>
                <p className="text-sm text-muted">
                  {count} {count === 1 ? 'exercise' : 'exercises'} &middot; about {minutes} min
                </p>
              </Link>

              <form action={duplicateWorkout} className="shrink-0">
                <input type="hidden" name="workoutId" value={workout.id} />
                <button
                  type="submit"
                  className="px-2 text-sm font-semibold text-muted hover:text-ink"
                >
                  Copy
                </button>
              </form>

              <Link
                href={`/admin/workout/${workout.id}`}
                className="shrink-0 px-2 text-sm font-semibold text-brand"
              >
                Edit
              </Link>
            </li>
          ))}
          {workouts.length === 0 && (
            <li className="card p-4 text-muted">No workouts in this week yet.</li>
          )}
        </ul>

        <Link
          href={`/admin/import/workout/${week.id}`}
          className="card mt-4 flex items-center gap-3 p-4 transition hover:border-ink/25"
        >
          <span className="text-2xl" aria-hidden>
            ✨
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-bold">Add a workout with AI</span>
            <span className="block text-sm text-muted">
              Paste one session or a photo of it, and Claude fills in the exercises.
            </span>
          </span>
          <span className="shrink-0 text-sm font-semibold text-brand">Import</span>
        </Link>

        <form action={addWorkout} className="card mt-3 flex items-end gap-3 p-4">
          <input type="hidden" name="weekId" value={week.id} />
          <div className="flex-1">
            <label htmlFor="workout-title" className="label">
              Add a workout
            </label>
            <input
              id="workout-title"
              name="title"
              placeholder="e.g. Legs &amp; balance"
              className="field"
            />
          </div>
          <button type="submit" className="btn-primary shrink-0 text-base">
            Add
          </button>
        </form>
      </section>

      <section className="mt-10 flex flex-col gap-3 border-t border-line pt-6 sm:flex-row">
        <form action={duplicateWeek}>
          <input type="hidden" name="weekId" value={week.id} />
          <button type="submit" className="btn-secondary text-base">
            Duplicate this week
          </button>
        </form>

        <form action={removeWeek} className="sm:ml-auto">
          <input type="hidden" name="weekId" value={week.id} />
          <button type="submit" className="btn-ghost text-base hover:text-brand">
            Delete week
          </button>
        </form>
      </section>
    </>
  );
}

function MoveButton({
  workoutId,
  direction,
  disabled,
}: {
  workoutId: string;
  direction: 'up' | 'down';
  disabled: boolean;
}) {
  return (
    <form action={moveWorkout}>
      <input type="hidden" name="workoutId" value={workoutId} />
      <input type="hidden" name="direction" value={direction} />
      <button
        type="submit"
        disabled={disabled}
        aria-label={`Move ${direction}`}
        className="flex h-6 w-7 items-center justify-center rounded text-muted hover:bg-line disabled:opacity-25"
      >
        {direction === 'up' ? '▲' : '▼'}
      </button>
    </form>
  );
}
