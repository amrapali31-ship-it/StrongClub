import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { AppHeader } from '@/components/AppHeader';
import { WeekBoard } from '@/components/WeekBoard';
import { getActiveProfileId } from '@/lib/auth';
import { db } from '@/lib/db';
import { getWeekBoard } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default async function WeekPage({ params }: { params: Promise<{ weekId: string }> }) {
  const { weekId } = await params;

  const profileId = await getActiveProfileId();
  const profile = profileId ? await db.getProfile(profileId) : null;
  if (!profile) redirect('/');

  const week = await db.getWeek(weekId);
  if (!week || !week.published) notFound();

  const board = await getWeekBoard(week.id, profile.id);

  return (
    <>
      <AppHeader profile={profile} />

      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-6">
        <Link href="/weeks" className="mb-3 inline-block text-base font-semibold text-muted hover:text-ink">
          &larr; All weeks
        </Link>
        <WeekBoard week={week} board={board} />
      </main>
    </>
  );
}
