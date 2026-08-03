'use client';

import { useEffect, useRef, useState } from 'react';

import { MediaFrame, MediaThumb } from '@/components/MediaFrame';
import { youTubeId } from '@/lib/media';
import type { MediaType } from '@/lib/types';
import { uploadFile } from '@/lib/upload-client';

type Source = 'none' | 'youtube' | 'upload' | 'existing';

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
/** Small files were all rounding to "1 MB", which told you nothing. */
function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

interface Stored {
  url: string;
  mediaType: 'image' | 'video';
  bytes: number;
  uploadedAt: string;
  usedBy: string[];
}

/**
 * Everything already in storage, to attach again.
 *
 * The same clip usually demonstrates several exercises — a goblet squat and a
 * chair squat are the same thing filmed once — and this also reaches media
 * whose original exercise is long gone, which is the only way back to a video
 * after the week it belonged to was deleted.
 */
function ExistingMedia({
  selected,
  onPick,
}: {
  selected: string;
  onPick: (media: { url: string; mediaType: MediaType }) => void;
}) {
  const [media, setMedia] = useState<Stored[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const response = await fetch('/api/admin/media');
        const body = (await response.json()) as { media?: Stored[]; error?: string };
        if (!response.ok || !body.media) throw new Error(body.error ?? 'Could not load uploads.');
        if (live) setMedia(body.media);
      } catch (err) {
        if (live) setError(err instanceof Error ? err.message : 'Could not load uploads.');
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  if (error) return <p className="mt-3 text-sm font-semibold text-brand">{error}</p>;
  if (!media) return <p className="mt-3 text-sm text-muted">Looking…</p>;
  if (media.length === 0) {
    return (
      <p className="mt-3 text-sm text-muted">
        Nothing uploaded yet. Use &ldquo;Upload photo or video&rdquo; and it&rsquo;ll be here to
        reuse afterwards.
      </p>
    );
  }

  return (
    <div className="mt-3">
      <ul className="grid max-h-80 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
        {media.map((item) => {
          const mine = item.url === selected;
          return (
            <li key={item.url}>
              <button
                type="button"
                onClick={() => onPick({ url: item.url, mediaType: item.mediaType })}
                className={`w-full rounded-xl border-2 p-2 text-left transition ${
                  mine ? 'border-brand bg-brand-tint' : 'border-line hover:border-ink/25'
                }`}
              >
                <MediaThumb mediaType={item.mediaType} url={item.url} name="" />
                <p className="mt-1.5 truncate text-xs font-semibold">
                  {item.usedBy[0] ?? 'Not used yet'}
                </p>
                <p className="truncate text-xs text-muted">
                  {item.usedBy.length > 1 ? `+${item.usedBy.length - 1} more` : fileSize(item.bytes)}
                </p>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-sm text-muted">
        Reusing a clip doesn&rsquo;t copy it &mdash; both exercises point at the same file.
      </p>
    </div>
  );
}

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

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    setProgress(0);

    try {
      const result = await uploadFile(file, setProgress);
      setUrl(result.url);
      setMediaType(result.mediaType);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
      // Surfaces it in the coach-only error strip too, with the stack, so a
      // failure on a phone can be read without plugging the phone into a Mac.
      window.dispatchEvent(new ErrorEvent('error', { error: err, message: String(err) }));
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    setDragging(false);
    if (uploading) return;

    const file = event.dataTransfer.files?.[0];
    if (!file) return;

    setSource('upload');
    void upload(file);
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
            ['existing', 'Already uploaded'],
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

      {source === 'existing' && (
        <ExistingMedia
          selected={url}
          onPick={(picked) => {
            setUrl(picked.url);
            setMediaType(picked.mediaType);
          }}
        />
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
