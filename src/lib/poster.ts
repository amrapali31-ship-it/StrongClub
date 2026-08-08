/**
 * Grabbing a still out of a video, in the browser.
 *
 * Without a stored still, a browser has to fetch the video itself before it can
 * show anything — and a workout with fifteen demos then asks a phone for tens
 * of megabytes before a single thumbnail appears. One small JPEG per video
 * removes that entirely.
 */

/** Wide enough to look sharp on a phone, small enough to be a rounding error. */
const POSTER_WIDTH = 640;
const QUALITY = 0.72;

/**
 * Where to look for a usable frame, in order.
 *
 * Not the very start: the first frame of a phone recording is usually the
 * floor, a blur, or black while the camera settles.
 */
function framesToTry(duration: number): number[] {
  if (!Number.isFinite(duration) || duration <= 0) return [0.1];
  return [
    Math.min(1.5, Math.max(0.1, duration * 0.1)),
    Math.min(duration - 0.05, duration * 0.25),
    Math.min(duration - 0.05, duration * 0.5),
  ].filter((t) => t > 0);
}

/**
 * Returns a JPEG still, or null if the video can't be read.
 *
 * `crossOrigin` is set because a canvas that has drawn a cross-origin frame
 * refuses to hand the pixels back — storage sends the permissive header, so
 * asking for it is what makes the capture legal rather than tainted.
 */
// The DOM types declare this as always present; it isn't everywhere, so it's
// described here as the optional thing it really is.
type FrameCapable = Omit<HTMLVideoElement, 'requestVideoFrameCallback'> & {
  requestVideoFrameCallback?: (callback: () => void) => number;
};

/** Waits until there is genuinely a frame to draw, not merely a seek. */
function frameReady(video: FrameCapable): Promise<void> {
  return new Promise((resolve) => {
    // `seeked` fires before the frame is presented, which is how a capture
    // ends up black. This callback fires when one has actually been painted.
    if (typeof video.requestVideoFrameCallback === 'function') {
      video.requestVideoFrameCallback(() => resolve());
      // Some builds never fire it for a paused video; don't hang on them.
      setTimeout(resolve, 600);
      return;
    }
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

/** True when the canvas came back essentially blank — a fade-in, usually. */
function looksBlank(context: CanvasRenderingContext2D, width: number, height: number): boolean {
  try {
    const { data } = context.getImageData(0, 0, width, height);
    let total = 0;
    let samples = 0;
    // Every few hundred pixels is plenty to tell black from a picture.
    for (let i = 0; i < data.length; i += 4 * 997) {
      total += data[i] + data[i + 1] + data[i + 2];
      samples += 1;
    }
    return samples > 0 && total / samples < 24;
  } catch {
    return false;
  }
}

export async function capturePoster(source: File | string): Promise<Blob | null> {
  const url = typeof source === 'string' ? source : URL.createObjectURL(source);

  const video = document.createElement('video') as FrameCapable;
  video.crossOrigin = 'anonymous';
  video.preload = 'auto';
  video.muted = true;
  video.playsInline = true;

  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timed out')), 20000);
      video.onloadedmetadata = () => {
        clearTimeout(timer);
        resolve();
      };
      video.onerror = () => {
        clearTimeout(timer);
        reject(new Error('unreadable'));
      };
      video.src = url;
      video.load();
    });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return null;

    const scale = Math.min(1, POSTER_WIDTH / (video.videoWidth || POSTER_WIDTH));
    canvas.width = Math.max(1, Math.round((video.videoWidth || POSTER_WIDTH) * scale));
    canvas.height = Math.max(1, Math.round((video.videoHeight || 360) * scale));

    // A clip that fades in gives a black first frame, so try a little later
    // before settling for it.
    for (const moment of framesToTry(video.duration)) {
      const seeked = new Promise<void>((resolve) => {
        video.onseeked = () => resolve();
        setTimeout(resolve, 5000);
      });
      video.currentTime = moment;
      await seeked;
      await frameReady(video);

      context.drawImage(video as unknown as HTMLVideoElement, 0, 0, canvas.width, canvas.height);
      if (!looksBlank(context, canvas.width, canvas.height)) break;
    }

    return await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', QUALITY),
    );
  } catch {
    return null;
  } finally {
    if (typeof source !== 'string') URL.revokeObjectURL(url);
    video.removeAttribute('src');
    video.load();
  }
}

/** Names the still after the clip, so the pair is obvious in the bucket. */
export function posterFile(blob: Blob, videoName: string): File {
  const base = videoName.replace(/\.[^.]+$/, '') || 'video';
  return new File([blob], `${base}-poster.jpg`, { type: 'image/jpeg' });
}
