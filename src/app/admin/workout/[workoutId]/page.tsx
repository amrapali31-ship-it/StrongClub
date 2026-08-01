import Link from 'next/link';
import { notFound } from 'next/navigation';

import {
  addExercise,
  addExerciseFromLibrary,
  removeExercise,
  removeWorkout,
  renameSection,
  reorderExercises,
  saveWorkout,
} from '@/app/admin/actions';
import { EmojiField } from '@/components/admin/EmojiField';
import { ExerciseReorder } from '@/components/admin/ExerciseReorder';
import { db } from '@/lib/db';
import { groupExercises, shouldShowGroupHeadings } from '@/lib/queries';
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

  const groups = groupExercises(exercises);
  const showHeadings = shouldShowGroupHeadings(groups);

  // Offer whatever's already in use anywhere, plus the built-in suggestions.
  const sectionSuggestions = [
    ...new Set([
      ...EXERCISE_CATEGORIES,
      ...library.map((e) => e.category),
      ...exercises.map((e) => e.category),
    ]),
  ]
    .filter(Boolean)
    .sort();

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

        <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
          <div>
            <label htmlFor="emoji" className="label">
              Icon
            </label>
            <EmojiField defaultValue={workout.emoji} />
          </div>
          <div>
            <label htmlFor="title" className="label">
              Workout name
            </label>
            <input id="title" name="title" defaultValue={workout.title} className="field" />
          </div>
        </div>

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

        {exercises.length > 0 ? (
          <>
            <ExerciseReorder
              workoutId={workout.id}
              exercises={exercises}
              groups={groups}
              showHeadings={showHeadings}
              suggestions={sectionSuggestions}
              reorder={reorderExercises}
              remove={removeExercise}
              rename={renameSection}
            />
            <p className="mt-3 text-sm text-muted">
              Drag the <span className="font-mono text-ink">⠿</span> handle to reorder.
              {showHeadings && ' Drop an exercise under a different heading to move it there.'}
            </p>
          </>
        ) : (
          <p className="card mt-4 p-4 text-muted">No exercises yet.</p>
        )}

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

