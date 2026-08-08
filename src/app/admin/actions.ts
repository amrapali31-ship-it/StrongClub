'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { checkPasscode, isAdmin, signInAdmin, signOutAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import type { DraftExercise, DraftWeek, DraftWorkout } from '@/lib/importer';
import { detectMediaType } from '@/lib/media';
import { closesWorkout, groupExercises, normaliseCategory, opensWorkout } from '@/lib/ordering';
import { nextWeekSlot } from '@/lib/queries';
import {
  LIBRARY_CATEGORIES,
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
      section_rounds: workout.section_rounds ?? {},
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
      section_rounds: workout.section_rounds ?? {},
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

  const library = formData.get('keepInLibrary') === 'on' ? await LibraryCollector.open() : undefined;

  for (const [workoutIndex, draftWorkout] of draft.workouts.entries()) {
    const workout = await db.createWorkout({
      week_id: week.id,
      title: draftWorkout.title || `Workout ${workoutIndex + 1}`,
      subtitle: draftWorkout.subtitle ?? '',
      position: workoutIndex,
    });

    for (const [index, draftExercise] of draftWorkout.exercises.entries()) {
      await exerciseFromDraft(draftExercise, workout.id, index, library);
    }
  }

  if (library?.count) revalidatePath('/admin/library');

  revalidatePath('/admin');
  redirect(`/admin/week/${week.id}`);
}

/**
 * Builds the exercise a draft describes, preferring the library entry it was
 * matched to.
 *
 * The split matters: the *movement* comes from the library — its name, the
 * coach's own wording, and above all its video, which is the one thing an
 * import can never produce. The *numbers* come from the plan being imported,
 * because today's session says three sets of eight whatever the library
 * happens to store as a default.
 */
async function exerciseFromDraft(
  draft: DraftExercise,
  workoutId: string,
  position: number,
  library?: LibraryCollector,
): Promise<void> {
  const mode: ExerciseMode = draft.mode === 'time' ? 'time' : 'reps';
  const source = draft.library_id ? await db.getLibraryExercise(draft.library_id) : null;

  const shape = {
    name: source?.name || draft.name || 'Untitled exercise',
    // The draft's section wins over the library's category: a section names
    // part of this workout and is chosen for it, while a category is only how
    // the movement is filed. Letting the filing win put every composed
    // exercise under "Legs" and "Upper body" and left the real sections empty.
    category: draft.category || source?.category || '',
    equipment: source?.equipment || draft.equipment || '',
    instructions: source?.instructions || draft.instructions || '',
    mode,
    sets: Math.max(1, Math.round(draft.sets || 1)),
    reps: mode === 'reps' ? Math.max(1, Math.round(draft.reps ?? 10)) : null,
    duration_seconds: mode === 'time' ? Math.max(1, Math.round(draft.duration_seconds ?? 30)) : null,
    rest_seconds: Math.max(0, Math.round(draft.rest_seconds ?? 30)),
  };

  await db.createExercise({
    workout_id: workoutId,
    ...shape,
    // A matched entry brings its video. Otherwise nothing: models invent
    // plausible-looking links that go nowhere.
    media_type: source?.media_type ?? 'none',
    media_url: source?.media_url ?? '',
    poster_url: source?.poster_url ?? '',
    position,
  });

  // Only movements the library didn't already have. A matched one is already
  // there by definition, and re-saving it would overwrite the coach's own
  // wording with the model's.
  if (library && !source) await library.keep(shape);
}

/**
 * Files away the movements an import introduced, so the library grows as weeks
 * are imported rather than staying whatever it was seeded with.
 *
 * Names are tracked across the whole import, not just against the database:
 * one plan can name the same exercise in three different workouts, and each
 * would otherwise be filed separately.
 */
class LibraryCollector {
  private readonly seen: Set<string>;
  private saved = 0;

  private constructor(names: string[]) {
    this.seen = new Set(names.map((name) => name.trim().toLowerCase()));
  }

  static async open(): Promise<LibraryCollector> {
    return new LibraryCollector((await db.listLibrary()).map((entry) => entry.name));
  }

  async keep(shape: {
    name: string;
    category: string;
    equipment: string;
    instructions: string;
    mode: ExerciseMode;
    sets: number;
    reps: number | null;
    duration_seconds: number | null;
    rest_seconds: number;
  }): Promise<void> {
    const key = shape.name.trim().toLowerCase();
    if (!key || key === 'untitled exercise' || this.seen.has(key)) return;

    this.seen.add(key);
    this.saved += 1;
    // Imports never carry media, so a fresh entry starts without one and gets
    // a video attached by hand later.
    await db.createLibraryExercise({ ...shape, media_type: 'none', media_url: '', poster_url: '' });
  }

