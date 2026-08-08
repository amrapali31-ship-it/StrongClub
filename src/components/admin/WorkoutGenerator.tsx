'use client';

import { useState } from 'react';

import { ReviewWorkout, type ImportTarget } from '@/components/admin/PlanImporter';
import type { DraftWorkout } from '@/lib/importer';

/** Starting points, so the box isn't a blank page. */
const IDEAS = [
  'A full body workout, 50 minutes',
  'A gentle 20 minutes for a day off',
  'Legs and balance, 30 minutes, chair only',
  'Upper body, 40 minutes, no floor work',
];

/**
 * Asks for a workout in words and builds it out of the library.
 *
 * Unlike the importer there's no source to transcribe — the library is the
 * source, and the request only says what shape to put it in. Everything it
 * picks therefore arrives with its video and wording already attached, which
 * is the whole reason to build from the library rather than from nothing.
 */
export function WorkoutGenerator({ target }: { target: ImportTarget }) {
  const [request, setRequest] = useState('');
  const [draft, setDraft] = useState<DraftWorkout | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function build() {
    setWorking(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ request }),
      });

      const raw = await response.text();
      let data: { draft?: DraftWorkout; error?: string };
      try {
        data = JSON.parse(raw) as typeof data;
      } catch {
        throw new Error(`The server replied with ${response.status}.`);
      }

      if (!response.ok || !data.draft) throw new Error(data.error ?? 'Could not build a workout.');
      setDraft(data.draft);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not build a workout.');
    } finally {
      setWorking(false);
    }
  }

  if (draft) {
    return <ReviewWorkout draft={draft} target={target} onDiscard={() => setDraft(null)} />;
  }

  return (
    <>
      <label htmlFor="request" className="label">
        What do you want?
      </label>
      <textarea
        id="request"
        rows={4}
        value={request}
        onChange={(e) => setRequest(e.target.value)}
        disabled={working}
        placeholder="e.g. A full body workout for Mum, about 50 minutes, nothing on the floor"
        className="field font-normal"
      />

      <div className="mt-3 flex flex-wrap gap-2">
        {IDEAS.map((idea) => (
          <button
            key={idea}
            type="button"
            onClick={() => setRequest(idea)}
            disabled={working}
            className="rounded-full border-2 border-line bg-surface px-3 py-1.5 text-sm font-semibold text-muted transition hover:border-brand/60 hover:text-ink disabled:opacity-60"
          >
            {idea}
          </button>
        ))}
      </div>

      <p className="mt-3 text-sm text-muted">
        It only uses exercises from your library, and follows the way your existing workouts are
        put together &mdash; their sections, their naming, how hard you pitch them.
      </p>

      {error && (
        <p className="mt-4 rounded-xl bg-brand-tint px-4 py-3 text-base font-semibold text-brand">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={build}
        disabled={working || !request.trim()}
        className="btn-primary mt-6 w-full disabled:opacity-60"
      >
        {working ? 'Building…' : 'Build it'}
      </button>

      {working && (
        <p className="mt-3 text-center text-sm text-muted">
          This usually takes 20&ndash;40 seconds. You&rsquo;ll see everything before it saves.
        </p>
      )}
    </>
  );
}
