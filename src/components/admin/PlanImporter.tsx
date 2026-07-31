'use client';

import { useRef, useState } from 'react';

import { saveImportedWeek } from '@/app/admin/actions';
import type { DraftWeek } from '@/lib/importer';
import { setsLabel } from '@/lib/media';

type Stage = 'input' | 'working' | 'review';

export function PlanImporter() {
  const [stage, setStage] = useState<Stage>('input');
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [draft, setDraft] = useState<DraftWeek | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function draftWeek() {
    setStage('working');
    setError(null);

    try {
      const body = new FormData();
      body.append('text', text);
      files.forEach((file) => body.append('images', file));

      const response = await fetch('/api/admin/import', { method: 'POST', body });
      const data = (await response.json()) as { draft?: DraftWeek; error?: string };

      if (!response.ok || !data.draft) throw new Error(data.error ?? 'Import failed.');

      setDraft(data.draft);
      setStage('review');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.');
      setStage('input');
    }
  }

  if (stage === 'review' && draft) {
    return <ReviewDraft draft={draft} onDiscard={() => setStage('input')} />;
  }

  const working = stage === 'working';

  return (
    <>
      <label htmlFor="plan" className="label">
        Paste a plan
      </label>
      <textarea
        id="plan"
        rows={8}
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={working}
        placeholder={
          'Paste anything: a plan you wrote in Claude, notes from a physio, a routine off a website.\n\ne.g. "Monday — legs: sit to stand 2x8, heel raises 2x12, standing march 30 sec x2..."'
        }
        className="field font-normal"
      />

      <p className="label mt-5">Or add photos</p>
      <input
        ref={fileInput}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        multiple
        disabled={working}
        onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => fileInput.current?.click()}
        disabled={working}
        className="btn-secondary w-full text-base disabled:opacity-60"
      >
        {files.length > 0
          ? `${files.length} image${files.length === 1 ? '' : 's'} selected`
          : 'Choose photos or screenshots'}
      </button>
      <p className="mt-2 text-sm text-muted">
        A physio&rsquo;s handout, a screenshot of another app, a photo of something written down.
        Up to 6 images.
      </p>

      {error && (
        <p className="mt-4 rounded-xl bg-brand-tint px-4 py-3 text-base font-semibold text-brand">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={draftWeek}
        disabled={working || (!text.trim() && files.length === 0)}
        className="btn-primary mt-6 w-full disabled:opacity-60"
      >
        {working ? 'Reading it…' : 'Draft the week'}
      </button>

      {working && (
        <p className="mt-3 text-center text-sm text-muted">
          This usually takes 20&ndash;40 seconds. You&rsquo;ll see everything before it saves.
        </p>
      )}
    </>
  );
}

function ReviewDraft({ draft, onDiscard }: { draft: DraftWeek; onDiscard: () => void }) {
  const total = draft.workouts.reduce((sum, w) => sum + w.exercises.length, 0);

  return (
    <form action={saveImportedWeek}>
      <input type="hidden" name="draft" value={JSON.stringify(draft)} />

      <div className="rounded-xl2 border-2 border-brand bg-brand-tint p-4">
        <p className="font-bold text-brand">Check this before saving</p>
        <p className="mt-1 text-sm text-ink/80">
          This was written by AI from what you gave it. Read the exercises and numbers — especially
          if the source was a photo. It saves as a draft, so nobody sees it until you publish.
        </p>
      </div>

      <label htmlFor="title" className="label mt-6">
        Week name
      </label>
      <input id="title" name="title" defaultValue={draft.title} className="field" />

      <label htmlFor="start_date" className="label mt-4">
        Starts on
      </label>
      <input id="start_date" name="start_date" type="date" className="field" />

      {draft.note && (
        <div className="mt-4">
          <p className="label">Note for your parents</p>
          <p className="card p-4 text-base leading-relaxed">{draft.note}</p>
        </div>
      )}

      <p className="mt-6 text-sm text-muted">
        {draft.workouts.length} workout{draft.workouts.length === 1 ? '' : 's'} &middot; {total}{' '}
        exercise{total === 1 ? '' : 's'} &middot; no videos attached yet
      </p>

      <ul className="mt-3 flex flex-col gap-3">
        {draft.workouts.map((workout, i) => (
          <li key={i} className="card p-4">
            <p className="font-bold">{workout.title}</p>
            {workout.subtitle && <p className="text-sm text-muted">{workout.subtitle}</p>}

            <ul className="mt-3 flex flex-col gap-2">
              {workout.exercises.map((exercise, j) => (
                <li key={j} className="border-t border-line pt-2 first:border-0 first:pt-0">
                  <p className="font-semibold">{exercise.name}</p>
                  <p className="text-sm text-muted">{setsLabel(exercise)}</p>
                  {exercise.instructions && (
                    <p className="mt-1 text-sm whitespace-pre-line text-muted">
                      {exercise.instructions}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row-reverse">
        <button type="submit" className="btn-primary flex-1">
          Save as draft
        </button>
        <button type="button" onClick={onDiscard} className="btn-secondary text-base">
          Start over
        </button>
      </div>
    </form>
  );
}
