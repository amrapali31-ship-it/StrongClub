import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import type {
  Database,
  Exercise,
  ExerciseCompletion,
  LibraryExercise,
  Profile,
  Week,
  Workout,
} from '@/lib/types';

interface Shape {
  profiles: Profile[];
  weeks: Week[];
  workouts: Workout[];
  exercises: Exercise[];
  library: LibraryExercise[];
  completions: ExerciseCompletion[];
}

const EMPTY: Shape = {
  profiles: [],
  weeks: [],
  workouts: [],
  exercises: [],
  library: [],
  completions: [],
};

const FILE = path.join(process.cwd(), '.data', 'db.json');

/**
 * Serialises reads and writes so two overlapping requests can't clobber the
 * file. Every operation appends itself to this chain.
 */
let queue: Promise<unknown> = Promise.resolve();

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
}

async function readAll(): Promise<Shape> {
  try {
    const raw = await fs.readFile(FILE, 'utf8');
    return { ...EMPTY, ...(JSON.parse(raw) as Partial<Shape>) };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return { ...EMPTY };
    throw err;
  }
}

async function writeAll(data: Shape): Promise<void> {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(data, null, 2), 'utf8');
}

/** Read, mutate, write — all under the lock. */
function mutate<T>(fn: (data: Shape) => T | Promise<T>): Promise<T> {
  return withLock(async () => {
    const data = await readAll();
    const result = await fn(data);
    await writeAll(data);
    return result;
  });
}

function query<T>(fn: (data: Shape) => T): Promise<T> {
  return withLock(async () => fn(await readAll()));
}

const byPosition = (a: { position: number }, b: { position: number }) => a.position - b.position;

function nextPosition(items: { position: number }[]): number {
  return items.reduce((max, item) => Math.max(max, item.position), -1) + 1;
}

function must<T>(item: T | undefined, what: string): T {
  if (!item) throw new Error(`${what} not found`);
  return item;
}

