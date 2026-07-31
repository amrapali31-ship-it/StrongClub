'use client';

import { useRef, useState } from 'react';

import { MediaFrame } from '@/components/MediaFrame';
import { youTubeId } from '@/lib/media';
import type { MediaType } from '@/lib/types';

type Source = 'none' | 'youtube' | 'upload';

function sourceFor(mediaType: MediaType): Source {
  if (mediaType === 'youtube') return 'youtube';
  if (mediaType === 'video' || mediaType === 'image') return 'upload';
  return 'none';
}

interface Props {
  name: string;
  defaultUrl: string;
  defaultType: MediaType;
}

/**
 * Lets the coach attach a demo either by pasting a YouTube link or by uploading
 * a clip they filmed. Emits `media_url` / `media_type` for the parent form.
 */
export function MediaPicker({ name, defaultUrl, defaultType }: Props) {
  const [source, setSource] = useState<Source>(sourceFor(defaultType));
  const [url, setUrl] = useState(defaultUrl);
  const [mediaType, setMediaType] = useState<MediaType>(defaultType);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const effectiveUrl = source === 'none' ? '' : url;
  const effectiveType: MediaType =
    source === 'none' ? 'none' : source === 'youtube' ? 'youtube' : mediaType;

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.append('file', file);
      const response = await fetch('/api/upload', { method: 'POST', body });
      const data = (await response.json()) as { url?: string; mediaType?: MediaType; error?: string };

      if (!response.ok || !data.url) throw new Error(data.error ?? 'Upload failed.');

      setUrl(data.url);
      setMediaType(data.mediaType ?? 'image');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  const youTubeValid = source !== 'youtube' || !url.trim() || Boolean(youTubeId(url));

  return (
    <div>
      <span className="label">Video or photo demo</span>

      <input type="hidden" name="media_url" value={effectiveUrl} />
      <input type="hidden" name="media_type" value={effectiveType} />

      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Demo source">
        {(
          [
            ['youtube', 'YouTube link'],
            ['upload', 'Upload photo or video'],
            ['none', 'No demo'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={source === value}
            onClick={() => setSource(value)}
            className={`rounded-xl border-2 px-4 py-2 text-sm font-semibold transition ${
              source === value
                ? 'border-brand bg-brand-tint text-brand'
                : 'border-line bg-surface text-muted hover:border-ink/25'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {source === 'youtube' && (
        <div className="mt-3">
          <input
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setMediaType('youtube');
            }}
            placeholder="https://www.youtube.com/watch?v=…"
            inputMode="url"
            className="field"
            aria-label="YouTube link"
          />
          {!youTubeValid && (
            <p className="mt-2 text-sm font-semibold text-brand">
              That doesn&rsquo;t look like a YouTube link.
            </p>
          )}
        </div>
      )}

      {source === 'upload' && (
        <div className="mt-3">
          <input
            ref={fileInput}
            type="file"
            accept="image/*,video/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
            }}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={uploading}
            className="btn-secondary w-full text-base disabled:opacity-60"
          >
            {uploading ? 'Uploading…' : url ? 'Replace file' : 'Choose a photo or video'}
          </button>
          <p className="mt-2 text-sm text-muted">
            Film it on your phone and upload straight from here. Up to 100 MB.
          </p>
          {error && <p className="mt-2 text-sm font-semibold text-brand">{error}</p>}
        </div>
      )}

      {source !== 'none' && effectiveUrl && (
        <div className="mt-4 max-w-sm">
          <MediaFrame mediaType={effectiveType} url={effectiveUrl} name={name || 'Preview'} />
        </div>
      )}
    </div>
  );
}
