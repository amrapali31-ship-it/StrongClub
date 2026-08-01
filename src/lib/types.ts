export type MediaType = 'none' | 'youtube' | 'video' | 'image';
export type ExerciseMode = 'reps' | 'time';

export interface Profile {
  id: string;
  name: string;
  color: string;
  /** Uploaded photo. Falls back to the coloured initial when empty. */
  photo_url: string;
  position: number;
  created_at: string;
}

export interface Week {
  id: string;
  title: string;
  /** yyyy-mm-dd, the Monday this week's plan starts. */
  start_date: string | null;
  note: string;
  published: boolean;
  created_at: string;
}

export interface Workout {
  id: string;
  week_id: string;
  title: string;
  /** One or two characters shown beside the title. Empty for none. */
  emoji: string;
  /**
   * Sections the coach created explicitly, so one can exist before anything is
   * in it. Sections also arise implicitly from an exercise's category — this
   * list is only what would otherwise be invisible.
   */
  sections: string[];
  subtitle: string;
  position: number;
  created_at: string;
}

export interface Exercise {
  id: string;
  workout_id: string;
  name: string;
  /**
   * Copied from the library entry this came from. Drives the sub-sections on
   * the workout page. Empty for one-offs typed straight in.
   */
  category: string;
  instructions: string;
  mode: ExerciseMode;
  sets: number;
  /** Set when mode is 'reps'. */
  reps: number | null;
  /** Set when mode is 'time'. */
  duration_seconds: number | null;
  rest_seconds: number;
  media_type: MediaType;
  media_url: string;
  position: number;
  created_at: string;
}

/**
 * Suggested section names, offered in the pickers. Sections are free text —
 * type anything you like — so this is a starting point, not a closed set.
 */
export const EXERCISE_CATEGORIES = [
  'Warm-up',
  'Legs',
  'Upper body',
  'Core',
  'Balance',
  'Mobility',
  'Cardio',
  'Cool-down',
] as const;

export type ExerciseCategory = (typeof EXERCISE_CATEGORIES)[number];

/**
 * A reusable movement. Workouts copy from these rather than referencing them,
 * so editing a library entry never rewrites a week your parents already did —
 * but new workouts inherit its defaults and, importantly, its video.
 */
export interface LibraryExercise {
  id: string;
  name: string;
  category: string;
  instructions: string;
  mode: ExerciseMode;
  sets: number;
  reps: number | null;
  duration_seconds: number | null;
  rest_seconds: number;
  media_type: MediaType;
  media_url: string;
  created_at: string;
}

export interface ExerciseCompletion {
  id: string;
  profile_id: string;
  exercise_id: string;
  workout_id: string;
  week_id: string;
  completed_at: string;
}

/** A workout with its exercises, as the workout screens need it. */
export interface WorkoutWithExercises extends Workout {
  exercises: Exercise[];
}

export interface CompletionFilter {
  profileId?: string;
  weekId?: string;
  workoutId?: string;
}

export interface Database {
  listProfiles(): Promise<Profile[]>;
  getProfile(id: string): Promise<Profile | null>;
  createProfile(data: Pick<Profile, 'name' | 'color'>): Promise<Profile>;
  updateProfile(id: string, patch: Partial<Profile>): Promise<Profile>;
  deleteProfile(id: string): Promise<void>;

  listWeeks(opts?: { publishedOnly?: boolean }): Promise<Week[]>;
  getWeek(id: string): Promise<Week | null>;
  createWeek(data: Partial<Week> & { title: string }): Promise<Week>;
  updateWeek(id: string, patch: Partial<Week>): Promise<Week>;
  deleteWeek(id: string): Promise<void>;

  listWorkouts(weekId: string): Promise<Workout[]>;
  getWorkout(id: string): Promise<Workout | null>;
  createWorkout(data: Partial<Workout> & { week_id: string; title: string }): Promise<Workout>;
  updateWorkout(id: string, patch: Partial<Workout>): Promise<Workout>;
  deleteWorkout(id: string): Promise<void>;

  listExercises(workoutId: string): Promise<Exercise[]>;
  getExercise(id: string): Promise<Exercise | null>;
  createExercise(data: Partial<Exercise> & { workout_id: string; name: string }): Promise<Exercise>;
  updateExercise(id: string, patch: Partial<Exercise>): Promise<Exercise>;
  deleteExercise(id: string): Promise<void>;

  listLibrary(): Promise<LibraryExercise[]>;
  getLibraryExercise(id: string): Promise<LibraryExercise | null>;
  createLibraryExercise(
    data: Partial<LibraryExercise> & { name: string; category: string },
  ): Promise<LibraryExercise>;
  updateLibraryExercise(id: string, patch: Partial<LibraryExercise>): Promise<LibraryExercise>;
  deleteLibraryExercise(id: string): Promise<void>;

  listCompletions(filter?: CompletionFilter): Promise<ExerciseCompletion[]>;
  setExerciseDone(profileId: string, exerciseId: string, done: boolean): Promise<void>;
  resetWorkout(profileId: string, workoutId: string): Promise<void>;
}
