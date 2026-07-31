'use client';

import { useEffect, useRef, useState } from 'react';

/** Short chime so you can look away from the screen during a hold. */
function beep() {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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
    // Audio is a nicety; never let it break the page.
  }
}

/**
 * Optional countdown for timed holds. Nothing depends on it — the target is
 * printed above, so anyone who'd rather use the clock on the wall can.
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

  useEffect(() => {
    if (remaining > 0 || fired.current) return;
    fired.current = true;
    setRunning(false);
    beep();
    try {
      navigator.vibrate?.(200);
    } catch {
      // Not supported on iOS Safari — fine.
    }
  }, [remaining]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const finished = remaining === 0;
  const label = mins > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : `${secs}`;

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
            setRunning(true);
            return;
          }
          setRunning((r) => !r);
        }}
        className="btn-secondary min-h-12 px-5 text-base"
      >
        {finished ? 'Again' : running ? 'Pause' : remaining === seconds ? 'Start timer' : 'Resume'}
      </button>
    </div>
  );
}
