'use client';

import { useState } from 'react';

import { capturePoster, posterFile } from '@/lib/poster';
import { uploadFile } from '@/lib/upload-client';

interface Stored {
  url: string;
  mediaType: 'image' | 'video';
  usedBy: string[];
  posterUrl: string;
}

type Stage = 'idle' | 'looking' | 'working' | 'done';

/**
 * Makes stills for videos uploaded before stills existed.
 *
 * It runs in the browser rather than on the server because capturing a frame
 * needs something that can decode video, and the phone or laptop already
 * showing this page is exactly that. It's one pass over the library, not a
 * thing to run twice — videos that already have a still are skipped.
 */
export function PosterBackfill({ save }: { save: (formData: FormData) => Promise<void> }) {
  const [stage, setStage] = useState<Stage>('idle');
  const [total, setTotal] = useState(0);
  const [done, setDone] = useState(0);
  const [made, setMade] = useState(0);
  const [failed, setFailed] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setStage('looking');
    setError(null);
    setFailed([]);
    setDone(0);
    setMade(0);

    try {
      const response = await fetch('/api/admin/media');
      const body = (await response.json()) as { media?: Stored[]; error?: string };
      if (!response.ok || !body.media) throw new Error(body.error ?? 'Could not list uploads.');

      const missing = body.media.filter((m) => m.mediaType === 'video' && !m.posterUrl);
      setTotal(missing.length);
      setStage(missing.length === 0 ? 'done' : 'working');

      for (const item of missing) {
        try {
          const still = await capturePoster(item.url);
          if (still) {
            const uploaded = await uploadFile(posterFile(still, 'clip'));
            const form = new FormData();
            form.append('mediaUrl', item.url);
            form.append('posterUrl', uploaded.url);
            await save(form);
            setMade((n) => n + 1);
          } else {
            setFailed((names) => [...names, item.usedBy[0] ?? item.url.split('/').pop() ?? '?']);
          }
        } catch {
          setFailed((names) => [...names, item.usedBy[0] ?? item.url.split('/').pop() ?? '?']);
        }
        setDone((n) => n + 1);
      }

      setStage('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not make thumbnails.');
      setStage('idle');
    }
  }

  const busy = stage === 'looking' || stage === 'working';

  return (
    <div className="card mt-6 p-4">
      <p className="font-bold">Video thumbnails</p>
      <p className="mt-1 text-sm text-muted">
        Videos uploaded from now on get a still automatically. This makes them for the ones already
        uploaded, so a workout shows pictures instead of downloading every clip to find a frame.
      </p>

      {error && <p className="mt-3 text-sm font-semibold text-brand">{error}</p>}

      {stage === 'working' && (
        <>
          <p className="mt-3 text-base font-semibold">
            {done} of {total}
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-brand transition-[width]"
              style={{ width: `${total ? (done / total) * 100 : 0}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-muted">Keep this page open. It downloads each clip once.</p>
        </>
      )}

      {stage === 'done' && (
        <p className="mt-3 text-base font-semibold">
          {made > 0 ? `Made ${made} thumbnail${made === 1 ? '' : 's'}.` : 'Nothing needed one.'}
          {failed.length > 0 && (
            <span className="block text-sm font-normal text-muted">
              {failed.length} couldn&rsquo;t be read: {failed.slice(0, 3).join(', ')}
              {failed.length > 3 ? '…' : ''}. Re-uploading those clips would fix them.
            </span>
          )}
        </p>
      )}

      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="btn-secondary mt-4 w-full text-base disabled:opacity-60"
      >
        {stage === 'looking'
          ? 'Looking…'
          : stage === 'working'
            ? 'Making thumbnails…'
            : stage === 'done'
              ? 'Run again'
              : 'Make missing thumbnails'}
      </button>
    </div>
  );
}
