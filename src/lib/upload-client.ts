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

/** XHR rather than fetch: only XHR can report how far along an upload is. */
function send(
  method: string,
  url: string,
  body: XMLHttpRequestBodyInit,
  headers: Record<string, string>,
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
      reject(new Error('Upload failed — check your connection and try again.')),
    );
    request.addEventListener('abort', () => reject(new Error('Upload cancelled.')));

    request.open(method, url);
    for (const [key, value] of Object.entries(headers)) request.setRequestHeader(key, value);
    request.send(body);
  });
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

  const signResponse = await fetch('/api/upload/sign', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: file.name, size: file.size, type: file.type }),
  });

  const signed = await readJson(signResponse);
  if (!signResponse.ok) throw new Error(String(signed.error ?? 'Upload failed.'));

  const mediaType = (signed.mediaType as MediaType) ?? 'image';

  if (typeof signed.uploadUrl === 'string' && typeof signed.publicUrl === 'string') {
    const result = await send(
      'PUT',
      signed.uploadUrl,
      file,
      { 'content-type': file.type },
      onProgress,
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
  const result = await send('POST', '/api/upload', body, {}, onProgress);

  let data: { url?: string; mediaType?: MediaType; error?: string } = {};
  try {
    data = JSON.parse(result.text) as typeof data;
  } catch {
    throw new Error(`Upload failed (${result.status}).`);
  }
  if (result.status >= 400 || !data.url) throw new Error(data.error ?? 'Upload failed.');

  return { url: data.url, mediaType: data.mediaType ?? mediaType };
}
