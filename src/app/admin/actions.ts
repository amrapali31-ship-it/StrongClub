'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { checkPasscode, isAdmin, signInAdmin, signOutAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import type { DraftWeek } from '@/lib/importer';
import { detectMediaType } from '@/lib/media';
import { EXERCISE_CATEGORIES, type ExerciseMode, type MediaType } from '@/lib/types';

async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect('/admin');
}

function str(formData: FormData, key: string, fallback = ''): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : fallback;
}

function num(formData: FormData, key: string, fallback: number): number {
  const parsed = Number(formData.get(key));
  return Number.isFinite(parsed) ? parsed : fallback;
}

/* ---------------------------------------------------------------- session */

export async function login(_prev: string | null, formData: FormData): Promise<string | null> {
  if (!checkPasscode(str(formData, 'passcode'))) return 'That passcode is not right.';
  await signInAdmin();
  redirect('/admin');
}

export async function logout(): Promise<void> {
  await signOutAdmin();
  redirect('/');
}

/* --------------------------------------------------------------- profiles */

const PROFILE_COLORS = ['#d6552b', '#2e7d53', '#3b6ea5', '#7a4fa3', '#b8860b'];

export async function addProfile(formData: FormData): Promise<void> {
  await requireAdmin();
  const name = str(formData, 'name');
  if (!name) return;

  const existing = await db.listProfiles();
  await db.createProfile({
    name,
    color: PROFILE_COLORS[existing.length % PROFILE_COLORS.length],
  });
  revalidatePath('/admin');
}

export async function removeProfile(formData: FormData): Promise<void> {
  await requireAdmin();
  await db.deleteProfile(str(formData, 'profileId'));
  revalidatePath('/admin');
}

/* ------------------------------------------------------------------ weeks */

export async function addWeek(formData: FormData): Promise<void> {
  await requireAdmin();
  const week = await db.createWeek({
    title: str(formData, 'title') || 'New week',
    start_date: str(formData, 'start_date') || null,
    note: str(formData, 'note'),
    published: false,
  });
  redirect(`/admin/week/${week.id}`);
}

export async function saveWeek(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = str(formData, 'weekId');

  await db.updateWeek(id, {
    title: str(formData, 'title') || 'Untitled week',
    start_date: str(formData, 'start_date') || null,
    note: str(formData, 'note'),
    published: formData.get('published') === 'on',
  });

  revalidatePath('/admin');
  revalidatePath(`/admin/week/${id}`);
  revalidatePath('/home');
}

export async function removeWeek(formData: FormData): Promise<void> {
  await requireAdmin();
  await db.deleteWeek(str(formData, 'weekId'));
  revalidatePath('/admin');
  redirect('/admin');
}

/** Copies a whole week — workouts, exercises and media — as a fresh draft. */
export async function duplicateWeek(formData: FormData): Promise<void> {
  await requireAdmin();
  const sourceId = str(formData, 'weekId');
  const source = await db.getWeek(sourceId);
  if (!source) return;

  const copy = await db.createWeek({
    title: `${source.title} (copy)`,
    start_date: null,
    note: source.note,
    published: false,
  });

  for (const workout of await db.listWorkouts(sourceId)) {
    const newWorkout = await db.createWorkout({
      week_id: copy.id,
      title: workout.title,
      subtitle: workout.subtitle,
      position: workout.position,
    });

    for (const exercise of await db.listExercises(workout.id)) {
      await db.createExercise({ ...exercise, workout_id: newWorkout.id });
    }
  }

  redirect(`/admin/week/${copy.id}`);
}

/**
 * Turns a reviewed AI draft into a real week. Always saved unpublished — the
 * coach still has to tick "Visible to your parents" before anyone sees it.
 */
export async function saveImportedWeek(formData: FormData): Promise<void> {
  await requireAdmin();

  let draft: DraftWeek;
  try {
    draft = JSON.parse(str(formData, 'draft')) as DraftWeek;
  } catch {
    redirect('/admin/import');
  }

  const week = await db.createWeek({
    title: str(formData, 'title') || draft.title || 'Imported week',
    start_date: str(formData, 'start_date') || null,
    note: draft.note ?? '',
    published: false,
  });

  for (const [workoutIndex, draftWorkout] of draft.workouts.entries()) {
    const workout = await db.createWorkout({
      week_id: week.id,
      title: draftWorkout.title || `Workout ${workoutIndex + 1}`,
      subtitle: draftWorkout.subtitle ?? '',
      position: workoutIndex,
    });

    for (const [exerciseIndex, draftExercise] of draftWorkout.exercises.entries()) {
      const mode: ExerciseMode = draftExercise.mode === 'time' ? 'time' : 'reps';
      await db.createExercise({
        workout_id: workout.id,
        name: draftExercise.name || 'Untitled exercise',
        instructions: draftExercise.instructions ?? '',
        mode,
        sets: Math.max(1, Math.round(draftExercise.sets || 1)),
        reps: mode === 'reps' ? Math.max(1, Math.round(draftExercise.reps ?? 10)) : null,
        duration_seconds:
          mode === 'time' ? Math.max(1, Math.round(draftExercise.duration_seconds ?? 30)) : null,
        rest_seconds: Math.max(0, Math.round(draftExercise.rest_seconds ?? 30)),
        // Media is never imported — models invent plausible-looking video links.
        media_type: 'none',
        media_url: '',
        position: exerciseIndex,
      });
    }
  }

  revalidatePath('/admin');
  redirect(`/admin/week/${week.id}`);
}

