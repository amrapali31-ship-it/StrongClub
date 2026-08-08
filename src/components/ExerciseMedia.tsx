'use client';

import { useState } from 'react';

import { youTubeEmbedUrl, youTubeId } from '@/lib/media';
import type { MediaType } from '@/lib/types';

interface Props {
  mediaType: MediaType;
  url: string;
  posterUrl?: string;
  name: string;
}

/**
 * Shows the demo on the workout page.
 *
 * Nothing heavy loads until it's asked for. A workout can hold fifteen demos,
 * and letting each one preload turns opening the page into a fifty-megabyte
 * download that shows nothing while it runs — which is exactly how it looked
 * on a phone. A still and a play button cost a few kilobytes; the video itself
 * arrives on the tap that wants it.
 */
export function ExerciseMedia({ mediaType, url, posterUrl, name }: Props) {
  const [playing, setPlaying] = useState(false);

  if (mediaType === 'none' || !url) return null;

  const frame = 'relative aspect-video w-full overflow-hidden rounded-xl2 bg-ink/5';

  if (mediaType === 'youtube') {
    const id = youTubeId(url);
    const embed = youTubeEmbedUrl(url);
    if (!id || !embed) return null;

    return playing ? (
      <div className={frame}>
        <iframe
          src={`${embed}&autoplay=1`}
          title={`How to do ${name}`}
          className="absolute inset-0 h-full w-full"
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
        />
      </div>
    ) : (
      <PlayPoster
        frame={frame}
        poster={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
        name={name}
        onPlay={() => setPlaying(true)}
      />
    );
  }

  if (mediaType === 'video') {
    return playing ? (
      <div className={frame}>
        <video
          src={url}
          poster={posterUrl || undefined}
          className="absolute inset-0 h-full w-full object-contain"
          controls
          autoPlay
          playsInline
          loop
          preload="auto"
        />
      </div>
    ) : (
      <PlayPoster frame={frame} poster={posterUrl} name={name} onPlay={() => setPlaying(true)} />
    );
  }

  return (
    <div className={frame}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={`How to do ${name}`}
        loading="lazy"
        className="absolute inset-0 h-full w-full object-contain"
      />
    </div>
  );
}

/**
 * The still, with something obvious to press. Doubles as the empty state: a
 * video with no still yet still gets a proper play button rather than a black
 * rectangle that looks broken.
 */
function PlayPoster({
  frame,
  poster,
  name,
  onPlay,
}: {
  frame: string;
  poster?: string;
  name: string;
  onPlay: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPlay}
      className={`${frame} group block`}
      aria-label={`Play video: how to do ${name}`}
    >
      {poster ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={poster}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <span className="absolute inset-0 bg-surface" />
      )}

      <span className="absolute inset-0 flex items-center justify-center bg-ink/25 transition group-hover:bg-ink/35">
        {/* text-canvas, not text-ink: on this dark theme "ink" is near-white,
            which on a white disc is an invisible triangle. */}
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/95 pl-1 text-2xl text-canvas shadow-lg">
          ▶
        </span>
      </span>
    </button>
  );
}
