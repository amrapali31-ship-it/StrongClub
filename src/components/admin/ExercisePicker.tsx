'use client';

import { useState } from 'react';

import { searchExercises } from '@/lib/matching';

export interface PickerItem {
  id: string;
  name: string;
  category: string;
  equipment?: string;
  hasMedia: boolean;
}

/**
 * Type to narrow, tap to choose.
 *
 * A native select is the wrong control once a library runs past a few dozen
 * entries — on a phone it becomes a spinning wheel you scroll blind. This is a
 * search box over the same list, and picking submits the surrounding form, so
 * choosing an exercise is one tap rather than a wheel and a button.
 */
export function ExercisePicker({
  name,
  items,
  label,
  placeholder = 'Search your library…',
  onCancel,
}: {
  /** Hidden field the chosen id is submitted under. */
  name: string;
  items: PickerItem[];
  label: string;
  placeholder?: string;
  onCancel?: () => void;
}) {
  const [query, setQuery] = useState('');

  const results = searchExercises(query, items);
  const shown = results.slice(0, 40);

  return (
    <div>
      <div className="flex items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          aria-label={label}
          type="search"
          enterKeyHint="search"
          className="field min-w-0 flex-1"
        />
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="shrink-0 px-2 text-sm font-semibold text-muted hover:text-ink"
          >
            Cancel
          </button>
        )}
      </div>

      {results.length === 0 ? (
        <p className="mt-3 text-sm text-muted">
          Nothing in your library matches &ldquo;{query.trim()}&rdquo;.
        </p>
      ) : (
        <>
          <ul className="mt-2 flex max-h-72 flex-col gap-1 overflow-y-auto">
            {shown.map((item) => (
              <li key={item.id}>
                {/* The button carries the value itself rather than setting
                    state first: React hasn't re-rendered by the time the
                    submit fires, so a hidden input would still be empty. */}
                <button
                  type="submit"
                  name={name}
                  value={item.id}
                  className="flex w-full items-baseline gap-2 rounded-xl px-3 py-2.5 text-left transition hover:bg-surface"
                >
                  <span className="min-w-0 flex-1 truncate font-semibold">
                    {item.name}
                    {item.hasMedia && <span className="ml-1.5 text-xs">🎬</span>}
                  </span>
                  <span className="shrink-0 text-xs text-muted">{item.category || 'No section'}</span>
                </button>
              </li>
            ))}
          </ul>

          {results.length > shown.length && (
            <p className="mt-1 px-3 text-xs text-muted">
              {results.length - shown.length} more &mdash; keep typing to narrow it down.
            </p>
          )}
        </>
      )}
    </div>
  );
}
