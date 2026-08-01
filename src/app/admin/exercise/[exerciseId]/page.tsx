import { notFound } from 'next/navigation';

import { BackLink } from '@/components/BackLink';
import { removeExercise, saveExercise, saveExerciseToLibrary } from '@/app/admin/actions';
import { MediaPicker } from '@/components/admin/MediaPicker';
import { ModeFields } from '@/components/admin/ModeFields';
import { db } from '@/lib/db';
import { EQUIPMENT_OPTIONS, EXERCISE_CATEGORIES } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function AdminExercise({
  params,
}: {
  params: Promise<{ exerciseId: string }>;
}) {
  const { exerciseId } = await params;

  const exercise = await db.getExercise(exerciseId);
  if (!exercise) notFound();

  const library = await db.listLibrary();
  const sectionSuggestions = [
    ...new Set([...EXERCISE_CATEGORIES, ...library.map((e) => e.category)]),
  ]
    .filter(Boolean)
    .sort();

  // Whatever's already in use, so the second dumbbell exercise offers the same
  // wording as the first rather than inviting a near-miss.
  const equipmentSuggestions = [
    ...new Set([...EQUIPMENT_OPTIONS, ...library.map((e) => e.equipment ?? '')]),
  ]
    .filter(Boolean)
    .sort();

  return (
    <>
      <BackLink href={`/admin/workout/${exercise.workout_id}`} label="Back to workout" />

      <form action={saveExercise} className="card mt-3 p-5">
        <input type="hidden" name="exerciseId" value={exercise.id} />

        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <div>
            <label htmlFor="name" className="label">
              Exercise name
            </label>
            <input id="name" name="name" defaultValue={exercise.name} className="field" />
          </div>
          <div>
            <label htmlFor="category" className="label">
              Section
            </label>
            {/* Free text with suggestions, so any section name works. */}
            <input
              id="category"
              name="category"
              defaultValue={exercise.category ?? ''}
              list="section-suggestions"
              placeholder="e.g. Strength"
              className="field"
            />
            <datalist id="section-suggestions">
              {sectionSuggestions.map((category) => (
                <option key={category} value={category} />
              ))}
            </datalist>
          </div>
        </div>

        <p className="mt-2 text-sm text-muted">
          Exercises sharing a section are grouped together under a heading when your parents open
          the workout. Type anything &mdash; leave it blank for no section.
        </p>


        <div className="mt-4">
          <label htmlFor="equipment" className="label">
            Equipment
          </label>
          {/* Free text with suggestions, same as the section — a machine at
              their gym that isn't on the list is still fine to type. */}
          <input
            id="equipment"
            name="equipment"
            defaultValue={exercise.equipment ?? ''}
            list="equipment-suggestions"
            placeholder="e.g. Dumbbells"
            className="field"
          />
          <datalist id="equipment-suggestions">
            {equipmentSuggestions.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
          <p className="mt-2 text-sm text-muted">
            Shown on the exercise, and gathered into a &ldquo;you&rsquo;ll need&rdquo; list at the
            top of the workout. Leave it blank if there&rsquo;s nothing to fetch.
          </p>
        </div>

        <div className="mt-5">
          <ModeFields exercise={exercise} />
        </div>

        <label htmlFor="instructions" className="label mt-5">
          How to do it, in your words
        </label>
        <textarea
          id="instructions"
          name="instructions"
          rows={4}
          defaultValue={exercise.instructions}
          placeholder="e.g. Sit tall at the front of the chair, feet flat. Stand up without using your hands, then sit down slowly. Stop if your knees hurt."
          className="field"
        />

        <div className="mt-5">
          <MediaPicker
            name={exercise.name}
            defaultUrl={exercise.media_url}
            defaultType={exercise.media_type}
          />
        </div>

        <button type="submit" className="btn-primary mt-6 w-full">
          Save exercise
        </button>
      </form>

      <form action={saveExerciseToLibrary} className="card mt-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
        <input type="hidden" name="exerciseId" value={exercise.id} />
        <div className="min-w-0 flex-1">
          <p className="label">Reuse this later</p>
          <p className="text-sm text-muted">
            Saves this exercise &mdash; video and all &mdash; to your library. Save it again after
            edits to update the stored version.
          </p>
        </div>
        <input
          name="category"
          defaultValue={exercise.category || EXERCISE_CATEGORIES[0]}
          list="section-suggestions"
          aria-label="Library section"
          className="field sm:w-40"
        />
        <button type="submit" className="btn-secondary shrink-0 text-base">
          Save to library
        </button>
      </form>

      <form action={removeExercise} className="mt-8 border-t border-line pt-6">
        <input type="hidden" name="exerciseId" value={exercise.id} />
        <button type="submit" className="btn-ghost text-base hover:text-brand">
          Delete exercise
        </button>
      </form>
    </>
  );
}
