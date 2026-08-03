'use client';

import { useState } from 'react';

import { firstFrame, youTubeEmbedUrl, youTubeId } from '@/lib/media';
import type { MediaType } from '@/lib/types';

interface Props {
  mediaType: MediaType;
  url: string;
  name: string;
}

/**
 * Shows the demo inline on the workout page. YouTube starts as a still image
 * and only loads the player when tapped — six embeds loading at once would be
 * slow and heavy on mobile data, and most exercises get watched once.
 */
export function ExerciseMedia({ mediaType, url, name }: Props) {
  const [playing, setPlaying] = useState(false);

  if (mediaType === 'none' || !url) return null;

  const frame = 'relative aspect-video w-full overflow-hidden rounded-xl2 bg-ink/5';

  if (mediaType === 'youtube') {
    const id = youTubeId(url);
    const embed = youTubeEmbedUrl(url);
    if (!id || !embed) return null;

    if (!playing) {
      return (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          className={`${frame} group block`}
          aria-label={`Play video: how to do ${name}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
            alt=""
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <span className="absolute inset-0 flex items-center justify-center bg-ink/25 transition group-hover:bg-ink/35">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/95 pl-1 text-2xl text-ink shadow-lg">
              ▶
            </span>
          </span>
        </button>
      );
    }

    return (
      <div className={frame}>
        <iframe
          src={`${embed}&autoplay=1`}
          title={`How to do ${name}`}
          className="absolute inset-0 h-full w-full"
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
        />
      </div>
    );
  }

  if (mediaType === 'video') {
    return (
      <div className={frame}>
        <video
          src={firstFrame(url)}
          className="absolute inset-0 h-full w-full object-contain"
          controls
          playsInline
          loop
          preload="metadata"
        />
      </div>
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
