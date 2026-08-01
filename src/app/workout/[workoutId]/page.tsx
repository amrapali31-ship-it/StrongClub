import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { resetWorkoutForm, toggleExerciseForm } from '@/app/actions';
import { AppHeader } from '@/components/AppHeader';
import { ExerciseMedia } from '@/components/ExerciseMedia';
import { InlineTimer } from '@/components/InlineTimer';
import { getActiveProfileId } from '@/lib/auth';
import { db } from '@/lib/db';
import { setsLabel } from '@/lib/media';
import { getWorkoutProgress, groupExercises, shouldShowGroupHeadings } from '@/lib/queries';

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

  const { workout, exercises, doneExerciseIds, estimatedMinutes } = progress;
  const week = await db.getWeek(workout.week_id);
  const doneCount = exercises.filter((e) => doneExerciseIds.has(e.id)).length;

  const groups = groupExercises(exercises);
  const showHeadings = shouldShowGroupHeadings(groups);

  return (
    <>
      <AppHeader profile={profile} />

      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-6">
        <Link
          href={week ? `/week/${week.id}` : '/home'}
          className="text-base font-semibold text-muted hover:text-ink"
        >
          &larr; Back
        </Link>

        <h1 className="mt-3 flex items-center gap-3 text-3xl font-extrabold tracking-tight">
          {workout.emoji && (
            <span className="text-4xl leading-none" aria-hidden>
              {workout.emoji}
            </span>
          )}
          {workout.title}
        </h1>
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

        <p className="mt-4 text-base text-muted">
          Work down the list at your own pace. Tick things off if you like &mdash; it&rsquo;s just
          so you can see where you got to.
        </p>

        {groups.map((group) => (
          <section key={group.category || 'other'} className="mt-8 first:mt-6">
            {showHeadings && (
              <h2 className="mb-3 flex items-baseline gap-2 text-sm font-bold tracking-widest text-brand uppercase">
                {group.heading}
                <span className="text-xs font-semibold tracking-normal text-muted normal-case">
                  {group.exercises.length}{' '}
                  {group.exercises.length === 1 ? 'exercise' : 'exercises'}
                </span>
              </h2>
            )}

            <ol className="flex flex-col gap-4">
              {group.exercises.map((exercise) => {
                const done = doneExerciseIds.has(exercise.id);
                const i = exercises.indexOf(exercise);

                return (
                  <li key={exercise.id} className={`card p-4 ${done ? 'bg-success-tint/40' : ''}`}>
                <div className="flex items-start gap-3">
                  <span className="mt-1 w-6 shrink-0 text-center text-base font-bold text-muted/70 tabular-nums">
                    {i + 1}
                  </span>

                  <div className="min-w-0 flex-1">
                    <h2 className="text-2xl font-bold">{exercise.name}</h2>
                    <p className="mt-0.5 text-lg font-semibold text-brand">
                      {setsLabel(exercise)}
                    </p>
                  </div>

                  <form action={toggleExerciseForm} className="shrink-0">
                    <input type="hidden" name="exerciseId" value={exercise.id} />
                    <input type="hidden" name="workoutId" value={workout.id} />
                    <input type="hidden" name="done" value={done ? 'false' : 'true'} />
                    <button
                      type="submit"
                      aria-label={
                        done ? `Mark ${exercise.name} not done` : `Mark ${exercise.name} done`
                      }
                      className={`flex h-12 w-12 items-center justify-center rounded-full border-2 text-xl font-bold transition active:scale-95 ${
                        done
                          ? 'border-success bg-success text-white'
                          : 'border-line text-transparent hover:border-ink/30'
                      }`}
                    >
                      ✓
                    </button>
                  </form>
                </div>

                <div className="mt-4 sm:pl-9">
                  <ExerciseMedia
                    mediaType={exercise.media_type}
                    url={exercise.media_url}
                    name={exercise.name}
                  />

                  {exercise.instructions && (
                    <p className="mt-3 text-lg leading-relaxed whitespace-pre-line">
                      {exercise.instructions}
                    </p>
                  )}

                  {exercise.mode === 'time' && (
                    <InlineTimer seconds={exercise.duration_seconds ?? 30} />
                  )}

                  {/* The sets/reps target is already under the title — this line
                      only adds the rest guidance, so it isn't repeated. */}
                  {exercise.sets > 1 && exercise.rest_seconds > 0 && (
                    <p className="mt-3 text-base text-muted">
                      Rest about {exercise.rest_seconds} seconds between sets.
                    </p>
                  )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}

        {doneCount > 0 && (
          <form action={resetWorkoutForm} className="mt-8">
            <input type="hidden" name="workoutId" value={workout.id} />
            <button type="submit" className="btn-ghost w-full text-base">
              Clear my ticks on this workout
            </button>
          </form>
        )}

        <Link href={week ? `/week/${week.id}` : '/home'} className="btn-secondary mt-4 w-full">
          Back to this week
        </Link>
      </main>
    </>
  );
}
