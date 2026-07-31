'use client';

import { useRef, useState } from 'react';

import { MediaFrame } from '@/components/MediaFrame';
import { checkUpload, youTubeId } from '@/lib/media';
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
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const effectiveUrl = source === 'none' ? '' : url;
  const effectiveType: MediaType =
    source === 'none' ? 'none' : source === 'youtube' ? 'youtube' : mediaType;

  function upload(file: File) {
    const problem = checkUpload(file);
    if (problem) {
      setError(problem);
      return;
    }

    setUploading(true);
    setError(null);
    setProgress(0);

    // XHR rather than fetch: a phone video can take a while over mobile data,
    // and fetch can't report how far along an upload is.
    const request = new XMLHttpRequest();
    const body = new FormData();
    body.append('file', file);

    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) setProgress(Math.round((event.loaded / event.total) * 100));
    });

    request.addEventListener('load', () => {
      setUploading(false);
      try {
        const data = JSON.parse(request.responseText) as {
          url?: string;
          mediaType?: MediaType;
          error?: string;
        };
        if (request.status >= 400 || !data.url) throw new Error(data.error ?? 'Upload failed.');
        setUrl(data.url);
        setMediaType(data.mediaType ?? 'image');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed.');
      }
    });

    request.addEventListener('error', () => {
      setUploading(false);
      setError('Upload failed — check your connection and try again.');
    });

    request.open('POST', '/api/upload');
    request.send(body);
  }

  function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    setDragging(false);
    if (uploading) return;

    const file = event.dataTransfer.files?.[0];
    if (!file) return;

    setSource('upload');
    upload(file);
  }

  const youTubeValid = source !== 'youtube' || !url.trim() || Boolean(youTubeId(url));

  return (
    <div
      // Drops are accepted anywhere in this block, not just on the upload tab —
      // dropping a video is a clear enough intent to switch to it.
      onDragOver={(e) => {
        e.preventDefault();
        if (!uploading) setDragging(true);
      }}
      onDragLeave={(e) => {
        // Ignore the leave events fired when crossing between children.
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={handleDrop}
      className={
        dragging && source !== 'upload' ? 'rounded-xl2 ring-2 ring-brand ring-offset-4 ring-offset-surface' : ''
      }
    >
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
              if (file) upload(file);
            }}
            className="hidden"
          />

          {/* The whole area is a drop target; the button inside keeps it usable
              on a phone, where there's nothing to drag from. */}
          <div
            className={`rounded-xl2 border-2 border-dashed p-5 text-center transition ${
              dragging ? 'border-brand bg-brand-tint' : 'border-line'
            }`}
          >
            {uploading ? (
              <>
                <p className="text-base font-semibold">Uploading… {progress}%</p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-line">
                  <div
                    className="h-full rounded-full bg-brand transition-[width]"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="mt-2 text-sm text-muted">
                  Large videos take a minute. Keep this page open.
                </p>
              </>
            ) : (
              <>
                <p className="text-base font-semibold">
                  {dragging ? 'Drop it here' : 'Drag a photo or video here'}
                </p>
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  className="btn-secondary mt-3 w-full text-base"
                >
                  {url ? 'Replace file' : 'Or choose a file'}
                </button>
                <p className="mt-2 text-sm text-muted">
                  Film it on your phone and upload straight from here. Up to 100 MB.
                </p>
              </>
            )}
          </div>

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
