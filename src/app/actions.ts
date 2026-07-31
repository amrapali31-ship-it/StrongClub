'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { clearActiveProfile, getActiveProfileId, setActiveProfileId } from '@/lib/auth';
import { db } from '@/lib/db';

export async function chooseProfile(formData: FormData): Promise<void> {
  const id = String(formData.get('profileId') ?? '');
  const profile = id ? await db.getProfile(id) : null;
  if (!profile) redirect('/');

  await setActiveProfileId(profile.id);
  redirect('/home');
}

export async function switchProfile(): Promise<void> {
  await clearActiveProfile();
  redirect('/');
}

export async function toggleExercise(exerciseId: string, done: boolean): Promise<void> {
  const profileId = await getActiveProfileId();
  if (!profileId) return;

  await db.setExerciseDone(profileId, exerciseId, done);
  revalidatePath('/home');
}

/** Form-post version so the checklist works even before hydration. */
export async function toggleExerciseForm(formData: FormData): Promise<void> {
  const exerciseId = String(formData.get('exerciseId') ?? '');
  const done = formData.get('done') === 'true';
  const workoutId = String(formData.get('workoutId') ?? '');

  await toggleExercise(exerciseId, done);
  if (workoutId) revalidatePath(`/workout/${workoutId}`);
}

export async function resetWorkoutForm(formData: FormData): Promise<void> {
  await resetWorkout(String(formData.get('workoutId') ?? ''));
}

export async function resetWorkout(workoutId: string): Promise<void> {
  const profileId = await getActiveProfileId();
  if (!profileId) return;

  await db.resetWorkout(profileId, workoutId);
  revalidatePath('/home');
  revalidatePath(`/workout/${workoutId}`);
}
