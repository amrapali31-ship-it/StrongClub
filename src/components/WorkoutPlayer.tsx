'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';

import { MediaFrame } from '@/components/MediaFrame';
import { formatDuration, targetLabel } from '@/lib/media';
import type { Exercise, Workout } from '@/lib/types';

interface Props {
  workout: Workout;
  exercises: Exercise[];
  initialDoneIds: string[];
  onExerciseDone: (exerciseId: string, done: boolean) => Promise<void>;
}

type Phase = 'work' | 'rest' | 'finished';

/** Short chime so someone can look away from the screen during a timed hold. */
function beep() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 660;
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
    osc.onended = () => void ctx.close();
  } catch {
    // Audio is a nicety; never let it break the workout.
  }
}

function buzz(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Not supported on iOS Safari — silently fine.
  }
}

export function WorkoutPlayer({ workout, exercises, initialDoneIds, onExerciseDone }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const doneSet = useMemo(() => new Set(initialDoneIds), [initialDoneIds]);
  const firstUnfinished = exercises.findIndex((e) => !doneSet.has(e.id));

  const [index, setIndex] = useState(firstUnfinished === -1 ? 0 : firstUnfinished);
  const [setNumber, setSetNumber] = useState(1);
  const [phase, setPhase] = useState<Phase>(
    firstUnfinished === -1 && exercises.length > 0 ? 'finished' : 'work',
  );
  const [completed, setCompleted] = useState<Set<string>>(() => new Set(initialDoneIds));

  const exercise = exercises[index];

  // Progress is written through server actions, so refresh the week view on the
  // way out to keep its bars in step with what just happened here.
  useEffect(() => () => router.refresh(), [router]);

  const markDone = useCallback(
    (id: string) => {
      setCompleted((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
      startTransition(async () => {
        await onExerciseDone(id, true);
      });
    },
    [onExerciseDone],
  );

  /** Move past the current exercise, resting first when one is configured. */
  const advance = useCallback(() => {
    if (!exercise) return;

    const isLastSet = setNumber >= exercise.sets;
    if (isLastSet) markDone(exercise.id);

    const isLastExercise = index >= exercises.length - 1;
    if (isLastSet && isLastExercise) {
      buzz([80, 60, 80]);
      setPhase('finished');
      return;
    }

    if (exercise.rest_seconds > 0) {
      setPhase('rest');
      return;
    }

    if (isLastSet) {
      setIndex(index + 1);
      setSetNumber(1);
    } else {
      setSetNumber(setNumber + 1);
    }
  }, [exercise, exercises.length, index, markDone, setNumber]);

  /** Called when the rest countdown finishes or is skipped. */
  const endRest = useCallback(() => {
    if (!exercise) return;
    if (setNumber >= exercise.sets) {
      setIndex((i) => Math.min(i + 1, exercises.length - 1));
      setSetNumber(1);
    } else {
      setSetNumber((n) => n + 1);
    }
    setPhase('work');
  }, [exercise, exercises.length, setNumber]);

  const goBack = useCallback(() => {
    if (setNumber > 1) {
      setSetNumber(setNumber - 1);
      setPhase('work');
      return;
    }
    if (index > 0) {
      const previous = exercises[index - 1];
      setIndex(index - 1);
      setSetNumber(previous.sets);
      setPhase('work');
    }
  }, [exercises, index, setNumber]);

  if (exercises.length === 0) {
    return (
      <div className="mx-auto w-full max-w-md px-6 py-20 text-center">
        <p className="text-xl font-bold">This workout has no exercises yet.</p>
        <Link href={`/workout/${workout.id}`} className="btn-secondary mt-6 w-full">
          Go back
        </Link>
      </div>
    );
  }

  if (phase === 'finished') {
    return (
      <FinishedScreen
        workout={workout}
        doneCount={exercises.filter((e) => completed.has(e.id)).length}
        total={exercises.length}
        onRepeat={() => {
          // Resume at whatever was skipped; start over if nothing is left.
          const next = exercises.findIndex((e) => !completed.has(e.id));
          setIndex(next === -1 ? 0 : next);
          setSetNumber(1);
          setPhase('work');
        }}
      />
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <PlayerHeader
        workoutId={workout.id}
        index={index}
        total={exercises.length}
        completed={completed}
        exercises={exercises}
      />

      {phase === 'rest' ? (
        <RestScreen
          seconds={exercise.rest_seconds}
          nextLabel={
            setNumber >= exercise.sets
              ? (exercises[index + 1]?.name ?? 'Finish')
              : `${exercise.name} — set ${setNumber + 1}`
          }
          onDone={endRest}
        />
      ) : (
        <WorkScreen
          exercise={exercise}
          setNumber={setNumber}
          onDone={advance}
          onBack={index === 0 && setNumber === 1 ? undefined : goBack}
          onSkip={() => {
            const isLast = index >= exercises.length - 1;
            if (isLast) {
              setPhase('finished');
              return;
            }
            setIndex(index + 1);
            setSetNumber(1);
          }}
        />
      )}

    </div>
  );
}

function PlayerHeader({
  workoutId,
  index,
  total,
  completed,
  exercises,
}: {
  workoutId: string;
  index: number;
  total: number;
  completed: Set<string>;
  exercises: Exercise[];
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-cream/90 px-5 py-3 backdrop-blur">
      <div className="mx-auto flex w-full max-w-2xl items-center gap-3">
        <Link
          href={`/workout/${workoutId}`}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface text-xl font-bold text-muted"
          aria-label="Leave workout"
        >
          ×
        </Link>
        <div className="flex flex-1 gap-1">
          {exercises.map((e, i) => (
            <span
              key={e.id}
              className={`h-1.5 flex-1 rounded-full ${
                completed.has(e.id) ? 'bg-success' : i === index ? 'bg-brand' : 'bg-line'
              }`}
            />
          ))}
        </div>
        <span className="text-sm font-bold text-muted tabular-nums">
          {index + 1}/{total}
        </span>
      </div>
    </header>
  );
}

function WorkScreen({
  exercise,
  setNumber,
  onDone,
  onBack,
  onSkip,
}: {
  exercise: Exercise;
  setNumber: number;
  onDone: () => void;
  onBack?: () => void;
  onSkip: () => void;
}) {
  return (
    <>
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-5 pb-44">
        <MediaFrame
          mediaType={exercise.media_type}
          url={exercise.media_url}
          name={exercise.name}
          autoPlay
        />

        <h1 className="mt-5 text-3xl font-extrabold tracking-tight">{exercise.name}</h1>

        {exercise.sets > 1 && (
          <p className="mt-1 text-lg font-semibold text-brand">
            Set {setNumber} of {exercise.sets}
          </p>
        )}

        {exercise.mode === 'time' ? (
          <CountdownTimer
            key={`${exercise.id}-${setNumber}`}
            seconds={exercise.duration_seconds ?? 30}
            onComplete={onDone}
          />
        ) : (
          <p className="mt-4 text-6xl font-extrabold tracking-tight tabular-nums">
            {targetLabel(exercise)}
          </p>
        )}

        {exercise.instructions && (
          <div className="card mt-6 p-5">
            <p className="text-lg leading-relaxed whitespace-pre-line">{exercise.instructions}</p>
          </div>
        )}
      </main>

      <footer className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-cream/95 px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="btn-secondary w-14 shrink-0 px-0 text-2xl"
              aria-label="Previous exercise"
            >
              ‹
            </button>
          )}
          <button type="button" onClick={onDone} className="btn-primary flex-1">
            Done
          </button>
          <button type="button" onClick={onSkip} className="btn-secondary shrink-0 px-4 text-base">
            Skip
          </button>
        </div>
      </footer>
    </>
  );
}

function CountdownTimer({ seconds, onComplete }: { seconds: number; onComplete: () => void }) {
  const [remaining, setRemaining] = useState(seconds);
  const [running, setRunning] = useState(false);
  const fired = useRef(false);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (remaining > 0 || fired.current) return;
    fired.current = true;
    setRunning(false);
    beep();
    buzz(200);
    onComplete();
  }, [remaining, onComplete]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;

  return (
    <div className="mt-4">
      <p
        className={`text-7xl font-extrabold tracking-tight tabular-nums ${
          running ? 'text-brand' : 'text-ink'
        }`}
      >
        {mins > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : secs}
        {mins === 0 && <span className="ml-2 text-2xl font-bold text-muted">sec</span>}
      </p>
      <button
        type="button"
        onClick={() => setRunning((r) => !r)}
        className="btn-secondary mt-4 w-full"
      >
        {running ? 'Pause' : remaining === seconds ? 'Start timer' : 'Resume'}
      </button>
    </div>
  );
}

