import type { ExerciseMode, MediaType } from '@/lib/types';

/**
 * Pulls the video id out of the YouTube URL shapes people actually paste:
 * watch links, youtu.be short links, /shorts/, /embed/, and live links.
 */
export function youTubeId(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  // A bare 11-character id, in case someone pastes just that.
  if (/^[\w-]{11}$/.test(trimmed)) return trimmed;

  let parsed: URL;
  try {
    parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }

  const host = parsed.hostname.replace(/^www\./, '');
  if (host === 'youtu.be') {
    return parsed.pathname.slice(1).split('/')[0] || null;
  }
  if (!host.endsWith('youtube.com')) return null;

  const v = parsed.searchParams.get('v');
  if (v) return v;

  const match = parsed.pathname.match(/^\/(?:shorts|embed|live|v)\/([\w-]+)/);
  return match?.[1] ?? null;
}

export function youTubeEmbedUrl(url: string): string | null {
  const id = youTubeId(url);
  if (!id) return null;
  // `playsinline` keeps iOS from hijacking into fullscreen mid-workout.
  return `https://www.youtube-nocookie.com/embed/${id}?rel=0&playsinline=1&modestbranding=1`;
}

export function youTubeThumbnail(url: string): string | null {
  const id = youTubeId(url);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}

/** Best guess at how to render a media URL, used when saving an exercise. */
export function detectMediaType(url: string): MediaType {
  if (!url.trim()) return 'none';
  if (youTubeId(url)) return 'youtube';
  if (/\.(mp4|mov|webm|m4v)(\?|$)/i.test(url)) return 'video';
  if (/\.(png|jpe?g|gif|webp|avif)(\?|$)/i.test(url)) return 'image';
  return 'image';
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} sec`;
  const mins = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${mins} min ${rest} sec` : `${mins} min`;
}

/** "12 reps" / "45 sec" — the headline number on the exercise screen. */
export function targetLabel(exercise: {
  mode: ExerciseMode;
  reps: number | null;
  duration_seconds: number | null;
}): string {
  if (exercise.mode === 'time') return formatDuration(exercise.duration_seconds ?? 30);
  const reps = exercise.reps ?? 0;
  return `${reps} ${reps === 1 ? 'rep' : 'reps'}`;
}

/** "3 sets of 12 reps" — the fuller sentence used in lists. */
export function setsLabel(exercise: {
  mode: ExerciseMode;
  sets: number;
  reps: number | null;
  duration_seconds: number | null;
}): string {
  const target = targetLabel(exercise);
  return exercise.sets > 1 ? `${exercise.sets} sets of ${target}` : target;
}