/* --------------------------------------------------------------- workouts */

export async function addWorkout(formData: FormData): Promise<void> {
  await requireAdmin();
  const weekId = str(formData, 'weekId');
  const workout = await db.createWorkout({
    week_id: weekId,
    title: str(formData, 'title') || 'New workout',
    subtitle: '',
  });
  redirect(`/admin/workout/${workout.id}`);
}

export async function saveWorkout(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = str(formData, 'workoutId');

  const workout = await db.updateWorkout(id, {
    title: str(formData, 'title') || 'Untitled workout',
    subtitle: str(formData, 'subtitle'),
  });

  revalidatePath(`/admin/workout/${id}`);
  revalidatePath(`/admin/week/${workout.week_id}`);
  revalidatePath('/home');
}

export async function removeWorkout(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = str(formData, 'workoutId');
  const workout = await db.getWorkout(id);
  await db.deleteWorkout(id);

  if (workout) {
    revalidatePath(`/admin/week/${workout.week_id}`);
    redirect(`/admin/week/${workout.week_id}`);
  }
  redirect('/admin');
}

export async function moveWorkout(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = str(formData, 'workoutId');
  const direction = str(formData, 'direction') === 'up' ? -1 : 1;

  const workout = await db.getWorkout(id);
  if (!workout) return;

  const siblings = await db.listWorkouts(workout.week_id);
  const index = siblings.findIndex((w) => w.id === id);
  const swapWith = siblings[index + direction];
  if (!swapWith) return;

  await db.updateWorkout(workout.id, { position: swapWith.position });
  await db.updateWorkout(swapWith.id, { position: workout.position });

  revalidatePath(`/admin/week/${workout.week_id}`);
  revalidatePath('/home');
}

/* ---------------------------------------------------------------- library */

export async function addLibraryExercise(formData: FormData): Promise<void> {
  await requireAdmin();
  const name = str(formData, 'name');
  if (!name) redirect('/admin/library');

  const entry = await db.createLibraryExercise({
    name,
    category: str(formData, 'category') || EXERCISE_CATEGORIES[0],
  });
  redirect(`/admin/library/${entry.id}`);
}

export async function saveLibraryExercise(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = str(formData, 'libraryId');
  const mode = (str(formData, 'mode') === 'time' ? 'time' : 'reps') as ExerciseMode;

  const mediaUrl = str(formData, 'media_url');
  const declaredType = str(formData, 'media_type') as MediaType;
  const mediaType: MediaType = mediaUrl
    ? declaredType === 'video' || declaredType === 'image'
      ? declaredType
      : detectMediaType(mediaUrl)
    : 'none';

  await db.updateLibraryExercise(id, {
    name: str(formData, 'name') || 'Untitled exercise',
    category: str(formData, 'category') || EXERCISE_CATEGORIES[0],
    instructions: str(formData, 'instructions'),
    mode,
    sets: Math.max(1, Math.round(num(formData, 'sets', 1))),
    reps: mode === 'reps' ? Math.max(1, Math.round(num(formData, 'reps', 10))) : null,
    duration_seconds:
      mode === 'time' ? Math.max(1, Math.round(num(formData, 'duration_seconds', 30))) : null,
    rest_seconds: Math.max(0, Math.round(num(formData, 'rest_seconds', 30))),
    media_type: mediaType,
    media_url: mediaUrl,
  });

  revalidatePath('/admin/library');
  redirect('/admin/library');
}

export async function removeLibraryExercise(formData: FormData): Promise<void> {
  await requireAdmin();
  await db.deleteLibraryExercise(str(formData, 'libraryId'));
  revalidatePath('/admin/library');
  redirect('/admin/library');
}

/**
 * Copies a library entry into a workout — including its video. The workout gets
 * its own independent copy, so later edits to either side don't affect the other.
 */
