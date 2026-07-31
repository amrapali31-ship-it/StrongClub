import { notFound, redirect } from 'next/navigation';

import { toggleExercise } from '@/app/actions';
import { WorkoutPlayer } from '@/components/WorkoutPlayer';
import { getActiveProfileId } from '@/lib/auth';
import { db } from '@/lib/db';
import { getWorkoutProgress } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default async function DoWorkout({ params }: { params: Promise<{ workoutId: string }> }) {
  const { workoutId } = await params;

  const profileId = await getActiveProfileId();
  const profile = profileId ? await db.getProfile(profileId) : null;
  if (!profile) redirect('/');

  const progress = await getWorkoutProgress(workoutId, profile.id);
  if (!progress) notFound();

  return (
    <WorkoutPlayer
      workout={progress.workout}
      exercises={progress.exercises}
      initialDoneIds={[...progress.doneExerciseIds]}
      onExerciseDone={toggleExercise}
    />
  );
}
