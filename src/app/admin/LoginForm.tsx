'use client';

import { useActionState } from 'react';

import { login } from '@/app/admin/actions';
import { BackLink } from '@/components/BackLink';

export function LoginForm({ passcodeIsSet }: { passcodeIsSet: boolean }) {
  const [error, action, pending] = useActionState(login, null);

  if (!passcodeIsSet) {
    return (
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
        <div className="mb-6">
          <BackLink href="/" label="Back" />
        </div>
        <h1 className="text-center text-3xl font-extrabold tracking-tight">Admin is locked</h1>
        <p className="mt-4 text-center text-lg text-muted">
          No <code className="font-mono text-base">ADMIN_PASSCODE</code> is set on this deployment,
          so nobody can sign in.
        </p>
        <p className="mt-4 text-center text-muted">
          Set it in your hosting provider&rsquo;s environment variables and redeploy. The workouts
          themselves are unaffected.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
      <div className="mb-6">
        <BackLink href="/" label="Back" />
      </div>
      <h1 className="text-center text-3xl font-extrabold tracking-tight">Coach sign in</h1>
      <p className="mt-2 text-center text-muted">Enter your passcode to edit workouts.</p>

      <form action={action} className="mt-8">
        <label htmlFor="passcode" className="label">
          Passcode
        </label>
        <input
          id="passcode"
          name="passcode"
          type="password"
          autoComplete="current-password"
          autoFocus
          className="field"
        />

        {error && <p className="mt-3 text-base font-semibold text-brand">{error}</p>}

        <button type="submit" disabled={pending} className="btn-primary mt-6 w-full disabled:opacity-60">
          {pending ? 'Checking…' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}
