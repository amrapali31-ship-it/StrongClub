import { notFound } from 'next/navigation';

import { BackLink } from '@/components/BackLink';
import { WorkoutGenerator } from '@/components/admin/WorkoutGenerator';
import { db } from '@/lib/db';
import { anthropicConfigured } from '@/lib/importer';

export const dynamic = 'force-dynamic';

export default async function AdminBuildWorkout({
  params,
}: {
  params: Promise<{ weekId: string }>;
}) {
  const { weekId } = await params;

  const week = await db.getWeek(weekId);
  if (!week) notFound();

  const library = await db.listLibrary();
  const withVideo = library.filter((entry) => entry.media_type !== 'none').length;

  return (
    <>
      <BackLink href={`/admin/week/${week.id}`} label="Back to week" />

      <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Build a workout</h1>
      <p className="mt-1 text-muted">
        Say what you want and Claude puts one together from your library, into{' '}
        <span className="font-semibold text-ink">{week.title}</span>.
      </p>

      <div className="card mt-6 p-5">
        {!anthropicConfigured() ? (
          <>
            <p className="text-lg font-bold">Not set up yet</p>
            <p className="mt-2 text-muted">
              This needs an <code className="font-mono text-base">ANTHROPIC_API_KEY</code> in your
              environment variables. Add it in Vercel and redeploy, then this page will work.
            </p>
          </>
        ) : library.length === 0 ? (
          <>
            <p className="text-lg font-bold">Your library is empty</p>
            <p className="mt-2 text-muted">
              This builds workouts out of your library, so there needs to be something in it first.
              Add a few exercises and come back.
            </p>
          </>
        ) : (
          <WorkoutGenerator
            target={{ id: week.id, title: week.title, published: week.published }}
          />
        )}
      </div>

      {library.length > 0 && (
        <p className="mt-6 text-sm text-muted">
          Choosing from {library.length} exercises, {withVideo} of them with a video. Anything it
          picks brings its video and your wording with it.
        </p>
      )}
    </>
  );
}
