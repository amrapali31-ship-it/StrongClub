import { notFound } from 'next/navigation';

import { BackLink } from '@/components/BackLink';
import { PlanImporter } from '@/components/admin/PlanImporter';
import { db } from '@/lib/db';
import { anthropicConfigured } from '@/lib/importer';

export const dynamic = 'force-dynamic';

export default async function AdminImportWorkout({
  params,
}: {
  params: Promise<{ weekId: string }>;
}) {
  const { weekId } = await params;

  const week = await db.getWeek(weekId);
  if (!week) notFound();

  return (
    <>
      <BackLink href={`/admin/week/${week.id}`} label="Back to week" />

      <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Import a workout</h1>
      <p className="mt-1 text-muted">
        Paste one session &mdash; or photograph it &mdash; and Claude turns it into a workout in{' '}
        <span className="font-semibold text-ink">{week.title}</span>.
      </p>

      <div className="card mt-6 p-5">
        {anthropicConfigured() ? (
          <PlanImporter
            target={{ id: week.id, title: week.title, published: week.published }}
          />
        ) : (
          <>
            <p className="text-lg font-bold">Not set up yet</p>
            <p className="mt-2 text-muted">
              This needs an <code className="font-mono text-base">ANTHROPIC_API_KEY</code> in your
              environment variables. Add it in Vercel and redeploy, then this page will work.
            </p>
          </>
        )}
      </div>

      <p className="mt-6 text-sm text-muted">
        Videos are never imported &mdash; AI models invent YouTube links that look real and go
        nowhere. Attach those by hand once the workout is saved.
      </p>
    </>
  );
}
