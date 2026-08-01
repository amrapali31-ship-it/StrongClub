import { redirect } from 'next/navigation';

import { ParentShell } from '@/components/ParentShell';
import { WeekBoard } from '@/components/WeekBoard';
import { getActiveProfileId } from '@/lib/auth';
import { db } from '@/lib/db';
import { getWeekBoard, getWeekNeighbours } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const profileId = await getActiveProfileId();
  const profile = profileId ? await db.getProfile(profileId) : null;
  if (!profile) redirect('/');

  const { current, previous, next } = await getWeekNeighbours();
  const board = current ? await getWeekBoard(current.id, profile.id) : [];

  return (
    <ParentShell profile={profile}>
      {current ? (
        <WeekBoard week={current} board={board} previous={previous} next={next} />
      ) : (
        <div className="card mt-10 p-8 text-center">
          <p className="text-xl font-bold">No workouts yet</p>
          <p className="mt-2 text-muted">
            Once this week&rsquo;s plan is published it&rsquo;ll show up right here.
          </p>
        </div>
      )}
    </ParentShell>
  );
}
