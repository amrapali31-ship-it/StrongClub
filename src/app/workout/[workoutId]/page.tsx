import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { resetWorkoutForm, toggleExerciseForm } from '@/app/actions';
import { BackLink } from '@/components/BackLink';
import { ExerciseMedia } from '@/components/ExerciseMedia';
import { InlineTimer } from '@/components/InlineTimer';
import { ParentShell } from '@/components/ParentShell';
import { WorkoutSession } from '@/components/WorkoutSession';
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

  // The coach's section order is passed through so parents see the workout
  // laid out the way it was arranged; empty sections stay behind in the admin.
  const groups = groupExercises(exercises, workout.sections ?? []);
  // Numbered by where things actually appear, not by stored position — moving a
  // section around shouldn't leave the list counting 3, 4, 1, 2.
  const running = groups.flatMap((group) => group.exercises);
  const rounds = workout.section_rounds ?? {};

  // One line at the top so they can fetch everything before starting rather
  // than getting up halfway through. Order follows the workout, not the
  // alphabet, so the first thing listed is the first thing needed.
  const kit = [...new Set(running.map((e) => (e.equipment ?? '').trim()).filter(Boolean))];
  const showHeadings = shouldShowGroupHeadings(groups);

  return (
    <ParentShell profile={profile}>
      <BackLink
        href={week ? `/week/${week.id}` : '/home'}
        label={week ? week.title : 'This week'}
      />

      <h1 className="mt-2 flex items-center gap-3 text-3xl font-extrabold tracking-tight">
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

      {kit.length > 0 && (
        <p className="mt-4 text-base">
          <span className="font-semibold">You&rsquo;ll need:</span>{' '}
          <span className="text-muted">{kit.join(' · ')}</span>
        </p>
      )}

      <p className="mt-4 text-base text-muted">
        Work down the list at your own pace. Tick things off if you like &mdash; it&rsquo;s just so
        you can see where you got to.
      </p>

      <WorkoutSession workoutId={workout.id} title={workout.title} />

      {groups.map((group) => (
        <section key={group.category || 'other'} className="mt-8 first:mt-6">
          {showHeadings && (
            <h2 className="mb-3 flex flex-wrap items-baseline gap-2 text-sm font-bold tracking-widest text-brand uppercase">
              {group.heading}
              <span className="text-xs font-semibold tracking-normal text-muted normal-case">
                {group.exercises.length} {group.exercises.length === 1 ? 'exercise' : 'exercises'}
              </span>
              {(rounds[group.category] ?? 1) > 1 && (
                <span className="rounded-full bg-brand-tint px-2 py-0.5 text-xs font-bold tracking-normal text-brand normal-case">
                  {rounds[group.category]} rounds
                </span>
              )}
            </h2>
          )}

          {/* Supersets: the thing people get wrong is doing all their sets of
              one exercise before starting the next, so say the order out loud
              with the real names rather than describing it in the abstract. */}
          {(rounds[group.category] ?? 1) > 1 && group.exercises.length > 1 && (
            <div className="mb-3 rounded-xl2 border border-line bg-surface px-4 py-3">
              <p className="text-base">
                {/* Explicit, because a space that only exists at the end of a
                    JSX line does not survive to the page. */}
                <span className="font-semibold">Do these back to back.</span>{' '}
                Work through them in order, then straight back to the top &mdash;{' '}
                <span className="font-semibold">
                  {rounds[group.category]} times through in total.
                </span>
              </p>

              <p className="mt-2 text-base text-muted">
                So: {group.exercises.map((e) => e.name).join(', then ')}, then back to{' '}
                {group.exercises[0].name} again. Not all your sets of{' '}
                {group.exercises[0].name} before starting {group.exercises[1].name}.
              </p>

              <p className="mt-2 text-sm text-muted">Tick each one off after its last round.</p>
            </div>
          )}

          <ol className="flex flex-col gap-4">
            {group.exercises.map((exercise) => {
              const done = doneExerciseIds.has(exercise.id);
              const i = running.indexOf(exercise);

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
                      {exercise.equipment && (
                        <p className="mt-1 text-base text-muted">{exercise.equipment}</p>
                      )}
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
                            : 'border-muted/50 text-muted/25 hover:border-ink/40 hover:text-muted/50'
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

      {/* A way out at the bottom too: after scrolling eight exercises, the
          back control at the top is a long way away. */}
      <Link href={week ? `/week/${week.id}` : '/home'} className="btn-secondary mt-4 w-full">
        Back to {week ? week.title : 'this week'}
      </Link>
    </ParentShell>
  );
}