  get count(): number {
    return this.saved;
  }
}

/**
 * Turns a reviewed AI draft into one workout inside a week that already
 * exists — the workout-at-a-time counterpart to importing a whole plan.
 *
 * Unlike the week import there's no draft state to hide behind: if the week is
 * already published, this workout is visible the moment it saves. The review
 * screen says so before you press the button.
 */
export async function saveImportedWorkout(formData: FormData): Promise<void> {
  await requireAdmin();

  const weekId = str(formData, 'weekId');
  const week = await db.getWeek(weekId);
  if (!week) redirect('/admin');

  let draft: DraftWorkout;
  try {
    draft = JSON.parse(str(formData, 'draft')) as DraftWorkout;
  } catch {
    redirect(`/admin/week/${weekId}`);
  }

  // Rounds only arrive from a composed workout; an imported one has none.
  const rounds = draft.section_rounds ?? {};
  const sections = [...new Set(draft.exercises.map((e) => e.category ?? '').filter(Boolean))];

  const siblings = await db.listWorkouts(weekId);
  const workout = await db.createWorkout({
    week_id: weekId,
    title: str(formData, 'title') || draft.title || 'Imported workout',
    emoji: str(formData, 'emoji'),
    subtitle: draft.subtitle ?? '',
    // Recorded explicitly so the order survives even where a section's
    // exercises are later moved out of it.
    sections,
    section_rounds: rounds,
    position: siblings.length,
  });

  const library = formData.get('keepInLibrary') === 'on' ? await LibraryCollector.open() : undefined;

  for (const [index, draftExercise] of draft.exercises.entries()) {
    await exerciseFromDraft(draftExercise, workout.id, index, library);
  }

  if (library?.count) revalidatePath('/admin/library');

  revalidatePath(`/admin/week/${weekId}`);
  revalidatePath('/home');
  redirect(`/admin/workout/${workout.id}`);
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

/**
 * "Legs & balance" becomes "Legs & balance (copy)", and copying that again
 * gives "(copy 2)" rather than stacking "(copy) (copy)" forever.
 */
function copyTitle(title: string): string {
  const match = title.match(/^(.*) \(copy(?: (\d+))?\)$/);
  if (!match) return `${title} (copy)`;
  return `${match[1]} (copy ${Number(match[2] ?? 1) + 1})`;
}

/**
 * Copies a workout in place — exercises, videos, sections and all — and drops
 * it in directly after the original so it's easy to see what came from what.
 */
export async function duplicateWorkout(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = str(formData, 'workoutId');

  const source = await db.getWorkout(id);
  if (!source) return;

  const copy = await db.createWorkout({
    week_id: source.week_id,
    title: copyTitle(source.title),
    emoji: source.emoji,
    subtitle: source.subtitle,
    sections: source.sections ?? [],
    section_rounds: source.section_rounds ?? {},
    position: source.position,
  });

  for (const exercise of await db.listExercises(id)) {
    await db.createExercise({ ...exercise, workout_id: copy.id });
  }

  // Positions are only ever compared, never assumed contiguous, so the whole
  // week is renumbered from the order we want rather than nudged around it.
  const ordered = (await db.listWorkouts(source.week_id)).filter((w) => w.id !== copy.id);
  ordered.splice(ordered.findIndex((w) => w.id === id) + 1, 0, copy);
  await Promise.all(ordered.map((w, i) => db.updateWorkout(w.id, { position: i })));

  revalidatePath(`/admin/week/${source.week_id}`);
  revalidatePath('/home');
  redirect(`/admin/workout/${copy.id}`);
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
    category: str(formData, 'category') || LIBRARY_CATEGORIES[0],
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
    category: str(formData, 'category') || LIBRARY_CATEGORIES[0],
    equipment: str(formData, 'equipment'),
    instructions: str(formData, 'instructions'),
    mode,
    sets: Math.max(1, Math.round(num(formData, 'sets', 1))),
    reps: mode === 'reps' ? Math.max(1, Math.round(num(formData, 'reps', 10))) : null,
    duration_seconds:
      mode === 'time' ? Math.max(1, Math.round(num(formData, 'duration_seconds', 30))) : null,
    rest_seconds: Math.max(0, Math.round(num(formData, 'rest_seconds', 30))),
    media_type: mediaType,
    media_url: mediaUrl,
    // Cleared with the media: a still for a video that's gone is worse than
    // none, because it shows a frame nothing will play.
    poster_url: mediaType === 'video' ? str(formData, 'poster_url') : '',
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
/**
 * Replaces one exercise with a different movement from the library, in place.
 *
 * What changes is the movement — its name, wording, kit and video. What stays
 * is everything about *this* workout: where it sits, which section it's in,
 * and how much of it to do. Swapping a squat for an easier squat shouldn't
 * quietly rewrite three sets of eight into whatever the library happens to
 * store as a default.
 *
 * The exception is a change of kind. Putting a timed hold where a counted
 * exercise was leaves reps meaningless, so in that case the library's own
 * numbers come across with it.
 */
export async function swapExercise(formData: FormData): Promise<void> {
  await requireAdmin();
  const exerciseId = str(formData, 'exerciseId');
  const source = await db.getLibraryExercise(str(formData, 'libraryId'));

  const current = await db.getExercise(exerciseId);
  if (!current || !source) return;

  const sameKind = current.mode === source.mode;

  await db.updateExercise(exerciseId, {
    name: source.name,
    equipment: source.equipment ?? '',
    instructions: source.instructions,
    media_type: source.media_type,
    media_url: source.media_url,
    poster_url: source.poster_url ?? '',
    mode: source.mode,
    sets: sameKind ? current.sets : source.sets,
    reps: sameKind ? current.reps : source.reps,
    duration_seconds: sameKind ? current.duration_seconds : source.duration_seconds,
    rest_seconds: sameKind ? current.rest_seconds : source.rest_seconds,
  });

  revalidatePath(`/admin/workout/${current.workout_id}`);
  revalidatePath(`/workout/${current.workout_id}`);
  revalidatePath('/home');
}

export async function addExerciseFromLibrary(formData: FormData): Promise<void> {
  await requireAdmin();
  const workoutId = str(formData, 'workoutId');
  const source = await db.getLibraryExercise(str(formData, 'libraryId'));
  if (!source) redirect(`/admin/workout/${workoutId}`);

  await db.createExercise({
    workout_id: workoutId,
    name: source.name,
    category: source.category,
    equipment: source.equipment ?? '',
    instructions: source.instructions,
    mode: source.mode,
    sets: source.sets,
    reps: source.reps,
    duration_seconds: source.duration_seconds,
    rest_seconds: source.rest_seconds,
    media_type: source.media_type,
    media_url: source.media_url,
    poster_url: source.poster_url ?? '',
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
    category: str(formData, 'category') || exercise.category || LIBRARY_CATEGORIES[0],
    equipment: exercise.equipment ?? '',
    instructions: exercise.instructions,
    mode: exercise.mode,
    sets: exercise.sets,
    reps: exercise.reps,
    duration_seconds: exercise.duration_seconds,
    rest_seconds: exercise.rest_seconds,
    media_type: exercise.media_type,
    media_url: exercise.media_url,
    poster_url: exercise.poster_url ?? '',
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
    equipment: str(formData, 'equipment'),
    instructions: str(formData, 'instructions'),
    mode,
    sets: Math.max(1, Math.round(num(formData, 'sets', 1))),
    reps: mode === 'reps' ? Math.max(1, Math.round(num(formData, 'reps', 10))) : null,
    duration_seconds:
      mode === 'time' ? Math.max(1, Math.round(num(formData, 'duration_seconds', 30))) : null,
    rest_seconds: Math.max(0, Math.round(num(formData, 'rest_seconds', 30))),
    media_type: mediaType,
    media_url: mediaUrl,
    // Cleared with the media: a still for a video that's gone is worse than
    // none, because it shows a frame nothing will play.
    poster_url: mediaType === 'video' ? str(formData, 'poster_url') : '',
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
  if (workout) {
    const patch: Partial<typeof workout> = {};

    if (workout.sections?.includes(from)) {
      const next = workout.sections.map((s) => (s === from ? to : s));
      patch.sections = [...new Set(next.filter(Boolean))];
    }

    // Rounds belong to the block, not to its name.
    const rounds = workout.section_rounds ?? {};
    if (rounds[from] !== undefined) {
      const rest = Object.fromEntries(Object.entries(rounds).filter(([key]) => key !== from));
      patch.section_rounds = to ? { ...rest, [to]: rounds[from] } : rest;
    }

    if (Object.keys(patch).length > 0) await db.updateWorkout(workoutId, patch);
  }

  revalidatePath(`/admin/workout/${workoutId}`);
  revalidatePath(`/workout/${workoutId}`);
  revalidatePath('/home');
}

/**
 * Reads back the sections in the order they're currently displayed.
 *
 * Once anything is arranged by hand this list becomes the running order, so it
 * has to be written out in full — pinning one section and leaving the rest
 * implicit would let them drift apart. Uncategorised leftovers are left out:
 * they have no name to store, and they always sit at the end anyway.
 */
async function currentSectionOrder(workoutId: string, sections: string[]): Promise<string[]> {
  const exercises = await db.listExercises(workoutId);
  return groupExercises(exercises, sections, { includeEmpty: true })
    .map((group) => group.category)
    .filter(Boolean);
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
  const order = await currentSectionOrder(workoutId, workout.sections ?? []);
  const key = normaliseCategory(name);
  if (order.some((section) => normaliseCategory(section) === key)) return;

  // Dropped in where it belongs rather than always at the end: a warm-up opens
  // the workout and a cool-down closes it. Either way it can be moved after.
  let at = order.length;
  if (opensWorkout(name)) {
    at = 0;
  } else if (!closesWorkout(name)) {
    const closing = order.findIndex((section) => closesWorkout(section));
    if (closing !== -1) at = closing;
  }
  order.splice(at, 0, name);

  await db.updateWorkout(workoutId, { sections: order });
  revalidatePath(`/admin/workout/${workoutId}`);
  revalidatePath(`/workout/${workoutId}`);
}

/**
 * Sets how many times a section is repeated as a block — the superset case,
 * where you do A, B and C in order and then go round again.
 *
 * One round is the normal state, so it's stored by removing the entry rather
 * than writing 1: a workout with nothing repeated carries no rounds at all.
 */
export async function setSectionRounds(formData: FormData): Promise<void> {
  await requireAdmin();
  const workoutId = str(formData, 'workoutId');
  const name = str(formData, 'name');
  const rounds = Math.max(1, Math.min(20, Math.round(num(formData, 'rounds', 1))));

  const workout = await db.getWorkout(workoutId);
  if (!workout || !name) return;

  const rest = Object.fromEntries(
    Object.entries(workout.section_rounds ?? {}).filter(([key]) => key !== name),
  );
  const next = rounds > 1 ? { ...rest, [name]: rounds } : rest;

  await db.updateWorkout(workoutId, { section_rounds: next });
  revalidatePath(`/admin/workout/${workoutId}`);
  revalidatePath(`/workout/${workoutId}`);
  revalidatePath('/home');
}

/** Shifts a section one place up or down, exercises and all. */
export async function moveSection(formData: FormData): Promise<void> {
  await requireAdmin();
  const workoutId = str(formData, 'workoutId');
  const name = str(formData, 'name');
  const step = str(formData, 'direction') === 'up' ? -1 : 1;

  const workout = await db.getWorkout(workoutId);
  if (!workout || !name) return;

  const order = await currentSectionOrder(workoutId, workout.sections ?? []);
  const from = order.indexOf(name);
  const to = from + step;
  if (from === -1 || to < 0 || to >= order.length) return;

  [order[from], order[to]] = [order[to], order[from]];

  await db.updateWorkout(workoutId, { sections: order });
  revalidatePath(`/admin/workout/${workoutId}`);
  revalidatePath(`/workout/${workoutId}`);
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
    section_rounds: Object.fromEntries(
      Object.entries(workout.section_rounds ?? {}).filter(([key]) => key !== name),
    ),
  });
  revalidatePath(`/admin/workout/${workoutId}`);
  revalidatePath(`/workout/${workoutId}`);
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


/**
 * Records a still against every row using a given video.
 *
 * Keyed by the video's URL rather than by row id because one clip often
 * demonstrates several exercises — capturing it once should cover all of them.
 */
export async function saveMediaPoster(formData: FormData): Promise<void> {
  await requireAdmin();
  const mediaUrl = str(formData, 'mediaUrl');
  const posterUrl = str(formData, 'posterUrl');
  if (!mediaUrl || !posterUrl) return;

  const [exercises, library] = await Promise.all([db.listAllExercises(), db.listLibrary()]);

  await Promise.all([
    ...exercises
      .filter((e) => e.media_url === mediaUrl && !e.poster_url)
      .map((e) => db.updateExercise(e.id, { poster_url: posterUrl })),
    ...library
      .filter((e) => e.media_url === mediaUrl && !e.poster_url)
      .map((e) => db.updateLibraryExercise(e.id, { poster_url: posterUrl })),
  ]);

  revalidatePath('/admin/library');
  revalidatePath('/home');
}