export const localDb: Database = {
  async listProfiles() {
    return query((d) => [...d.profiles].sort(byPosition));
  },

  async getProfile(id) {
    return query((d) => d.profiles.find((p) => p.id === id) ?? null);
  },

  async createProfile(data) {
    return mutate((d) => {
      const profile: Profile = {
        id: randomUUID(),
        name: data.name,
        color: data.color,
        position: nextPosition(d.profiles),
        created_at: new Date().toISOString(),
      };
      d.profiles.push(profile);
      return profile;
    });
  },

  async updateProfile(id, patch) {
    return mutate((d) => {
      const profile = must(
        d.profiles.find((p) => p.id === id),
        'Profile',
      );
      Object.assign(profile, patch, { id: profile.id });
      return profile;
    });
  },

  async deleteProfile(id) {
    await mutate((d) => {
      d.profiles = d.profiles.filter((p) => p.id !== id);
      d.completions = d.completions.filter((c) => c.profile_id !== id);
    });
  },

  async listWeeks(opts) {
    return query((d) => {
      const weeks = opts?.publishedOnly ? d.weeks.filter((w) => w.published) : d.weeks;
      return [...weeks].sort(compareWeeks);
    });
  },

  async getWeek(id) {
    return query((d) => d.weeks.find((w) => w.id === id) ?? null);
  },

  async createWeek(data) {
    return mutate((d) => {
      const week: Week = {
        id: randomUUID(),
        title: data.title,
        start_date: data.start_date ?? null,
        note: data.note ?? '',
        published: data.published ?? false,
        created_at: new Date().toISOString(),
      };
      d.weeks.push(week);
      return week;
    });
  },

  async updateWeek(id, patch) {
    return mutate((d) => {
      const week = must(
        d.weeks.find((w) => w.id === id),
        'Week',
      );
      Object.assign(week, patch, { id: week.id });
      return week;
    });
  },

  async deleteWeek(id) {
    await mutate((d) => {
      const workoutIds = d.workouts.filter((w) => w.week_id === id).map((w) => w.id);
      d.weeks = d.weeks.filter((w) => w.id !== id);
      d.workouts = d.workouts.filter((w) => w.week_id !== id);
      d.exercises = d.exercises.filter((e) => !workoutIds.includes(e.workout_id));
      d.completions = d.completions.filter((c) => c.week_id !== id);
    });
  },

  async listWorkouts(weekId) {
    return query((d) => d.workouts.filter((w) => w.week_id === weekId).sort(byPosition));
  },

  async getWorkout(id) {
    return query((d) => d.workouts.find((w) => w.id === id) ?? null);
  },

  async createWorkout(data) {
    return mutate((d) => {
      const siblings = d.workouts.filter((w) => w.week_id === data.week_id);
      const workout: Workout = {
        id: randomUUID(),
        week_id: data.week_id,
        title: data.title,
        subtitle: data.subtitle ?? '',
        position: data.position ?? nextPosition(siblings),
        created_at: new Date().toISOString(),
      };
      d.workouts.push(workout);
      return workout;
    });
  },

  async updateWorkout(id, patch) {
    return mutate((d) => {
      const workout = must(
        d.workouts.find((w) => w.id === id),
        'Workout',
      );
      Object.assign(workout, patch, { id: workout.id });
      return workout;
    });
  },

  async deleteWorkout(id) {
    await mutate((d) => {
      d.workouts = d.workouts.filter((w) => w.id !== id);
      d.exercises = d.exercises.filter((e) => e.workout_id !== id);
      d.completions = d.completions.filter((c) => c.workout_id !== id);
    });
  },

  async listExercises(workoutId) {
    return query((d) => d.exercises.filter((e) => e.workout_id === workoutId).sort(byPosition));
  },

  async getExercise(id) {
    return query((d) => d.exercises.find((e) => e.id === id) ?? null);
  },

  async createExercise(data) {
    return mutate((d) => {
      const siblings = d.exercises.filter((e) => e.workout_id === data.workout_id);
      const exercise: Exercise = {
        id: randomUUID(),
        workout_id: data.workout_id,
        name: data.name,
        instructions: data.instructions ?? '',
        mode: data.mode ?? 'reps',
        sets: data.sets ?? 1,
        reps: data.reps ?? null,
        duration_seconds: data.duration_seconds ?? null,
        rest_seconds: data.rest_seconds ?? 30,
        media_type: data.media_type ?? 'none',
        media_url: data.media_url ?? '',
        position: data.position ?? nextPosition(siblings),
        created_at: new Date().toISOString(),
      };
      d.exercises.push(exercise);
      return exercise;
    });
  },

  async updateExercise(id, patch) {
    return mutate((d) => {
      const exercise = must(
        d.exercises.find((e) => e.id === id),
        'Exercise',
      );
      Object.assign(exercise, patch, { id: exercise.id });
      return exercise;
    });
  },

  async deleteExercise(id) {
    await mutate((d) => {
      d.exercises = d.exercises.filter((e) => e.id !== id);
      d.completions = d.completions.filter((c) => c.exercise_id !== id);
    });
  },

  async listLibrary() {
    return query((d) => [...d.library].sort((a, b) => a.name.localeCompare(b.name)));
  },

  async getLibraryExercise(id) {
    return query((d) => d.library.find((e) => e.id === id) ?? null);
  },

  async createLibraryExercise(data) {
    return mutate((d) => {
      const entry: LibraryExercise = {
        id: randomUUID(),
        name: data.name,
        category: data.category,
        instructions: data.instructions ?? '',
        mode: data.mode ?? 'reps',
        sets: data.sets ?? 2,
        reps: data.reps ?? 10,
        duration_seconds: data.duration_seconds ?? null,
        rest_seconds: data.rest_seconds ?? 30,
        media_type: data.media_type ?? 'none',
        media_url: data.media_url ?? '',
        created_at: new Date().toISOString(),
      };
      d.library.push(entry);
      return entry;
    });
  },

  async updateLibraryExercise(id, patch) {
    return mutate((d) => {
      const entry = must(
        d.library.find((e) => e.id === id),
        'Library exercise',
      );
      Object.assign(entry, patch, { id: entry.id });
      return entry;
    });
  },

  async deleteLibraryExercise(id) {
    await mutate((d) => {
      d.library = d.library.filter((e) => e.id !== id);
    });
  },

  async listCompletions(filter) {
    return query((d) =>
      d.completions.filter(
        (c) =>
          (!filter?.profileId || c.profile_id === filter.profileId) &&
          (!filter?.weekId || c.week_id === filter.weekId) &&
          (!filter?.workoutId || c.workout_id === filter.workoutId),
      ),
    );
  },

  async setExerciseDone(profileId, exerciseId, done) {
    await mutate((d) => {
      const existing = d.completions.find(
        (c) => c.profile_id === profileId && c.exercise_id === exerciseId,
      );
      if (!done) {
        d.completions = d.completions.filter((c) => c !== existing);
        return;
      }
      if (existing) return;

      const exercise = must(
        d.exercises.find((e) => e.id === exerciseId),
        'Exercise',
      );
      const workout = must(
        d.workouts.find((w) => w.id === exercise.workout_id),
        'Workout',
      );
      d.completions.push({
        id: randomUUID(),
        profile_id: profileId,
        exercise_id: exerciseId,
        workout_id: workout.id,
        week_id: workout.week_id,
        completed_at: new Date().toISOString(),
      });
    });
  },

  async resetWorkout(profileId, workoutId) {
    await mutate((d) => {
      d.completions = d.completions.filter(
        (c) => !(c.profile_id === profileId && c.workout_id === workoutId),
      );
    });
  },
};

/** Newest plan first: by start date when set, otherwise by creation time. */
function compareWeeks(a: Week, b: Week): number {
  const aKey = a.start_date ?? a.created_at.slice(0, 10);
  const bKey = b.start_date ?? b.created_at.slice(0, 10);
  if (aKey !== bKey) return bKey.localeCompare(aKey);
  return b.created_at.localeCompare(a.created_at);
}
