/**
 * Short tones for the countdown.
 *
 * One audio context, opened on the tap that starts a timer and kept alive
 * afterwards. iOS only lets audio begin from a user gesture, so a context
 * created when the clock reaches zero is created too late and stays silent —
 * which is why the end beep never sounded on a phone.
 */

let context: AudioContext | null = null;

function ensureContext(): AudioContext | null {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;

    context ??= new Ctx();
    // Backgrounding the app suspends it; a tap is the moment we're allowed to
    // ask for it back.
    if (context.state === 'suspended') void context.resume();
    return context;
  } catch {
    return null;
  }
}

/** Call from inside a tap handler, before anything needs to make a sound. */
export function unlockAudio(): void {
  ensureContext();
}

function tone(frequency: number, startAt: number, seconds: number, volume: number): void {
  const ctx = ensureContext();
  if (!ctx) return;

  const at = ctx.currentTime + startAt;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.connect(gain);
  gain.connect(ctx.destination);

  oscillator.frequency.value = frequency;
  // Ramped rather than switched, so it reads as a chime and not a click.
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(volume, at + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + seconds);

  oscillator.start(at);
  oscillator.stop(at + seconds + 0.05);
}

/** One low note: the hold has begun. */
export function beepStart(): void {
  tone(520, 0, 0.18, 0.25);
}

/** Two rising notes: time is up, and audibly different from the start. */
export function beepEnd(): void {
  tone(660, 0, 0.18, 0.3);
  tone(880, 0.22, 0.35, 0.3);
}

/** A tick for the last few seconds, quiet enough not to startle. */
export function beepTick(): void {
  tone(440, 0, 0.07, 0.12);
}

export function buzz(pattern: number | number[]): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Not supported on iOS Safari — the tones carry it there.
  }
}
