'use client';

import { useEffect, useState } from 'react';

interface Caught {
  name: string;
  message: string;
  where: string;
  stack: string;
}

/**
 * A console for a phone that isn't plugged into anything.
 *
 * Safari's Web Inspector needs a cable, an unlocked device and the page in the
 * foreground, which is a lot to ask of someone who just wants to know why the
 * photo didn't upload. This catches what the console would have shown and puts
 * it on the screen, in the coach area only — a parent should never meet it.
 */
export function ErrorWatch() {
  const [caught, setCaught] = useState<Caught | null>(null);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const record = (name: string, message: string, where: string, stack?: string) => {
      // An error we caught and re-reported has no filename of its own, so fall
      // back to the top of its stack — which is the line worth reading anyway.
      const located =
        where.startsWith('unknown') || where.includes(':0:0')
          ? (stack?.split('\n').find((line) => line.includes('http'))?.trim() ?? where)
          : where;
      setCaught((current) => current ?? { name, message, where: located, stack: stack ?? '' });
    };

    const onError = (event: ErrorEvent) => {
      const error = event.error as Error | undefined;
      record(
        error?.name ?? 'Error',
        error?.message ?? event.message,
        // The file and line are the whole point — that's what says whose code
        // this is, and it's exactly what a screenshot of a message can't tell.
        `${event.filename ?? 'unknown'}:${event.lineno ?? 0}:${event.colno ?? 0}`,
        error?.stack,
      );
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason as Error | string | undefined;
      if (reason instanceof Error) {
        record(reason.name, reason.message, 'unhandled rejection', reason.stack);
      } else {
        record('UnhandledRejection', String(reason), 'unhandled rejection');
      }
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  if (!caught) return null;

  const full = [
    `${caught.name}: ${caught.message}`,
    `at ${caught.where}`,
    caught.stack,
    `page: ${window.location.pathname}`,
    `ua: ${navigator.userAgent}`,
  ]
    .filter(Boolean)
    .join('\n');

  return (
    <div className="fixed inset-x-0 bottom-16 z-40 mx-auto w-full max-w-3xl px-3 pb-2">
      <div className="rounded-xl2 border-2 border-brand bg-canvas p-3 shadow-2xl">
        <div className="flex items-start gap-2">
          <p className="min-w-0 flex-1 text-sm font-bold text-brand">
            {caught.name}: {caught.message}
          </p>
          <button
            type="button"
            onClick={() => setCaught(null)}
            aria-label="Dismiss"
            className="shrink-0 px-2 text-lg leading-none text-muted"
          >
            ×
          </button>
        </div>

        <p className="mt-1 font-mono text-xs break-all text-muted">{caught.where}</p>

        {open && (
          <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-surface p-2 font-mono text-[11px] whitespace-pre-wrap text-muted">
            {full}
          </pre>
        )}

        <div className="mt-2 flex gap-3">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="text-sm font-semibold text-muted"
          >
            {open ? 'Hide details' : 'Show details'}
          </button>
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(full);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch {
                setOpen(true);
              }
            }}
            className="text-sm font-semibold text-brand"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
    </div>
  );
}
