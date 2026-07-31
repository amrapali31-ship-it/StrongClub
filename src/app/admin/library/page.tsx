import Link from 'next/link';

import { addLibraryExercise } from '@/app/admin/actions';
import { MediaThumb } from '@/components/MediaFrame';
import { db } from '@/lib/db';
import { setsLabel } from '@/lib/media';
import { EXERCISE_CATEGORIES } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function AdminLibrary() {
  const library = await db.listLibrary();
  const withVideo = library.filter((e) => e.media_type !== 'none').length;

  return (
    <>
      <Link href="/admin" className="text-sm font-semibold text-muted hover:text-ink">
        &larr; All weeks
      </Link>

      <h1 className="mt-3 text-2xl font-extrabold tracking-tight">Exercise library</h1>
      <p className="mt-1 text-muted">
        Your reusable movements. Add a video here once and every workout you build from it gets the
        video too.
      </p>

      {library.length > 0 && (
        <p className="mt-3 text-sm text-muted">
          {library.length} exercises &middot;{' '}
          <span className={withVideo === library.length ? 'text-success' : undefined}>
            {withVideo} with a video
          </span>
        </p>
      )}

      <form action={addLibraryExercise} className="card mt-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="name" className="label">
            Add an exercise
          </label>
          <input id="name" name="name" placeholder="e.g. Bulgarian split squat" className="field" />
        </div>
        <div>
          <label htmlFor="category" className="label">
            Category
          </label>
          <select id="category" name="category" className="field">
            {EXERCISE_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-primary shrink-0 text-base">
          Add
        </button>
      </form>

      {library.length === 0 ? (
        <div className="card mt-6 p-5">
          <p className="font-bold">Your library is empty</p>
          <p className="mt-2 text-muted">
            Add exercises above, or run <code className="font-mono">npm run seed:library</code> to
            drop in around 70 standard movements you can then edit.
          </p>
        </div>
      ) : (
        <div className="mt-8 flex flex-col gap-8">
          {EXERCISE_CATEGORIES.map((category) => {
            const items = library.filter((e) => e.category === category);
            if (items.length === 0) return null;

            return (
              <section key={category}>
                <h2 className="text-lg font-extrabold tracking-tight">
                  {category}{' '}
                  <span className="text-base font-semibold text-muted">({items.length})</span>
                </h2>

                <ul className="mt-3 flex flex-col gap-2">
                  {items.map((exercise) => (
                    <li key={exercise.id}>
                      <Link
                        href={`/admin/library/${exercise.id}`}
                        className="card flex items-center gap-3 p-3 transition hover:border-ink/25"
                      >
                        <MediaThumb
                          mediaType={exercise.media_type}
                          url={exercise.media_url}
                          name={exercise.name}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-bold">{exercise.name}</p>
                          <p className="text-sm text-muted">
                            {setsLabel(exercise)}
                            {exercise.media_type === 'none' && (
                              <span className="ml-2 text-brand">no video</span>
                            )}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-semibold text-brand">Edit</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}

          {/* Anything typed into a category that later gets renamed still shows. */}
          {(() => {
            const known = new Set<string>(EXERCISE_CATEGORIES);
            const orphans = library.filter((e) => !known.has(e.category));
            if (orphans.length === 0) return null;
            return (
              <section>
                <h2 className="text-lg font-extrabold tracking-tight">Other</h2>
                <ul className="mt-3 flex flex-col gap-2">
                  {orphans.map((exercise) => (
                    <li key={exercise.id}>
                      <Link
                        href={`/admin/library/${exercise.id}`}
                        className="card flex items-center gap-3 p-3"
                      >
                        <span className="font-bold">{exercise.name}</span>
                        <span className="ml-auto text-sm text-muted">{exercise.category}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })()}
        </div>
      )}
    </>
  );
}
