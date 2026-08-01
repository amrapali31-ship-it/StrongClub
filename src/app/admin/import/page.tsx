
import { BackLink } from '@/components/BackLink';
import { PlanImporter } from '@/components/admin/PlanImporter';
import { anthropicConfigured } from '@/lib/importer';

export const dynamic = 'force-dynamic';

export default function AdminImport() {
  return (
    <>
      <BackLink href="/admin" label="All weeks" />

      <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Import a week</h1>
      <p className="mt-1 text-muted">
        Paste a plan or drop in photos, and Claude turns it into workouts you can edit.
      </p>

      <div className="card mt-6 p-5">
        {anthropicConfigured() ? (
          <PlanImporter />
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
        nowhere. Attach those by hand once the week is saved.
      </p>
    </>
  );
}
