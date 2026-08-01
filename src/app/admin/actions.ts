'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { checkPasscode, isAdmin, signInAdmin, signOutAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import type { DraftWeek } from '@/lib/importer';
import { detectMediaType } from '@/lib/media';
import { normaliseCategory } from '@/lib/ordering';
import { nextWeekSlot } from '@/lib/queries';
import {
  EXERCISE_CATEGORIES,
  type Exercise,
  type ExerciseMode,
  type MediaType,
} from '@/lib/types';

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

const PROFILE_COLORS = ['#ff4d9d', '#3ddc97', '#4cc9f0', '#b388ff', '#ffb703'];

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

/** Sets or clears a person's photo. The URL comes back from /api/upload. */
export async function saveProfilePhoto(formData: FormData): Promise<void> {
  await requireAdmin();
  await db.updateProfile(str(formData, 'profileId'), { photo_url: str(formData, 'photo_url') });

  revalidatePath('/admin');
  revalidatePath('/');
  revalidatePath('/home');
}

export async function removeProfile(formData: FormData): Promise<void> {
  await requireAdmin();
  await db.deleteProfile(str(formData, 'profileId'));
  revalidatePath('/admin');
}

/* ------------------------------------------------------------------ weeks */

/**
 * One tap, no typing. Names and dates itself from wherever your last week
 * left off — both are editable on the next screen if you care.
 */
export async function addWeek(): Promise<void> {
  await requireAdmin();
  const week = await db.createWeek({ ...(await nextWeekSlot()), note: '', published: false });
  redirect(`/admin/week/${week.id}`);
}

/**
 * The fast weekly path: clone last week's workouts, exercises and videos into
 * a fresh draft, then change whatever needs changing.
 */
export async function repeatLastWeek(): Promise<void> {
  await requireAdmin();

  const weeks = await db.listWeeks();
  const source = weeks[0];
  if (!source) redirect('/admin');

  const copy = await db.createWeek({
    ...(await nextWeekSlot()),
    note: source.note,
    published: false,
  });

  for (const workout of await db.listWorkouts(source.id)) {
    const newWorkout = await db.createWorkout({
      week_id: copy.id,
      title: workout.title,
      emoji: workout.emoji,
      subtitle: workout.subtitle,
      sections: workout.sections ?? [],
      position: workout.position,
    });
    for (const exercise of await db.listExercises(workout.id)) {
      await db.createExercise({ ...exercise, workout_id: newWorkout.id });
    }
  }

  revalidatePath('/admin');
  redirect(`/admin/week/${copy.id}`);
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
    ...(await nextWeekSlot()),
    note: source.note,
    published: false,
  });

  for (const workout of await db.listWorkouts(sourceId)) {
    const newWorkout = await db.createWorkout({
      week_id: copy.id,
      title: workout.title,
      emoji: workout.emoji,
      subtitle: workout.subtitle,
      sections: workout.sections ?? [],
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
    // Two characters is enough for any single emoji, including the ones built
    // from a base plus a skin-tone or variation selector.
    emoji: [...str(formData, 'emoji')].slice(0, 2).join(''),
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
    category: source.category,
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
    category: str(formData, 'category') || exercise.category || EXERCISE_CATEGORIES[0],
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
    category: str(formData, 'category'),
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

/**
 * Renames a section within one workout — every exercise currently in it moves
 * to the new name. Scoped to this workout on purpose: the same section name
 * elsewhere, and in the library, is left alone.
 */
export async function renameSection(formData: FormData): Promise<void> {
  await requireAdmin();
  const workoutId = str(formData, 'workoutId');
  const from = str(formData, 'from');
  const to = str(formData, 'to');

  if (from === to) return;

  const exercises = await db.listExercises(workoutId);
  await Promise.all(
    exercises
      .filter((e) => (e.category ?? '') === from)
      .map((e) => db.updateExercise(e.id, { category: to })),
  );

  // Keep the workout's own list in step, or a renamed empty section would
  // vanish and the old name would linger.
  const workout = await db.getWorkout(workoutId);
  if (workout?.sections?.includes(from)) {
    const next = workout.sections.map((s) => (s === from ? to : s));
    await db.updateWorkout(workoutId, { sections: [...new Set(next.filter(Boolean))] });
  }

  revalidatePath(`/admin/workout/${workoutId}`);
  revalidatePath('/home');
}

/** Creates an empty section so exercises can be dragged or added into it. */
export async function addSection(formData: FormData): Promise<void> {
  await requireAdmin();
  const workoutId = str(formData, 'workoutId');
  const name = str(formData, 'name');
  if (!name) return;

  const workout = await db.getWorkout(workoutId);
  if (!workout) return;

  // Matched loosely, so typing "warm up" next to an existing "Warm-up" doesn't
  // leave the workout with two headings that read the same.
  const exercises = await db.listExercises(workoutId);
  const key = normaliseCategory(name);
  const alreadyThere =
    (workout.sections ?? []).some((s) => normaliseCategory(s) === key) ||
    exercises.some((e) => normaliseCategory(e.category ?? '') === key);
  if (alreadyThere) return;

  await db.updateWorkout(workoutId, { sections: [...(workout.sections ?? []), name] });
  revalidatePath(`/admin/workout/${workoutId}`);
}

/**
 * Drops an empty section. Only ever offered when nothing is in it, so this
 * can't quietly orphan exercises.
 */
export async function removeSection(formData: FormData): Promise<void> {
  await requireAdmin();
  const workoutId = str(formData, 'workoutId');
  const name = str(formData, 'name');

  const workout = await db.getWorkout(workoutId);
  if (!workout) return;

  const exercises = await db.listExercises(workoutId);
  if (exercises.some((e) => (e.category ?? '') === name)) return;

  await db.updateWorkout(workoutId, {
    sections: (workout.sections ?? []).filter((s) => s !== name),
  });
  revalidatePath(`/admin/workout/${workoutId}`);
}

/**
 * Persists a drag-and-drop reorder in one go: the client sends the exercises in
 * their new visual order, each already tagged with the section it was dropped
 * into, and positions are reassigned from that order.
 */
export async function reorderExercises(formData: FormData): Promise<void> {
  await requireAdmin();
  const workoutId = str(formData, 'workoutId');

  let order: { id: string; category: string }[];
  try {
    order = JSON.parse(str(formData, 'order')) as { id: string; category: string }[];
  } catch {
    return;
  }

  // Only touch exercises that actually belong to this workout, so a stale or
  // tampered payload can't reach across into another one.
  const existing = await db.listExercises(workoutId);
  const byId = new Map(existing.map((e) => [e.id, e]));

  await Promise.all(
    order
      .filter((entry) => byId.has(entry.id))
      .map((entry, index) => {
        const current = byId.get(entry.id)!;
        const category = entry.category ?? '';
        if (current.position === index && (current.category ?? '') === category) return null;
        return db.updateExercise(entry.id, { position: index, category });
      })
      .filter((p): p is Promise<Exercise> => p !== null),
  );

  revalidatePath(`/admin/workout/${workoutId}`);
  revalidatePath('/home');
}

