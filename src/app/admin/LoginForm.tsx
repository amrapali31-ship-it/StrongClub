'use client';

import { useActionState } from 'react';

import { login } from '@/app/admin/actions';

export function LoginForm() {
  const [error, action, pending] = useActionState(login, null);

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
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
