'use client';

import { useState } from 'react';

import type { ExerciseMode } from '@/lib/types';

/** The numeric fields shared by workout exercises and library entries. */
interface ModeFieldsSource {
  mode: ExerciseMode;
  sets: number;
  reps: number | null;
  duration_seconds: number | null;
  rest_seconds: number;
}

/** Reps or a hold — switching swaps which number the coach fills in. */
export function ModeFields({ exercise }: { exercise: ModeFieldsSource }) {
  const [mode, setMode] = useState<ExerciseMode>(exercise.mode);

  return (
    <>
      <input type="hidden" name="mode" value={mode} />

      <span className="label">Measured by</span>
      <div className="flex gap-2" role="radiogroup" aria-label="Measured by">
        {(
          [
            ['reps', 'Repetitions'],
            ['time', 'Time held'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={mode === value}
            onClick={() => setMode(value)}
            className={`flex-1 rounded-xl border-2 px-4 py-3 text-base font-semibold transition ${
              mode === value
                ? 'border-brand bg-brand-tint text-brand'
                : 'border-line bg-surface text-muted hover:border-ink/25'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {mode === 'reps' ? (
          <div>
            <label htmlFor="reps" className="label">
              Reps
            </label>
            <input
              id="reps"
              name="reps"
              type="number"
              min={1}
              defaultValue={exercise.reps ?? 10}
              className="field"
            />
          </div>
        ) : (
          <div>
            <label htmlFor="duration_seconds" className="label">
              Hold for (seconds)
            </label>
            <input
              id="duration_seconds"
              name="duration_seconds"
              type="number"
              min={1}
              defaultValue={exercise.duration_seconds ?? 30}
              className="field"
            />
          </div>
        )}

        <div>
          <label htmlFor="sets" className="label">
            Sets
          </label>
          <input
            id="sets"
            name="sets"
            type="number"
            min={1}
            defaultValue={exercise.sets}
            className="field"
          />
        </div>

        <div>
          <label htmlFor="rest_seconds" className="label">
            Rest after (seconds)
          </label>
          <input
            id="rest_seconds"
            name="rest_seconds"
            type="number"
            min={0}
            defaultValue={exercise.rest_seconds}
            className="field"
          />
        </div>
      </div>
    </>
  );
}
