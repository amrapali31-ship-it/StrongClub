import Link from 'next/link';
import { redirect } from 'next/navigation';

import { AppHeader } from '@/components/AppHeader';
import { WeekBoard } from '@/components/WeekBoard';
import { getActiveProfileId } from '@/lib/auth';
import { db } from '@/lib/db';
import { getCurrentWeek, getWeekBoard } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const profileId = await getActiveProfileId();
  const profile = profileId ? await db.getProfile(profileId) : null;
  if (!profile) redirect('/');

  const week = await getCurrentWeek();
  const board = week ? await getWeekBoard(week.id, profile.id) : [];
  const publishedWeeks = await db.listWeeks({ publishedOnly: true });

  return (
    <>
      <AppHeader profile={profile} />

      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-6">
        {week ? (
          <WeekBoard week={week} board={board} />
        ) : (
          <div className="card mt-10 p-8 text-center">
            <p className="text-xl font-bold">No workouts yet</p>
            <p className="mt-2 text-muted">
              Once this week&rsquo;s plan is published it&rsquo;ll show up right here.
            </p>
          </div>
        )}

        {publishedWeeks.length > 1 && (
          <Link
            href="/weeks"
            className="btn-secondary mt-6 w-full text-base"
          >
            Earlier weeks
          </Link>
        )}
      </main>
    </>
  );
}
