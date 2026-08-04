'use client';

import { useRef, useState } from 'react';

import { saveImportedWeek, saveImportedWorkout } from '@/app/admin/actions';
import { EmojiField } from '@/components/admin/EmojiField';
import { fitWithin, totalBytes } from '@/lib/image-shrink';
import type { DraftExercise, DraftWeek, DraftWorkout } from '@/lib/importer';
import { setsLabel } from '@/lib/media';

type Stage = 'input' | 'working' | 'review';

/** Under the ~4.5 MB a serverless request body allows, with room for the text. */
const BUDGET = 3_800_000;

/** The week a single-workout import is being added to. Absent for a whole plan. */
export interface ImportTarget {
  id: string;
  title: string;
  published: boolean;
}

export function PlanImporter({ target }: { target?: ImportTarget }) {
  const [stage, setStage] = useState<Stage>('input');
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [draft, setDraft] = useState<DraftWeek | DraftWorkout | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const noun = target ? 'workout' : 'week';

  async function askClaude() {
    setStage('working');
    setError(null);

    try {
      const body = new FormData();
      body.append('text', text);
      body.append('scope', noun);

      // Resized here rather than sent as-is: five phone photos are far more
      // than a serverless request body will carry, and the platform rejects
      // the whole thing with a page that isn't even JSON.
      const shrunk = await fitWithin(files, BUDGET);
      shrunk.forEach((file) => body.append('images', file));

      if (totalBytes(shrunk) > BUDGET) {
        throw new Error(
          `Even shrunk, those ${files.length} images come to ${Math.round(
            totalBytes(shrunk) / 100_000,
          ) / 10} MB — more than can be sent at once. Try three or four at a time.`,
        );
      }

      const response = await fetch('/api/admin/import', { method: 'POST', body });

      // A body that's too big comes back as plain text, and parsing that as
      // JSON produces a error about strings and patterns rather than a cause.
      const raw = await response.text();
      let data: { draft?: DraftWeek | DraftWorkout; error?: string };
      try {
        data = JSON.parse(raw) as typeof data;
      } catch {
        throw new Error(
          response.status === 413
            ? 'Those images were too large to send. Try fewer at a time.'
            : `The server replied with ${response.status}. ${raw.slice(0, 80)}`.trim(),
        );
      }

      if (!response.ok || !data.draft) throw new Error(data.error ?? 'Import failed.');

      setDraft(data.draft);
      setStage('review');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.');
      setStage('input');
    }
  }

  if (stage === 'review' && draft) {
    const startOver = () => setStage('input');
    return target ? (
      <ReviewWorkout draft={draft as DraftWorkout} target={target} onDiscard={startOver} />
    ) : (
      <ReviewWeek draft={draft as DraftWeek} onDiscard={startOver} />
    );
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
          target
            ? 'Paste one session: what you wrote in Claude, a routine your physio gave you, notes off a website.\n\ne.g. "Legs day — sit to stand 2x8, heel raises 2x12, wall sit 30 sec x2, finish with a quad stretch"'
            : 'Paste anything: a plan you wrote in Claude, notes from a physio, a routine off a website.\n\ne.g. "Monday — legs: sit to stand 2x8, heel raises 2x12, standing march 30 sec x2..."'
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
        A physio&rsquo;s handout, a screenshot of another app, a photo of something written down. Up
        to 6 images &mdash; they&rsquo;re shrunk before sending, so several at once is fine.
      </p>

      {error && (
        <p className="mt-4 rounded-xl bg-brand-tint px-4 py-3 text-base font-semibold text-brand">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={askClaude}
        disabled={working || (!text.trim() && files.length === 0)}
        className="btn-primary mt-6 w-full disabled:opacity-60"
      >
        {working ? 'Reading it…' : `Draft the ${noun}`}
      </button>

      {working && (
        <p className="mt-3 text-center text-sm text-muted">
          This usually takes 20&ndash;40 seconds. You&rsquo;ll see everything before it saves.
        </p>
      )}
    </>
  );
}

function CheckFirst({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl2 border-2 border-brand bg-brand-tint p-4">
      <p className="font-bold text-brand">Check this before saving</p>
      <p className="mt-1 text-sm text-ink/80">
        This was written by AI from what you gave it. Read the exercises and numbers &mdash;
        especially if the source was a photo. {children}
      </p>
    </div>
  );
}

/**
 * Strips the library match off any exercise the coach has unticked, so the
 * saved draft reflects what's on screen rather than what the model decided.
 */
function applyChoices<T extends DraftWeek | DraftWorkout>(draft: T, rejected: Set<string>): T {
  const fix = (exercises: DraftExercise[], prefix: string) =>
    exercises.map((exercise, i) =>
      rejected.has(`${prefix}${i}`)
        ? { ...exercise, library_match: '', library_id: undefined, library_name: undefined }
        : exercise,
    );

  if ('workouts' in draft) {
    return {
      ...draft,
      workouts: draft.workouts.map((workout, w) => ({
        ...workout,
        exercises: fix(workout.exercises, `${w}:`),
      })),
    };
  }

  return { ...draft, exercises: fix(draft.exercises, '0:') };
}


/**
 * Offers to file anything new into the library. Left unticked on purpose: the
 * library is a curated list, and quietly appending to it every time a plan is
 * imported is how it stops being one.
 */
function KeepInLibrary({ newCount }: { newCount: number }) {
  if (newCount === 0) return null;

  return (
    <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-xl2 border-2 border-line bg-surface px-4 py-3">
      <input type="checkbox" name="keepInLibrary" className="mt-0.5 h-5 w-5 shrink-0 accent-brand" />
      <span className="text-base">
        <span className="font-semibold">
          Save {newCount === 1 ? 'the new exercise' : `all ${newCount} new exercises`} to my library
        </span>
        <span className="block text-sm text-muted">
          So you can reuse {newCount === 1 ? 'it' : 'them'} later and attach a video once. Anything
          already in your library is left alone.
        </span>
      </span>
    </label>
  );
}

function ExerciseLines({
  exercises,
  prefix,
  rejected,
  onToggle,
}: {
  exercises: DraftExercise[];
  prefix: string;
  rejected: Set<string>;
  onToggle: (key: string) => void;
}) {
  return (
    <ul className="mt-3 flex flex-col gap-2">
      {exercises.map((exercise, i) => {
        const key = `${prefix}${i}`;
        const matched = Boolean(exercise.library_id) && !rejected.has(key);

        return (
          <li key={i} className="border-t border-line pt-2 first:border-0 first:pt-0">
            <p className="font-semibold">
              {matched ? exercise.library_name : exercise.name}
              {exercise.category && (
                <span className="ml-2 text-xs font-bold tracking-widest text-brand uppercase">
                  {exercise.category}
                </span>
              )}
            </p>
            <p className="text-sm text-muted">
              {setsLabel(exercise)}
              {exercise.equipment && <> &middot; {exercise.equipment}</>}
            </p>

            {exercise.library_id ? (
              <label className="mt-1.5 flex cursor-pointer items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={matched}
                  onChange={() => onToggle(key)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-brand"
                />
                <span className={matched ? 'text-ink' : 'text-muted'}>
                  {exercise.library_suggested && !matched ? 'Did you mean ' : 'Use '}
                  <span className="font-semibold">{exercise.library_name}</span>
                  {exercise.library_suggested && !matched ? '?' : ' from your library'}
                  {matched && ' — its video and wording come with it'}
                  {!matched && !exercise.library_suggested && (
                    <> (adding &ldquo;{exercise.name}&rdquo; as a new one instead)</>
                  )}
                  {!matched && exercise.library_suggested && (
                    <> Tick to use it and its video.</>
                  )}
                </span>
              </label>
            ) : (
              exercise.instructions && (
                <p className="mt-1 text-sm whitespace-pre-line text-muted">
                  {exercise.instructions}
                </p>
              )
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Which library pairings are off, keyed by position.
 *
 * A pairing the model made starts on; one guessed from the names afterwards
 * starts off, so accepting a guess is always a deliberate act.
 */
function useChoices(initiallyOff: string[]) {
  const [rejected, setRejected] = useState<Set<string>>(() => new Set(initiallyOff));
  const toggle = (key: string) =>
    setRejected((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  return { rejected, toggle };
}

function ReviewWorkout({
  draft,
  target,
  onDiscard,
}: {
  draft: DraftWorkout;
  target: ImportTarget;
  onDiscard: () => void;
}) {
  const { rejected, toggle } = useChoices(
    draft.exercises.flatMap((e, i) => (e.library_suggested ? [`0:${i}`] : [])),
  );
  const matched = draft.exercises.filter((e, i) => e.library_id && !rejected.has(`0:${i}`)).length;

  return (
    <form action={saveImportedWorkout}>
      <input type="hidden" name="draft" value={JSON.stringify(applyChoices(draft, rejected))} />
      <input type="hidden" name="weekId" value={target.id} />

      <CheckFirst>
        {target.published ? (
          <>
            <span className="font-semibold">{target.title} is live</span>, so this workout shows up
            for your parents as soon as you save it.
          </>
        ) : (
          <>
            It goes into <span className="font-semibold">{target.title}</span>, which is still a
            draft, so nobody sees it until you publish that week.
          </>
        )}
      </CheckFirst>

      <div className="mt-6 grid gap-4 sm:grid-cols-[auto_1fr]">
        <div>
          <p className="label">Icon</p>
          <EmojiField defaultValue="" />
        </div>
        <div>
          <label htmlFor="title" className="label">
            Workout name
          </label>
          <input id="title" name="title" defaultValue={draft.title} className="field" />
        </div>
      </div>

      {draft.subtitle && <p className="mt-3 text-base text-muted">{draft.subtitle}</p>}

      <p className="mt-6 text-sm text-muted">
        {draft.exercises.length} exercise{draft.exercises.length === 1 ? '' : 's'}
        {matched > 0 ? ` · ${matched} from your library, with their videos` : ' · no videos yet'}
      </p>

      <div className="card mt-3 p-4">
        <ExerciseLines
          exercises={draft.exercises}
          prefix="0:"
          rejected={rejected}
          onToggle={toggle}
        />
      </div>

      <KeepInLibrary newCount={draft.exercises.length - matched} />

      <div className="mt-8 flex flex-col gap-3 sm:flex-row-reverse">
        <button type="submit" className="btn-primary flex-1">
          Add to {target.title}
        </button>
        <button type="button" onClick={onDiscard} className="btn-secondary text-base">
          Start over
        </button>
      </div>
    </form>
  );
}

function ReviewWeek({ draft, onDiscard }: { draft: DraftWeek; onDiscard: () => void }) {
  const { rejected, toggle } = useChoices(
    draft.workouts.flatMap((workout, w) =>
      workout.exercises.flatMap((e, i) => (e.library_suggested ? [`${w}:${i}`] : [])),
    ),
  );
  const total = draft.workouts.reduce((sum, w) => sum + w.exercises.length, 0);
  const matched = draft.workouts.reduce(
    (sum, workout, w) =>
      sum + workout.exercises.filter((e, i) => e.library_id && !rejected.has(`${w}:${i}`)).length,
    0,
  );

  return (
    <form action={saveImportedWeek}>
      <input type="hidden" name="draft" value={JSON.stringify(applyChoices(draft, rejected))} />

      <CheckFirst>It saves as a draft, so nobody sees it until you publish.</CheckFirst>

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
        exercise{total === 1 ? '' : 's'}
        {matched > 0 ? ` · ${matched} from your library, with their videos` : ' · no videos yet'}
      </p>

      <ul className="mt-3 flex flex-col gap-3">
        {draft.workouts.map((workout, i) => (
          <li key={i} className="card p-4">
            <p className="font-bold">{workout.title}</p>
            {workout.subtitle && <p className="text-sm text-muted">{workout.subtitle}</p>}
            <ExerciseLines
              exercises={workout.exercises}
              prefix={`${i}:`}
              rejected={rejected}
              onToggle={toggle}
            />
          </li>
        ))}
      </ul>

      <KeepInLibrary newCount={total - matched} />

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
