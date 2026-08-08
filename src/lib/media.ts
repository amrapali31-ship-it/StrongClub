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

/* ------------------------------------------------------------ uploads ---- */

/** 100 MB — comfortably above a two-minute phone clip, below Supabase limits. */
export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

/**
 * What the upload endpoint accepts. Lives here rather than in `storage.ts` so
 * the browser can check a dropped file before spending minutes uploading
 * something the server was always going to reject.
 */
export const ALLOWED_UPLOAD_TYPES =
  /^(image\/(png|jpeg|gif|webp|avif)|video\/(mp4|quicktime|webm))$/;

/** Returns a human-readable problem with the file, or null if it's fine. */
export function checkUpload(file: { name: string; size: number; type: string }): string | null {
  if (!file.size) return `${file.name} is empty.`;
  if (file.size > MAX_UPLOAD_BYTES) {
    const mb = Math.round(file.size / 1024 / 1024);
    return `${file.name} is ${mb} MB — keep uploads under ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`;
  }
  if (/^image\/hei[cf]$/.test(file.type)) {
    // iPhones shoot HEIC. Safari converts it to JPEG when the photo comes from
    // the Photos library, but hands it over untouched from the Files app — and
    // Android browsers can't display HEIC, so storing it would break the very
    // screen it was meant for.
    return 'That photo is in iPhone HEIC format, which some phones can\'t display. Pick it from Photos rather than Files, or take a screenshot of it and upload that.';
  }
  if (!ALLOWED_UPLOAD_TYPES.test(file.type)) {
    return `That file is a ${file.type || 'kind the browser could not identify'}. Use an image (png, jpg, gif, webp) or a video (mp4, mov, webm).`;
  }
  return null;
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