function RestScreen({
  seconds,
  nextLabel,
  onDone,
}: {
  seconds: number;
  nextLabel: string;
  onDone: () => void;
}) {
  const [remaining, setRemaining] = useState(seconds);
  const fired = useRef(false);

  useEffect(() => {
    const id = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (remaining > 0 || fired.current) return;
    fired.current = true;
    beep();
    buzz(200);
    onDone();
  }, [remaining, onDone]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-6 py-10 text-center">
      <p className="text-sm font-bold tracking-widest text-muted uppercase">Rest</p>
      <p className="mt-3 text-8xl font-extrabold tracking-tight text-brand tabular-nums">
        {remaining}
      </p>
      <p className="mt-6 text-lg text-muted">
        Next up
        <br />
        <span className="text-xl font-bold text-ink">{nextLabel}</span>
      </p>
      <button type="button" onClick={onDone} className="btn-secondary mt-10 w-full max-w-xs">
        Skip rest
      </button>
      <p className="mt-4 text-sm text-muted">Take longer if you need it — {formatDuration(seconds)} is just a guide.</p>
    </main>
  );
}

function FinishedScreen({
  workout,
  doneCount,
  total,
  onRepeat,
}: {
  workout: Workout;
  doneCount: number;
  total: number;
  onRepeat: () => void;
}) {
  const allDone = doneCount === total;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <div
        className={`flex h-24 w-24 items-center justify-center rounded-full text-5xl ${
          allDone ? 'bg-success-tint text-success' : 'bg-brand-tint text-brand'
        }`}
      >
        {allDone ? '✓' : '👏'}
      </div>

      <h1 className="mt-6 text-3xl font-extrabold tracking-tight">
        {allDone ? 'Workout complete' : 'Good effort'}
      </h1>

      <p className="mt-3 text-lg text-muted">
        {allDone ? (
          <>
            All {total} {total === 1 ? 'exercise' : 'exercises'} done. That&rsquo;s {workout.title}{' '}
            ticked off for the week.
          </>
        ) : (
          <>
            You finished {doneCount} of {total}. {workout.title} will stay part-done &mdash; pick it
            up whenever you like.
          </>
        )}
      </p>

      <Link href="/home" className="btn-primary mt-10 w-full">
        Back to this week
      </Link>
      <button type="button" onClick={onRepeat} className="btn-ghost mt-2 w-full text-base">
        {allDone ? 'Go through it again' : 'Do the rest now'}
      </button>
    </main>
  );
}

