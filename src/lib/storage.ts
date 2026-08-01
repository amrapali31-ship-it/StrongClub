import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import { usingSupabase } from '@/lib/db';
import { supabaseAdmin } from '@/lib/db/supabase';
// Limits are shared with the browser so a dropped file can be rejected before
// it's uploaded rather than after.
import { ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_BYTES } from '@/lib/media';

export const MEDIA_BUCKET = 'workout-media';

export { MAX_UPLOAD_BYTES };

function safeExtension(file: { name: string }): string {
  const ext = path.extname(file.name).toLowerCase();
  return /^\.[a-z0-9]{1,5}$/.test(ext) ? ext : '';
}

/** Shared gatekeeping, whichever way the bytes end up travelling. */
function reject(file: { name: string; size: number; type: string }): string | null {
  if (!file.size) return 'That file was empty.';
  if (file.size > MAX_UPLOAD_BYTES) {
    return `That file is too big. Keep uploads under ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`;
  }
  if (!ALLOWED_UPLOAD_TYPES.test(file.type)) {
    return 'Only images (png, jpg, gif, webp) and videos (mp4, mov, webm) can be uploaded.';
  }
  return null;
}

export interface SignedUpload {
  /** PUT the file straight here. The token is in the query string. */
  uploadUrl: string;
  /** Where it will be readable once the PUT succeeds. */
  publicUrl: string;
}

/**
 * Hands the browser a one-shot URL to upload to.
 *
 * The bytes have to bypass this app entirely: a serverless function tops out
 * around 4.5 MB of request body, which a phone video passes without trying,
 * and the failure arrives as an HTML error page rather than anything the
 * uploader can explain. Signing here keeps the service key server-side while
 * the file goes straight to storage.
 *
 * Returns null when there's no Supabase configured — local development writes
 * through the app instead, where no such limit exists.
 */
export async function signUpload(file: {
  name: string;
  size: number;
  type: string;
}): Promise<SignedUpload | null> {
  const problem = reject(file);
  if (problem) throw new Error(problem);
  if (!usingSupabase) return null;

  const name = `${randomUUID()}${safeExtension(file)}`;
  const sb = supabaseAdmin();

  const { data, error } = await sb.storage.from(MEDIA_BUCKET).createSignedUploadUrl(name);
  if (error) throw new Error(`Could not start the upload: ${error.message}`);

  return {
    uploadUrl: data.signedUrl,
    publicUrl: sb.storage.from(MEDIA_BUCKET).getPublicUrl(name).data.publicUrl,
  };
}

/**
 * Stores an uploaded photo or video and returns a URL the app can render.
 * Uses Supabase Storage in production, `public/uploads` when running locally
 * against the JSON store.
 */
export async function saveUpload(file: File): Promise<string> {
  const problem = reject(file);
  if (problem) throw new Error(problem);

  const name = `${randomUUID()}${safeExtension(file)}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  if (usingSupabase) {
    const sb = supabaseAdmin();
    const { error } = await sb.storage
      .from(MEDIA_BUCKET)
      .upload(name, bytes, { contentType: file.type, upsert: false });
    if (error) throw new Error(`Upload failed: ${error.message}`);

    const { data } = sb.storage.from(MEDIA_BUCKET).getPublicUrl(name);
    return data.publicUrl;
  }

  const dir = path.join(process.cwd(), 'public', 'uploads');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, name), bytes);
  return `/uploads/${name}`;
}
