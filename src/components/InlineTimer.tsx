'use client';

import { useEffect, useRef, useState } from 'react';

import { beepEnd, beepStart, beepTick, buzz, unlockAudio } from '@/lib/beeper';

/**
 * Optional countdown for timed holds. Nothing depends on it — the target is
 * printed above, so anyone who'd rather use the clock on the wall can.
 *
 * It sounds at both ends: once when it starts, so you can look away and begin,
 * and twice when it finishes, so you know to stop without checking the screen.
 */
export function InlineTimer({ seconds }: { seconds: number }) {
  const [remaining, setRemaining] = useState(seconds);
  const [running, setRunning] = useState(false);
  const fired = useRef(false);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(id);
  }, [running]);

  // The last three seconds tick, so the end never arrives unannounced.
  useEffect(() => {
    if (!running || remaining === 0 || remaining > 3) return;
    beepTick();
  }, [remaining, running]);

  useEffect(() => {
    if (remaining > 0 || fired.current) return;
    fired.current = true;
    setRunning(false);
    beepEnd();
    buzz([120, 80, 200]);
  }, [remaining]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const finished = remaining === 0;
  const label = mins > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : `${secs}`;

  function start() {
    // Inside the tap, which is the only moment iOS will open audio for us.
    unlockAudio();
    beepStart();
    buzz(60);
    setRunning(true);
  }

  return (
    <div className="mt-3 flex items-center gap-3">
      <span
        className={`text-3xl font-extrabold tabular-nums ${
          finished ? 'text-success' : running ? 'text-brand' : 'text-muted'
        }`}
      >
        {finished ? 'Done' : label}
      </span>

      <button
        type="button"
        onClick={() => {
          if (finished) {
            fired.current = false;
            setRemaining(seconds);
            start();
            return;
          }
          if (running) {
            setRunning(false);
            return;
          }
          start();
        }}
        className="btn-secondary min-h-12 px-5 text-base"
      >
        {finished ? 'Again' : running ? 'Pause' : remaining === seconds ? 'Start timer' : 'Resume'}
      </button>
    </div>
  );
}
