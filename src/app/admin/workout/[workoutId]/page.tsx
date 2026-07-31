import Link from 'next/link';
import { notFound } from 'next/navigation';

import {
  addExercise,
  addExerciseFromLibrary,
  moveExercise,
  removeWorkout,
  saveWorkout,
} from '@/app/admin/actions';
import { MediaThumb } from '@/components/MediaFrame';
import { db } from '@/lib/db';
import { setsLabel } from '@/lib/media';
import { EXERCISE_CATEGORIES } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function AdminWorkout({
  params,
}: {
  params: Promise<{ workoutId: string }>;
}) {
  const { workoutId } = await params;

  const workout = await db.getWorkout(workoutId);
  if (!workout) notFound();

  const [exercises, library] = await Promise.all([
    db.listExercises(workout.id),
    db.listLibrary(),
  ]);

  return (
    <>
      <Link
        href={`/admin/week/${workout.week_id}`}
        className="text-sm font-semibold text-muted hover:text-ink"
      >
        &larr; Back to week
      </Link>

      <form action={saveWorkout} className="card mt-3 p-5">
        <input type="hidden" name="workoutId" value={workout.id} />

        <label htmlFor="title" className="label">
          Workout name
        </label>
        <input id="title" name="title" defaultValue={workout.title} className="field" />

        <label htmlFor="subtitle" className="label mt-4">
          Short description (optional)
        </label>
        <input
          id="subtitle"
          name="subtitle"
          defaultValue={workout.subtitle}
          placeholder="e.g. Gentle strength for hips and knees"
          className="field"
        />

        <button type="submit" className="btn-primary mt-5 w-full text-base sm:w-auto">
          Save workout
        </button>
      </form>

      <section className="mt-8">
        <h2 className="text-xl font-extrabold tracking-tight">Exercises</h2>

        <ul className="mt-4 flex flex-col gap-2">
          {exercises.map((exercise, i) => (
            <li key={exercise.id} className="card flex items-center gap-2 p-3">
              <div className="flex flex-col">
                <MoveButton exerciseId={exercise.id} direction="up" disabled={i === 0} />
                <MoveButton
                  exerciseId={exercise.id}
                  direction="down"
                  disabled={i === exercises.length - 1}
                />
              </div>

              <MediaThumb
                mediaType={exercise.media_type}
                url={exercise.media_url}
                name={exercise.name}
              />

              <Link href={`/admin/exercise/${exercise.id}`} className="min-w-0 flex-1">
                <p className="truncate font-bold">{exercise.name}</p>
                <p className="text-sm text-muted">
                  {setsLabel(exercise)}
                  {exercise.media_type === 'none' && (
                    <span className="ml-2 text-brand">no video yet</span>
                  )}
                </p>
              </Link>

              <Link
                href={`/admin/exercise/${exercise.id}`}
                className="shrink-0 px-2 text-sm font-semibold text-brand"
              >
                Edit
              </Link>
            </li>
          ))}
          {exercises.length === 0 && (
            <li className="card p-4 text-muted">No exercises yet.</li>
          )}
        </ul>

        {library.length > 0 && (
          <form action={addExerciseFromLibrary} className="card mt-4 flex items-end gap-3 p-4">
            <input type="hidden" name="workoutId" value={workout.id} />
            <div className="min-w-0 flex-1">
              <label htmlFor="libraryId" className="label">
                Add from your library
              </label>
              <select id="libraryId" name="libraryId" className="field" defaultValue="">
                <option value="" disabled>
                  Pick an exercise…
                </option>
                {EXERCISE_CATEGORIES.map((category) => {
                  const items = library.filter((e) => e.category === category);
                  if (items.length === 0) return null;
                  return (
                    <optgroup key={category} label={category}>
                      {items.map((exercise) => (
                        <option key={exercise.id} value={exercise.id}>
                          {exercise.name}
                          {exercise.media_type === 'none' ? '' : ' 🎬'}
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>
            </div>
            <button type="submit" className="btn-primary shrink-0 text-base">
              Add
            </button>
          </form>
        )}

        <form action={addExercise} className="card mt-3 flex items-end gap-3 p-4">
          <input type="hidden" name="workoutId" value={workout.id} />
          <div className="flex-1">
            <label htmlFor="exercise-name" className="label">
              {library.length > 0 ? 'Or add a one-off' : 'Add an exercise'}
            </label>
            <input
              id="exercise-name"
              name="name"
              placeholder="e.g. Sit to stand"
              className="field"
            />
          </div>
          <button type="submit" className="btn-secondary shrink-0 text-base">
            Add
          </button>
        </form>

        {library.length === 0 && (
          <p className="mt-3 text-sm text-muted">
            Tip: build up your{' '}
            <Link href="/admin/library" className="font-semibold text-brand">
              exercise library
            </Link>{' '}
            and you can pick from it here instead of retyping.
          </p>
        )}
      </section>

      <form action={removeWorkout} className="mt-10 border-t border-line pt-6">
        <input type="hidden" name="workoutId" value={workout.id} />
        <button type="submit" className="btn-ghost text-base hover:text-brand">
          Delete workout
        </button>
      </form>
    </>
  );
}

function MoveButton({
  exerciseId,
  direction,
  disabled,
}: {
  exerciseId: string;
  direction: 'up' | 'down';
  disabled: boolean;
}) {
  return (
    <form action={moveExercise}>
      <input type="hidden" name="exerciseId" value={exerciseId} />
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
