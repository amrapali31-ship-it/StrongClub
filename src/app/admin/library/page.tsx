import { BackLink } from '@/components/BackLink';
import { addLibraryExercise } from '@/app/admin/actions';
import { LibraryList } from '@/components/admin/LibraryList';
import { db } from '@/lib/db';
import { EXERCISE_CATEGORIES } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function AdminLibrary() {
  const library = await db.listLibrary();
  const withVideo = library.filter((e) => e.media_type !== 'none').length;

  // Sections are free text, so list the suggested ones in their intended order
  // and append whatever else the coach has invented.
  const used = [...new Set(library.map((e) => e.category))];
  const suggested = EXERCISE_CATEGORIES.filter((c) => used.includes(c));
  const custom = used.filter((c) => c && !suggested.includes(c as never)).sort();
  const sections = [...suggested, ...custom, ...(used.includes('') ? [''] : [])].map(
    (category) => ({ category, items: library.filter((e) => e.category === category) }),
  );

  return (
    <>
      <BackLink href="/admin" label="All weeks" />

      <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Exercise library</h1>
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
          <input
            id="category"
            name="category"
            defaultValue={EXERCISE_CATEGORIES[1]}
            list="library-sections"
            className="field"
          />
          <datalist id="library-sections">
            {[...new Set([...EXERCISE_CATEGORIES, ...library.map((e) => e.category)])]
              .filter(Boolean)
              .sort()
              .map((category) => (
                <option key={category} value={category} />
              ))}
          </datalist>
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
        <LibraryList library={library} sections={sections} />
      )}
    </>
  );
}
