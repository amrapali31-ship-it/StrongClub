import Link from 'next/link';
import { notFound } from 'next/navigation';

import { removeLibraryExercise, saveLibraryExercise } from '@/app/admin/actions';
import { MediaPicker } from '@/components/admin/MediaPicker';
import { ModeFields } from '@/components/admin/ModeFields';
import { db } from '@/lib/db';
import { EXERCISE_CATEGORIES } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function AdminLibraryExercise({
  params,
}: {
  params: Promise<{ libraryId: string }>;
}) {
  const { libraryId } = await params;

  const exercise = await db.getLibraryExercise(libraryId);
  if (!exercise) notFound();

  return (
    <>
      <Link href="/admin/library" className="text-sm font-semibold text-muted hover:text-ink">
        &larr; Library
      </Link>

      <form action={saveLibraryExercise} className="card mt-3 p-5">
        <input type="hidden" name="libraryId" value={exercise.id} />

        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <div>
            <label htmlFor="name" className="label">
              Exercise name
            </label>
            <input id="name" name="name" defaultValue={exercise.name} className="field" />
          </div>
          <div>
            <label htmlFor="category" className="label">
              Category
            </label>
            <select
              id="category"
              name="category"
              defaultValue={exercise.category}
              className="field"
            >
              {EXERCISE_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
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
          className="field"
        />

        <div className="mt-5">
          <MediaPicker
            name={exercise.name}
            defaultUrl={exercise.media_url}
            defaultType={exercise.media_type}
          />
        </div>

        <p className="mt-4 text-sm text-muted">
          These are the starting values. Adding this to a workout copies them across, and you can
          adjust the copy for that week without changing the library.
        </p>

        <button type="submit" className="btn-primary mt-5 w-full">
          Save to library
        </button>
      </form>

      <form action={removeLibraryExercise} className="mt-8 border-t border-line pt-6">
        <input type="hidden" name="libraryId" value={exercise.id} />
        <button type="submit" className="btn-ghost text-base hover:text-brand">
          Remove from library
        </button>
      </form>
    </>
  );
}
