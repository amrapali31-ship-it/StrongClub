'use client';

import { useRef, useState, useTransition } from 'react';

import { checkUpload } from '@/lib/media';
import type { Profile } from '@/lib/types';

/**
 * Tap a person's avatar to give them a photo. Uploads through the same endpoint
 * as exercise media, then hands the URL to a server action.
 */
export function ProfilePhoto({
  profile,
  save,
}: {
  profile: Profile;
  save: (formData: FormData) => Promise<void>;
}) {
  const [photo, setPhoto] = useState(profile.photo_url);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  function persist(url: string) {
    const body = new FormData();
    body.append('profileId', profile.id);
    body.append('photo_url', url);
    startTransition(async () => {
      await save(body);
    });
  }

  async function upload(file: File) {
    // Photos only here — a video makes no sense as an avatar.
    const problem = checkUpload(file) ?? (file.type.startsWith('image/') ? null : 'Pick a photo.');
    if (problem) {
      setError(problem);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.append('file', file);
      const response = await fetch('/api/upload', { method: 'POST', body });
      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url) throw new Error(data.error ?? 'Upload failed.');

      setPhoto(data.url);
      persist(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
        }}
        className="hidden"
      />

      <button
        type="button"
        onClick={() => fileInput.current?.click()}
        disabled={busy}
        aria-label={photo ? `Change ${profile.name}'s photo` : `Add a photo for ${profile.name}`}
        className="relative shrink-0 rounded-full transition hover:opacity-80 disabled:opacity-50"
      >
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" className="h-12 w-12 rounded-full object-cover" />
        ) : (
          <span
            className="flex h-12 w-12 items-center justify-center rounded-full text-base font-bold text-white"
            style={{ backgroundColor: profile.color }}
          >
            {profile.name.slice(0, 1).toUpperCase()}
          </span>
        )}
        <span className="absolute -right-1 -bottom-1 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-[10px] font-bold text-canvas">
          {busy ? '…' : '+'}
        </span>
      </button>

      <div className="min-w-0 flex-1">
        <p className="font-semibold">{profile.name}</p>
        {error ? (
          <p className="text-sm font-semibold text-brand">{error}</p>
        ) : photo ? (
          <button
            type="button"
            onClick={() => {
              setPhoto('');
              persist('');
            }}
            className="text-sm text-muted hover:text-ink"
          >
            Remove photo
          </button>
        ) : (
          <p className="text-sm text-muted">Tap to add a photo</p>
        )}
      </div>
    </div>
  );
}
