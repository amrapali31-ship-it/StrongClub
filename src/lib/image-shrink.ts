/**
 * Shrinks images in the browser before they're posted for AI import.
 *
 * The import sends its images through the app rather than to storage, and a
 * serverless request body tops out around 4.5 MB — which one phone photo
 * clears easily and five do not. Rather than police the count, the pictures
 * are resized until they fit: the model downsamples anything above ~1568px
 * anyway, so the first step costs nothing in readable detail.
 *
 * Re-encoding to JPEG has a useful side effect: an iPhone HEIC becomes a
 * format everything can read, so photos taken on the phone stop being a
 * special case.
 */

/** Tried in order until the whole selection fits. */
const STEPS: { edge: number; quality: number }[] = [
  { edge: 1400, quality: 0.82 },
  { edge: 1100, quality: 0.75 },
  { edge: 900, quality: 0.7 },
  { edge: 700, quality: 0.6 },
];

type Decoded = { source: CanvasImageSource; width: number; height: number } | null;

async function decode(file: File): Promise<Decoded> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      return { source: bitmap, width: bitmap.width, height: bitmap.height };
    } catch {
      // Safari refuses some formats here; the <img> path below handles them.
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error(`${file.name} could not be read as an image.`));
      element.src = url;
    });
    return { source: image, width: image.naturalWidth, height: image.naturalHeight };
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function encode(decoded: NonNullable<Decoded>, name: string, edge: number, quality: number) {
  const scale = Math.min(1, edge / Math.max(decoded.width, decoded.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(decoded.width * scale));
  canvas.height = Math.max(1, Math.round(decoded.height * scale));

  const context = canvas.getContext('2d');
  if (!context) return null;
  context.drawImage(decoded.source, 0, 0, canvas.width, canvas.height);

  return new Promise<File | null>((resolve) =>
    canvas.toBlob(
      (blob) => resolve(blob ? new File([blob], `${name}.jpg`, { type: 'image/jpeg' }) : null),
      'image/jpeg',
      quality,
    ),
  );
}

export function totalBytes(files: File[]): number {
  return files.reduce((sum, file) => sum + file.size, 0);
}

/**
 * Resizes a selection so the whole lot fits inside `budget`, stepping down
 * only as far as it has to. Returns the originals untouched when they already
 * fit, and the smallest it managed if even the last step is too big — the
 * caller decides what to say about that.
 */
export async function fitWithin(files: File[], budget: number): Promise<File[]> {
  if (files.length === 0 || totalBytes(files) <= budget) return files;

  // Decoded once and drawn repeatedly: re-reading five 12MP photos for every
  // attempt is the slow part, and phones feel it.
  const decoded = await Promise.all(
    files.map(async (file) => (file.type.startsWith('image/') ? decode(file) : null)),
  );

  let best = files;
  for (const { edge, quality } of STEPS) {
    const attempt = await Promise.all(
      files.map(async (file, i) => {
        const image = decoded[i];
        if (!image) return file;
        const name = file.name.replace(/\.[^.]+$/, '') || 'image';
        const shrunk = await encode(image, name, edge, quality);
        // An already-small image can come out bigger; keep whichever wins.
        return shrunk && shrunk.size < file.size ? shrunk : file;
      }),
    );

    best = attempt;
    if (totalBytes(attempt) <= budget) break;
  }

  for (const image of decoded) {
    if (image && 'close' in image.source) (image.source as ImageBitmap).close();
  }

  return best;
}
