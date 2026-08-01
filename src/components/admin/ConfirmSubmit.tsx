'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Two-step submit for the things that take other things down with them.
 *
 * The first tap arms it and spells out what will be destroyed, because a week
 * takes its workouts and every exercise inside them, and there is no undo.
 *
 * The first tap is a real submit button with `preventDefault`, so if scripting
 * ever fails the form still posts and delete keeps working — it just loses the
 * confirmation step rather than the whole feature.
 */
export function ConfirmSubmit({
  label,
  question,
  consequence,
  confirmLabel = 'Delete',
  className = 'btn-ghost text-base hover:text-brand',
}: {
  label: string;
  question: string;
  /** What else goes. Left out when nothing else does. */
  consequence?: string;
  confirmLabel?: string;
  className?: string;
}) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Don't leave a primed delete sitting there if they wander off.
  useEffect(() => {
    if (!armed) return;
    timer.current = setTimeout(() => setArmed(false), 8000);
    return () => clearTimeout(timer.current);
  }, [armed]);

  if (!armed) {
    return (
      <button
        type="submit"
        onClick={(event) => {
          event.preventDefault();
          setArmed(true);
        }}
        className={className}
      >
        {label}
      </button>
    );
  }

  return (
    <div className="rounded-xl2 border-2 border-brand bg-brand-tint p-4">
      <p className="font-bold text-brand">{question}</p>
      {consequence && <p className="mt-1 text-sm text-ink/80">{consequence}</p>}

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={() => setArmed(false)}
          className="btn-secondary text-base sm:order-2 sm:ml-auto"
        >
          Keep it
        </button>
        <button
          type="submit"
          autoFocus
          className="rounded-xl2 bg-brand px-5 py-3 text-base font-bold text-canvas sm:order-1"
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
