'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { beepEnd, beepStart, buzz, unlockAudio } from '@/lib/beeper';
import { begin, finish, startedAt as readStartedAt, startedAtOnServer, subscribe } from '@/lib/workout-session';

interface WakeLock {
  release: () => Promise<void>;
  addEventListener: (type: 'release', listener: () => void) => void;
}

function elapsedLabel(startedAt: number, now: number): string {
  const total = Math.max(0, Math.round((now - startedAt) / 1000));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

/**
 * Start and end a workout.
 *
 * Two things hang off "in progress". The screen is held awake, because putting
 * a phone down between sets shouldn't mean unlocking it again with wet hands
 * every ninety seconds. And the session survives a reload — it lives in
 * sessionStorage, not React state — since a stray refresh mid-workout
 * shouldn't quietly stop the clock.
 *
 * Ticking exercises off works whether or not a session is running. Starting is
 * an offer, not a gate; nobody should be locked out of their own workout for
 * missing a button.
 */
export function WorkoutSession({ workoutId, title }: { workoutId: string; title: string }) {
  const snapshot = useCallback(() => readStartedAt(workoutId), [workoutId]);
  const startedAt = useSyncExternalStore(subscribe, snapshot, startedAtOnServer);

  const [now, setNow] = useState(() => Date.now());
  const [finished, setFinished] = useState<string | null>(null);
  const lock = useRef<WakeLock | null>(null);

  useEffect(() => {
    if (startedAt === null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  // The lock is dropped whenever the page is hidden, so it has to be retaken
  // when they come back — otherwise the screen sleeps after one glance away.
  useEffect(() => {
    if (startedAt === null) return;

    let cancelled = false;

    const request = async () => {
      try {
        const api = (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<WakeLock> } })
          .wakeLock;
        if (!api || document.visibilityState !== 'visible') return;
        const held = await api.request('screen');
        if (cancelled) {
          void held.release();
          return;
        }
        lock.current = held;
      } catch {
        // Denied, unsupported, or low power mode. The workout still works.
      }
    };

    void request();
    document.addEventListener('visibilitychange', request);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', request);
      void lock.current?.release().catch(() => {});
      lock.current = null;
    };
  }, [startedAt]);

  function start() {
    // Inside the tap: the only moment iOS will open audio for the timers.
    unlockAudio();
    beepStart();
    buzz(60);

    const at = Date.now();
    setNow(at);
    setFinished(null);
    begin(workoutId, at);
  }

  function end() {
    if (startedAt !== null) setFinished(elapsedLabel(startedAt, Date.now()));
    beepEnd();
    buzz([120, 80, 200]);
    finish(workoutId);
  }

  if (startedAt === null) {
    return (
      <div className="mt-5">
        {finished && (
          <p className="mb-3 rounded-xl2 border-2 border-success/40 bg-success-tint/40 px-4 py-3 text-base font-semibold">
            Finished in {finished}. Well done.
          </p>
        )}
        <button type="button" onClick={start} className="btn-primary w-full">
          Start workout
        </button>
        <p className="mt-2 text-center text-sm text-muted">
          Keeps the screen on and the sounds ready. You don&rsquo;t have to &mdash; the workout
          works without it.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Reserves the space the fixed bar covers, so the last exercise isn't
          hidden underneath it. */}
      <div className="h-20" aria-hidden />

      <div className="fixed inset-x-0 bottom-16 z-30 mx-auto w-full max-w-2xl px-4 pb-2">
        <div className="flex items-center gap-3 rounded-xl2 border-2 border-brand bg-canvas/95 px-4 py-3 shadow-2xl backdrop-blur-xl">
          <span className="flex h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-brand" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-muted">{title}</p>
            <p className="text-2xl leading-tight font-extrabold tabular-nums">
              {elapsedLabel(startedAt, now)}
            </p>
          </div>
          <button
            type="button"
            onClick={end}
            className="shrink-0 rounded-xl2 bg-brand px-5 py-3 text-base font-bold text-canvas"
          >
            End
          </button>
        </div>
      </div>
    </>
  );
}
