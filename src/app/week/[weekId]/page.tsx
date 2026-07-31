import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { AppHeader } from '@/components/AppHeader';
import { WeekBoard } from '@/components/WeekBoard';
import { getActiveProfileId } from '@/lib/auth';
import { db } from '@/lib/db';
import { getWeekBoard, getWeekNeighbours, relativeWeekLabel } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default async function WeekPage({ params }: { params: Promise<{ weekId: string }> }) {
  const { weekId } = await params;

  const profileId = await getActiveProfileId();
  const profile = profileId ? await db.getProfile(profileId) : null;
  if (!profile) redirect('/');

  const week = await db.getWeek(weekId);
  if (!week || !week.published) notFound();

  const [board, { previous, next }] = await Promise.all([
    getWeekBoard(week.id, profile.id),
    getWeekNeighbours(week.id),
  ]);

  const isCurrent = relativeWeekLabel(week.start_date) === 'This week';

  return (
    <>
      <AppHeader profile={profile} />

      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-6">
        <WeekBoard week={week} board={board} previous={previous} next={next} />

        {!isCurrent && (
          <Link href="/home" className="btn-secondary mt-6 w-full text-base">
            Back to this week
          </Link>
        )}
      </main>
    </>
  );
}
