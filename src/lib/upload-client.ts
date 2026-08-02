import { checkUpload } from '@/lib/media';
import type { MediaType } from '@/lib/types';

export interface Uploaded {
  url: string;
  mediaType: MediaType;
}

/**
 * A response that isn't JSON is the interesting case, not the boring one: a
 * body too large for the platform comes back as a plain-text error page, and
 * blindly parsing it produces "unexpected identifier" instead of anything a
 * person could act on.
 */
async function readJson(response: Response): Promise<Record<string, unknown>> {
  const body = await response.text();
  try {
    return JSON.parse(body) as Record<string, unknown>;
  } catch {
    throw new Error(
      response.status === 413
        ? 'That file is too big to send this way.'
        : `Upload failed (${response.status}). ${body.slice(0, 80)}`.trim(),
    );
  }
}

/**
 * XHR rather than fetch: only XHR can report how far along an upload is.
 *
 * No Content-Type is set by hand. Sending a File makes the browser derive one
 * from the file itself, and `setRequestHeader` is picky enough about its value
 * that Safari answers a bad one with "the string did not match the expected
 * pattern" — a sentence that tells whoever's holding the phone nothing at all.
 */
function send(
  method: string,
  url: string,
  body: XMLHttpRequestBodyInit,
  onProgress: (percent: number) => void,
): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();

    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    });
    request.addEventListener('load', () =>
      resolve({ status: request.status, text: request.responseText }),
    );
    request.addEventListener('error', () =>
      reject(new Error('The connection dropped during the upload. Try again.')),
    );
    request.addEventListener('abort', () => reject(new Error('Upload cancelled.')));
    request.addEventListener('timeout', () =>
      reject(new Error('The upload timed out. On a slow connection, try a smaller file.')),
    );

    try {
      request.open(method, url);
    } catch (error) {
      reject(new Error(`Could not start the upload: ${describe(error)}`));
      return;
    }

    request.send(body);
  });
}

/** Browser exceptions vary wildly in wording; keep whatever detail there is. */
function describe(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

/**
 * Names the step that failed.
 *
 * A bare browser message ("the string did not match the expected pattern")
 * is untraceable once it reaches someone standing in a kitchen with a phone.
 * Prefixing it with the step turns a mystery into something reportable.
 */
async function step<T>(what: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    const message = describe(error);
    // Errors we raised ourselves already read as sentences; don't double up.
    throw new Error(message.includes(what) ? message : `${what}: ${message}`);
  }
}

/**
 * Uploads a photo or video and returns where it ended up.
 *
 * Against Supabase the file goes straight to storage using a URL signed by the
 * server, so a phone video never has to squeeze through a serverless function.
 * Locally there's nothing to sign and the file is posted to the app instead.
 */
export async function uploadFile(
  file: File,
  onProgress: (percent: number) => void = () => {},
): Promise<Uploaded> {
  const problem = checkUpload(file);
  if (problem) throw new Error(problem);

  const signed = await step('Preparing the upload', async () => {
    const response = await fetch('/api/upload/sign', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: file.name, size: file.size, type: file.type }),
    });

    const body = await readJson(response);
    if (!response.ok) throw new Error(String(body.error ?? 'Upload failed.'));
    return body;
  });

  const mediaType = (signed.mediaType as MediaType) ?? 'image';

  if (typeof signed.uploadUrl === 'string' && typeof signed.publicUrl === 'string') {
    const uploadUrl = signed.uploadUrl;
    const result = await step('Sending the file', () =>
      send('PUT', uploadUrl, file, onProgress),
    );

    if (result.status >= 400) {
      let message = `Storage rejected the file (${result.status}).`;
      try {
        const body = JSON.parse(result.text) as { message?: string; error?: string };
        if (body.message ?? body.error) message = String(body.message ?? body.error);
      } catch {
        // Non-JSON from storage: the status code is all we have to go on.
      }
      if (result.status === 413) {
        message = 'Storage says that file is too large. Try a shorter or smaller clip.';
      }
      throw new Error(message);
    }

    return { url: signed.publicUrl, mediaType };
  }

  // Local development: no storage to sign for, so the app takes the bytes.
  const body = new FormData();
  body.append('file', file);
  const result = await step('Sending the file', () =>
    send('POST', '/api/upload', body, onProgress),
  );

  let data: { url?: string; mediaType?: MediaType; error?: string } = {};
  try {
    data = JSON.parse(result.text) as typeof data;
  } catch {
    throw new Error(`Upload failed (${result.status}).`);
  }
  if (result.status >= 400 || !data.url) throw new Error(data.error ?? 'Upload failed.');

  return { url: data.url, mediaType: data.mediaType ?? mediaType };
}
