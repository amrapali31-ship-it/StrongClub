import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { resetWorkoutForm, toggleExerciseForm } from '@/app/actions';
import { AppHeader } from '@/components/AppHeader';
import { MediaThumb } from '@/components/MediaFrame';
import { getActiveProfileId } from '@/lib/auth';
import { db } from '@/lib/db';
import { setsLabel } from '@/lib/media';
import { getWorkoutProgress } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default async function WorkoutOverview({
  params,
}: {
  params: Promise<{ workoutId: string }>;
}) {
  const { workoutId } = await params;

  const profileId = await getActiveProfileId();
  const profile = profileId ? await db.getProfile(profileId) : null;
  if (!profile) redirect('/');

  const progress = await getWorkoutProgress(workoutId, profile.id);
  if (!progress) notFound();

  const { workout, exercises, doneExerciseIds, status, estimatedMinutes } = progress;
  const week = await db.getWeek(workout.week_id);
  const doneCount = exercises.filter((e) => doneExerciseIds.has(e.id)).length;

  return (
    <>
      <AppHeader profile={profile} />

      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-6 pb-32">
        <Link
          href={week ? `/week/${week.id}` : '/home'}
          className="text-base font-semibold text-muted hover:text-ink"
        >
          &larr; Back
        </Link>

        <h1 className="mt-3 text-3xl font-extrabold tracking-tight">{workout.title}</h1>
        {workout.subtitle && <p className="mt-2 text-lg text-muted">{workout.subtitle}</p>}

        <p className="mt-3 text-base text-muted">
          {exercises.length} {exercises.length === 1 ? 'exercise' : 'exercises'} &middot; about{' '}
          {estimatedMinutes} min
          {doneCount > 0 && (
            <>
              {' '}
              &middot; <span className="font-semibold text-success">{doneCount} done</span>
            </>
          )}
        </p>

        <ul className="mt-6 flex flex-col gap-2">
          {exercises.map((exercise, i) => {
            const done = doneExerciseIds.has(exercise.id);
            return (
              <li key={exercise.id} className="card flex items-center gap-4 p-3">
                <span className="w-5 shrink-0 text-center text-sm font-bold text-muted/60 tabular-nums">
                  {i + 1}
                </span>

                <MediaThumb
                  mediaType={exercise.media_type}
                  url={exercise.media_url}
                  name={exercise.name}
                />

                <div className="min-w-0 flex-1">
                  <p className={`text-lg font-bold ${done ? 'text-muted line-through' : ''}`}>
                    {exercise.name}
                  </p>
                  <p className="text-base text-muted">{setsLabel(exercise)}</p>
                </div>

                <form action={toggleExerciseForm}>
                  <input type="hidden" name="exerciseId" value={exercise.id} />
                  <input type="hidden" name="workoutId" value={workout.id} />
                  <input type="hidden" name="done" value={done ? 'false' : 'true'} />
                  <button
                    type="submit"
                    aria-label={done ? `Mark ${exercise.name} not done` : `Mark ${exercise.name} done`}
                    className={`flex h-11 w-11 items-center justify-center rounded-full border-2 text-lg font-bold transition active:scale-95 ${
                      done
                        ? 'border-success bg-success text-white'
                        : 'border-line text-transparent hover:border-ink/30'
                    }`}
                  >
                    ✓
                  </button>
                </form>
              </li>
            );
          })}
        </ul>

        {doneCount > 0 && (
          <form action={resetWorkoutForm} className="mt-6">
            <input type="hidden" name="workoutId" value={workout.id} />
            <button type="submit" className="btn-ghost w-full text-base">
              Clear my progress on this workout
            </button>
          </form>
        )}
      </main>

      {exercises.length > 0 && (
        <footer className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-cream/95 px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
          <div className="mx-auto w-full max-w-2xl">
            <Link href={`/workout/${workout.id}/do`} className="btn-primary w-full">
              {status === 'not-started'
                ? 'Start workout'
                : status === 'done'
                  ? 'Do it again'
                  : 'Continue'}
            </Link>
          </div>
        </footer>
      )}
    </>
  );
}
