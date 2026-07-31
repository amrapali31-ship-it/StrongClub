import { redirect } from 'next/navigation';

import { AppHeader } from '@/components/AppHeader';
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
    <>
      <AppHeader profile={profile} />

      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-6">
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
      </main>
    </>
  );
}
