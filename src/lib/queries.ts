import { db } from '@/lib/db';
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

/** Monday of the week containing `date`, as yyyy-mm-dd. */
function mondayOf(date: Date): string {
  const copy = new Date(date);
  copy.setDate(copy.getDate() - ((copy.getDay() + 6) % 7));
  return copy.toISOString().slice(0, 10);
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

export function estimateMinutes(exercises: Exercise[]): number {
  const seconds = exercises.reduce((total, e) => {
    const work = e.mode === 'time' ? (e.duration_seconds ?? 30) : (e.reps ?? 10) * 4;
    return total + e.sets * (work + e.rest_seconds);
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
        estimatedMinutes: estimateMinutes(exercises),
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
    estimatedMinutes: estimateMinutes(exercises),
  };
}