export async function addExerciseFromLibrary(formData: FormData): Promise<void> {
  await requireAdmin();
  const workoutId = str(formData, 'workoutId');
  const source = await db.getLibraryExercise(str(formData, 'libraryId'));
  if (!source) redirect(`/admin/workout/${workoutId}`);

  await db.createExercise({
    workout_id: workoutId,
    name: source.name,
    instructions: source.instructions,
    mode: source.mode,
    sets: source.sets,
    reps: source.reps,
    duration_seconds: source.duration_seconds,
    rest_seconds: source.rest_seconds,
    media_type: source.media_type,
    media_url: source.media_url,
  });

  revalidatePath(`/admin/workout/${workoutId}`);
  revalidatePath('/home');
}

/** Pushes a workout exercise back into the library so it can be reused. */
export async function saveExerciseToLibrary(formData: FormData): Promise<void> {
  await requireAdmin();
  const exercise = await db.getExercise(str(formData, 'exerciseId'));
  if (!exercise) redirect('/admin');

  const existing = (await db.listLibrary()).find(
    (entry) => entry.name.toLowerCase() === exercise.name.trim().toLowerCase(),
  );

  const payload = {
    name: exercise.name,
    category: str(formData, 'category') || EXERCISE_CATEGORIES[0],
    instructions: exercise.instructions,
    mode: exercise.mode,
    sets: exercise.sets,
    reps: exercise.reps,
    duration_seconds: exercise.duration_seconds,
    rest_seconds: exercise.rest_seconds,
    media_type: exercise.media_type,
    media_url: exercise.media_url,
  };

  // Same name means "update my saved version", not "make a near-duplicate".
  if (existing) await db.updateLibraryExercise(existing.id, payload);
  else await db.createLibraryExercise(payload);

  revalidatePath('/admin/library');
  redirect(`/admin/exercise/${exercise.id}?saved=library`);
}

/* -------------------------------------------------------------- exercises */

export async function addExercise(formData: FormData): Promise<void> {
  await requireAdmin();
  const workoutId = str(formData, 'workoutId');
  const exercise = await db.createExercise({
    workout_id: workoutId,
    name: str(formData, 'name') || 'New exercise',
    mode: 'reps',
    sets: 1,
    reps: 10,
    rest_seconds: 30,
  });
  redirect(`/admin/exercise/${exercise.id}`);
}

export async function saveExercise(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = str(formData, 'exerciseId');
  const mode = (str(formData, 'mode') === 'time' ? 'time' : 'reps') as ExerciseMode;

  const mediaUrl = str(formData, 'media_url');
  const declaredType = str(formData, 'media_type') as MediaType;
  const mediaType: MediaType = mediaUrl
    ? declaredType === 'video' || declaredType === 'image'
      ? declaredType
      : detectMediaType(mediaUrl)
    : 'none';

  const exercise = await db.updateExercise(id, {
    name: str(formData, 'name') || 'Untitled exercise',
    instructions: str(formData, 'instructions'),
    mode,
    sets: Math.max(1, Math.round(num(formData, 'sets', 1))),
    reps: mode === 'reps' ? Math.max(1, Math.round(num(formData, 'reps', 10))) : null,
    duration_seconds:
      mode === 'time' ? Math.max(1, Math.round(num(formData, 'duration_seconds', 30))) : null,
    rest_seconds: Math.max(0, Math.round(num(formData, 'rest_seconds', 30))),
    media_type: mediaType,
    media_url: mediaUrl,
  });

  revalidatePath(`/admin/workout/${exercise.workout_id}`);
  revalidatePath('/home');
  redirect(`/admin/workout/${exercise.workout_id}`);
}

export async function removeExercise(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = str(formData, 'exerciseId');
  const exercise = await db.getExercise(id);
  await db.deleteExercise(id);

  if (exercise) {
    revalidatePath(`/admin/workout/${exercise.workout_id}`);
    redirect(`/admin/workout/${exercise.workout_id}`);
  }
  redirect('/admin');
}

export async function moveExercise(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = str(formData, 'exerciseId');
  const direction = str(formData, 'direction') === 'up' ? -1 : 1;

  const exercise = await db.getExercise(id);
  if (!exercise) return;

  const siblings = await db.listExercises(exercise.workout_id);
  const index = siblings.findIndex((e) => e.id === id);
  const swapWith = siblings[index + direction];
  if (!swapWith) return;

  await db.updateExercise(exercise.id, { position: swapWith.position });
  await db.updateExercise(swapWith.id, { position: exercise.position });

  revalidatePath(`/admin/workout/${exercise.workout_id}`);
  revalidatePath('/home');
}
