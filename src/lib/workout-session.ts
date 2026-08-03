/**
 * Whether a workout is in progress, and since when.
 *
 * Kept in sessionStorage rather than React state so a stray reload mid-workout
 * doesn't stop the clock, and exposed as a subscribable store so the component
 * can read it with `useSyncExternalStore` — which is what sessionStorage is: an
 * external system that React doesn't own.
 */

const listeners = new Set<() => void>();

const key = (workoutId: string) => `sc_session_${workoutId}`;

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Another tab ending the same workout should settle this one too.
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

export function startedAt(workoutId: string): number | null {
  try {
    const saved = window.sessionStorage.getItem(key(workoutId));
    if (!saved) return null;
    const parsed = Number(saved);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    // Private browsing can refuse storage; the session just won't survive a
    // reload, which is a smaller loss than the page failing to render.
    return null;
  }
}

/** Nothing is running during a server render. */
export function startedAtOnServer(): null {
  return null;
}

export function begin(workoutId: string, at: number): void {
  try {
    window.sessionStorage.setItem(key(workoutId), String(at));
  } catch {
    // As above — carry on without persistence.
  }
  for (const listener of listeners) listener();
}

export function finish(workoutId: string): void {
  try {
    window.sessionStorage.removeItem(key(workoutId));
  } catch {
    // As above.
  }
  for (const listener of listeners) listener();
}
