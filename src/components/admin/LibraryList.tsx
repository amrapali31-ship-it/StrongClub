'use client';

import Link from 'next/link';
import { useState } from 'react';

import { MediaThumb } from '@/components/MediaFrame';
import { searchExercises } from '@/lib/matching';
import { setsLabel } from '@/lib/media';
import type { LibraryExercise } from '@/lib/types';

/**
 * The library, with a search box over it.
 *
 * Grouping by section is how you browse eighty exercises; searching is how you
 * find one you can already name. While a search is running the grouping is
 * dropped — headings over one result each are noise, and the point of typing
 * is that you know what you're after.
 */
export function LibraryList({
  library,
  sections,
}: {
  library: LibraryExercise[];
  sections: { category: string; items: LibraryExercise[] }[];
}) {
  const [query, setQuery] = useState('');

  const searching = query.trim().length > 0;
  const results = searchExercises(query, library);
  const groups = searching ? [{ category: '', items: results }] : sections;

  return (
    <>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search your library…"
        aria-label="Search your library"
        type="search"
        enterKeyHint="search"
        className="field mt-8"
      />

      {searching && (
        <p className="mt-2 text-sm text-muted">
          {results.length === 0
            ? `Nothing matches “${query.trim()}”.`
            : `${results.length} ${results.length === 1 ? 'match' : 'matches'}`}
        </p>
      )}

      <div className="mt-4 flex flex-col gap-8">
        {groups.map(({ category, items }) => (
          <section key={category || 'other'}>
            {!searching && (
              <h2 className="text-lg font-extrabold tracking-tight">
                {category || 'No section'}{' '}
                <span className="text-base font-semibold text-muted">({items.length})</span>
              </h2>
            )}

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
                      posterUrl={exercise.poster_url}
                      name={exercise.name}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold">{exercise.name}</p>
                      <p className="text-sm text-muted">
                        {setsLabel(exercise)}
                        {exercise.equipment && <> &middot; {exercise.equipment}</>}
                        {/* While searching, the section is worth showing —
                            it's the context the heading would have given. */}
                        {searching && exercise.category && <> &middot; {exercise.category}</>}
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
        ))}
      </div>
    </>
  );
}
