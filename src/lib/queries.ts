import { db } from '@/lib/db';
import { groupExercises, type ExerciseGroup } from '@/lib/ordering';

// Re-exported so callers keep importing grouping from one place.
export { groupExercises };
export type { ExerciseGroup };
import type { Exercise, Week, Workout } from '@/lib/types';

export interface WorkoutProgress {
  workout: Workout;
  exercises: Exercise[];
  doneExerciseIds: Set<string>;
  /** 0–1. */
  fraction: number;
  status: 'not-started' | 'in-progress' | 'done';
  /** Rough guess so the card can say "about 20 min". */
  estimatedMinutes: number;
}

/** The week parents see by default: the most recent published one. */
export async function getCurrentWeek(): Promise<Week | null> {
  const weeks = await db.listWeeks({ publishedOnly: true });
  return weeks[0] ?? null;
}

/**
 * Headings only earn their space when there's more than one section — a "Legs"
 * header above a workout that is entirely legs is just noise.
 */
export function shouldShowGroupHeadings(groups: ExerciseGroup[]): boolean {
  return groups.length > 1;
}

/** Monday of the week containing `date`, as yyyy-mm-dd. */
export function mondayOf(date: Date): string {
  const copy = new Date(date);
  copy.setDate(copy.getDate() - ((copy.getDay() + 6) % 7));
  return copy.toISOString().slice(0, 10);
}

/**
 * "This week" / "Last week" / "Next week" — which is how anyone actually
 * thinks about it. Anything further out falls back to a date, because
 * "3 weeks ago" is harder to place than "Week of 6 July".
 */
export function relativeWeekLabel(startDate: string | null, today = new Date()): string {
  if (!startDate) return '';

  const current = new Date(`${mondayOf(today)}T00:00:00`);
  const start = new Date(`${startDate}T00:00:00`);
  if (Number.isNaN(start.getTime())) return '';

  const weeksApart = Math.round((start.getTime() - current.getTime()) / (7 * 24 * 60 * 60 * 1000));

  if (weeksApart === 0) return 'This week';
  if (weeksApart === -1) return 'Last week';
  if (weeksApart === 1) return 'Next week';

  return `Week of ${new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
  }).format(start)}`;
}

export interface WeekNeighbours {
  current: Week | null;
  previous: Week | null;
  next: Week | null;
}

/**
 * The week to show plus what sits either side of it, oldest to newest, so the
 * parent screens can offer plain back/forward navigation.
 */
export async function getWeekNeighbours(weekId?: string): Promise<WeekNeighbours> {
  const weeks = (await db.listWeeks({ publishedOnly: true }))
    .slice()
    .sort((a, b) => (a.start_date ?? '').localeCompare(b.start_date ?? ''));

  if (weeks.length === 0) return { current: null, previous: null, next: null };

  const monday = mondayOf(new Date());
  let index = weekId ? weeks.findIndex((w) => w.id === weekId) : -1;

  if (index === -1) {
    // Prefer the week we're actually in; otherwise the most recent one that
    // has already started, so a gap in publishing doesn't show a blank screen.
    index = weeks.findIndex((w) => w.start_date === monday);
    if (index === -1) {
      const started = weeks.filter((w) => (w.start_date ?? '') <= monday);
      index = started.length ? weeks.indexOf(started[started.length - 1]) : 0;
    }
  }

  return {
    current: weeks[index],
    previous: weeks[index - 1] ?? null,
    next: weeks[index + 1] ?? null,
  };
}

/**
 * Works out the name and date for the next week so you never have to type
 * either. Slots in after your latest week; falls back to this Monday when
 * there's nothing to follow on from.
 */
export async function nextWeekSlot(): Promise<{ title: string; start_date: string }> {
  const weeks = await db.listWeeks();

  const latest = weeks
    .map((w) => w.start_date)
    .filter((d): d is string => Boolean(d))
    .sort()
    .at(-1);

  let start: string;
  if (latest) {
    const next = new Date(`${latest}T00:00:00`);
    next.setDate(next.getDate() + 7);
    start = next.toISOString().slice(0, 10);
  } else {
    start = mondayOf(new Date());
  }

  return { title: `Week ${weeks.length + 1}`, start_date: start };
}

/**
 * Roughly how long a workout takes.
 *
 * In a repeating section the rounds *are* the sets — an exercise is done once
 * per round — so the round count replaces the exercise's own set count rather
 * than multiplying with it. Otherwise a three-round pair of two-set exercises
 * would be quoted at six sets each, which nobody means by a superset.
 */
export function estimateMinutes(
  exercises: Exercise[],
  rounds: Record<string, number> = {},
): number {
  const seconds = exercises.reduce((total, e) => {
    const work = e.mode === 'time' ? (e.duration_seconds ?? 30) : (e.reps ?? 10) * 4;
    const repeats = rounds[e.category ?? ''] ?? 1;
    const times = repeats > 1 ? repeats : e.sets;
    return total + times * (work + e.rest_seconds);
  }, 0);
  return Math.max(1, Math.round(seconds / 60));
}

/** Every workout in a week, with one profile's progress folded in. */
export async function getWeekBoard(weekId: string, profileId?: string): Promise<WorkoutProgress[]> {
  const workouts = await db.listWorkouts(weekId);
  const completions = profileId ? await db.listCompletions({ profileId, weekId }) : [];

  return Promise.all(
    workouts.map(async (workout) => {
      const exercises = await db.listExercises(workout.id);
      const doneExerciseIds = new Set(
        completions.filter((c) => c.workout_id === workout.id).map((c) => c.exercise_id),
      );
      // Only count exercises that still exist, so deleting one can't leave a
      // workout stuck above 100%.
      const doneCount = exercises.filter((e) => doneExerciseIds.has(e.id)).length;
      const fraction = exercises.length ? doneCount / exercises.length : 0;

      return {
        workout,
        exercises,
        doneExerciseIds,
        fraction,
        status: fraction === 0 ? 'not-started' : fraction < 1 ? 'in-progress' : 'done',
        estimatedMinutes: estimateMinutes(exercises, workout.section_rounds ?? {}),
      } satisfies WorkoutProgress;
    }),
  );
}

export async function getWorkoutProgress(
  workoutId: string,
  profileId?: string,
): Promise<WorkoutProgress | null> {
  const workout = await db.getWorkout(workoutId);
  if (!workout) return null;

  const exercises = await db.listExercises(workoutId);
  const completions = profileId ? await db.listCompletions({ profileId, workoutId }) : [];
  const doneExerciseIds = new Set(completions.map((c) => c.exercise_id));
  const doneCount = exercises.filter((e) => doneExerciseIds.has(e.id)).length;
  const fraction = exercises.length ? doneCount / exercises.length : 0;

  return {
    workout,
    exercises,
    doneExerciseIds,
    fraction,
    status: fraction === 0 ? 'not-started' : fraction < 1 ? 'in-progress' : 'done',
    estimatedMinutes: estimateMinutes(exercises, workout.section_rounds ?? {}),
  };
}
