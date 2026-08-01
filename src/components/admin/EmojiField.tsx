'use client';

import { useState } from 'react';

/** Enough to cover most workouts without opening the keyboard's emoji panel. */
const QUICK_PICKS = ['🦵', '💪', '🧘', '🚶', '🏋️', '🤸', '🪑', '⚖️', '🫀', '🌅', '🌙', '🧠'];

/**
 * Small emoji input with a row of one-tap options. It's a plain text field
 * underneath, so the phone's own emoji keyboard works for anything not listed.
 */
export function EmojiField({ defaultValue }: { defaultValue: string }) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);

  return (
    <div>
      <div className="flex items-center gap-2">
        <input
          id="emoji"
          name="emoji"
          value={value}
          onChange={(e) => setValue([...e.target.value].slice(0, 2).join(''))}
          placeholder="🦵"
          aria-label="Workout icon"
          className="field w-20 text-center text-2xl"
        />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="shrink-0 px-2 text-sm font-semibold text-brand"
        >
          {open ? 'Close' : 'Pick'}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => setValue('')}
            className="shrink-0 px-1 text-sm font-semibold text-muted hover:text-ink"
          >
            Clear
          </button>
        )}
      </div>

      {open && (
        <div className="mt-2 flex max-w-64 flex-wrap gap-1">
          {QUICK_PICKS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                setValue(emoji);
                setOpen(false);
              }}
              aria-label={`Use ${emoji}`}
              className="flex h-11 w-11 items-center justify-center rounded-xl border-2 border-line bg-surface text-xl transition hover:border-brand"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
