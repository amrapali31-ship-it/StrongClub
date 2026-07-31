import Link from 'next/link';
import { notFound } from 'next/navigation';

import { removeExercise, saveExercise } from '@/app/admin/actions';
import { MediaPicker } from '@/components/admin/MediaPicker';
import { ModeFields } from '@/components/admin/ModeFields';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function AdminExercise({
  params,
}: {
  params: Promise<{ exerciseId: string }>;
}) {
  const { exerciseId } = await params;

  const exercise = await db.getExercise(exerciseId);
  if (!exercise) notFound();

  return (
    <>
      <Link
        href={`/admin/workout/${exercise.workout_id}`}
        className="text-sm font-semibold text-muted hover:text-ink"
      >
        &larr; Back to workout
      </Link>

      <form action={saveExercise} className="card mt-3 p-5">
        <input type="hidden" name="exerciseId" value={exercise.id} />

        <label htmlFor="name" className="label">
          Exercise name
        </label>
        <input id="name" name="name" defaultValue={exercise.name} className="field" />

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

      <form action={removeExercise} className="mt-8 border-t border-line pt-6">
        <input type="hidden" name="exerciseId" value={exercise.id} />
        <button type="submit" className="btn-ghost text-base hover:text-brand">
          Delete exercise
        </button>
      </form>
    </>
  );
}
