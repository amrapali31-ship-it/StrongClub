'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Two-tap delete. The first tap arms it and a confirm strip covers the row,
 * because this sits next to the reorder arrows and there's no undo.
 *
 * The strip is an overlay rather than inline controls so arming it doesn't
 * reflow the exercise name into three lines on a phone.
 *
 * The first tap is a real submit button with `preventDefault`, so if scripting
 * ever fails the form still posts and delete keeps working — it just loses the
 * confirmation step rather than the whole feature.
 */
export function DeleteExerciseButton({ name }: { name: string }) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Don't leave a primed delete sitting there if they wander off.
  useEffect(() => {
    if (!armed) return;
    timer.current = setTimeout(() => setArmed(false), 6000);
    return () => clearTimeout(timer.current);
  }, [armed]);

  return (
    <>
      <button
        type="submit"
        onClick={(event) => {
          event.preventDefault();
          setArmed(true);
        }}
        aria-label={`Delete ${name}`}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl text-muted transition hover:bg-brand/15 hover:text-brand"
      >
        ×
      </button>

      {armed && (
        <div className="absolute inset-0 z-10 flex items-center gap-3 rounded-xl2 bg-surface px-4">
          <p className="min-w-0 flex-1 truncate text-base font-semibold">Delete {name}?</p>
          <button
            type="submit"
            autoFocus
            className="shrink-0 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-canvas"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={() => setArmed(false)}
            className="shrink-0 px-1 text-sm font-semibold text-muted hover:text-ink"
          >
            Cancel
          </button>
        </div>
      )}
    </>
  );
}
