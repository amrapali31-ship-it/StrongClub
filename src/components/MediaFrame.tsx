import { youTubeEmbedUrl } from '@/lib/media';
import type { MediaType } from '@/lib/types';

interface Props {
  mediaType: MediaType;
  url: string;
  /** Still for a video, so a thumbnail never costs a download. */
  posterUrl?: string;
  name: string;
  /** Videos loop silently on the exercise screen, but not in list previews. */
  autoPlay?: boolean;
  className?: string;
}

export function MediaFrame({
  mediaType,
  url,
  posterUrl,
  name,
  autoPlay = false,
  className = '',
}: Props) {
  const frame = `relative w-full overflow-hidden rounded-xl2 bg-ink/5 ${className}`;

  if (mediaType === 'youtube') {
    const embed = youTubeEmbedUrl(url);
    if (!embed) return <Placeholder name={name} className={className} />;
    return (
      <div className={`${frame} aspect-video`}>
        <iframe
          src={embed}
          title={`How to do ${name}`}
          className="absolute inset-0 h-full w-full"
          allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
        />
      </div>
    );
  }

  if (mediaType === 'video') {
    return (
      <div className={`${frame} aspect-video`}>
        <video
          src={url}
          poster={posterUrl || undefined}
          className="absolute inset-0 h-full w-full object-contain"
          controls
          playsInline
          loop
          muted={autoPlay}
          autoPlay={autoPlay}
          preload="metadata"
        />
      </div>
    );
  }

  if (mediaType === 'image') {
    return (
      <div className={`${frame} aspect-video`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={`How to do ${name}`}
          className="absolute inset-0 h-full w-full object-contain"
        />
      </div>
    );
  }

  return <Placeholder name={name} className={className} />;
}

function Placeholder({ name, className = '' }: { name: string; className?: string }) {
  return (
    <div
      className={`flex aspect-video w-full items-center justify-center rounded-xl2 border border-dashed border-line bg-surface ${className}`}
    >
      <p className="px-6 text-center text-base font-semibold text-muted">{name}</p>
    </div>
  );
}

/** Small square preview used in exercise lists. */
export function MediaThumb({
  mediaType,
  url,
  posterUrl,
  name,
}: Omit<Props, 'autoPlay' | 'className'>) {
  // `contain` rather than `cover` so diagrams and portrait clips stay legible
  // at thumbnail size instead of being cropped to their middle.
  const base = 'h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-ink/5 object-contain';

  if (mediaType === 'youtube') {
    const id = youTubeEmbedUrl(url)?.match(/embed\/([\w-]+)/)?.[1];
    if (id) {
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={`https://i.ytimg.com/vi/${id}/mqdefault.jpg`} alt="" className={base} />;
    }
  }

  if (mediaType === 'image') {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className={base} />;
  }

  if (mediaType === 'video') {
    // Never the video itself: a list of twenty rows would fetch twenty clips
    // to show twenty postage stamps.
    if (posterUrl) {
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={posterUrl} alt="" loading="lazy" className={base} />;
    }
    return (
      <div className={`${base} flex items-center justify-center text-lg text-muted/60`}>▶</div>
    );
  }

  return (
    <div className={`${base} flex items-center justify-center text-xl font-bold text-muted/50`}>
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}
