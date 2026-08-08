import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import { db, usingSupabase } from '@/lib/db';
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

export interface StoredMedia {
  url: string;
  mediaType: 'image' | 'video';
  bytes: number;
  uploadedAt: string;
  /** Exercises and library entries already pointing at it. */
  usedBy: string[];
  /** Its still, if any row using it has one. */
  posterUrl: string;
}

function mediaTypeFor(name: string): 'image' | 'video' | null {
  if (/\.(mp4|mov|webm|m4v)$/i.test(name)) return 'video';
  if (/\.(png|jpe?g|gif|webp|avif)$/i.test(name)) return 'image';
  return null;
}

/**
 * Everything already uploaded, newest first, labelled with what uses it.
 *
 * The same clip often demonstrates several exercises, and re-filming or
 * re-uploading it is silly. Listing the bucket rather than the rows in use
 * also means a video outlives the exercise it was attached to — which is the
 * difference between a deleted week costing you an evening and costing you
 * the filming as well.
 */
export async function listStoredMedia(): Promise<StoredMedia[]> {
  const items: Omit<StoredMedia, 'usedBy' | 'posterUrl'>[] = [];

  if (usingSupabase) {
    const sb = supabaseAdmin();
    const { data, error } = await sb.storage
      .from(MEDIA_BUCKET)
      .list('', { limit: 500, sortBy: { column: 'created_at', order: 'desc' } });
    if (error) throw new Error(`Could not list uploads: ${error.message}`);

    for (const object of data) {
      const mediaType = mediaTypeFor(object.name);
      if (!mediaType) continue;
      items.push({
        url: sb.storage.from(MEDIA_BUCKET).getPublicUrl(object.name).data.publicUrl,
        mediaType,
        bytes: Number(object.metadata?.size ?? 0),
        uploadedAt: object.created_at ?? '',
      });
    }
  } else {
    const dir = path.join(process.cwd(), 'public', 'uploads');
    let names: string[] = [];
    try {
      names = await fs.readdir(dir);
    } catch {
      return [];
    }

    for (const name of names) {
      const mediaType = mediaTypeFor(name);
      if (!mediaType) continue;
      const stat = await fs.stat(path.join(dir, name));
      items.push({
        url: `/uploads/${name}`,
        mediaType,
        bytes: stat.size,
        uploadedAt: stat.mtime.toISOString(),
      });
    }
    items.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  }

  // Labelled from what's using it, so a grid of near-identical clips is
  // actually tellable apart.
  const [exercises, library] = await Promise.all([db.listAllExercises(), db.listLibrary()]);
  const byUrl = new Map<string, string[]>();
  const posters = new Map<string, string>();
  for (const row of [...exercises, ...library]) {
    if (!row.media_url) continue;
    const names = byUrl.get(row.media_url) ?? [];
    if (!names.includes(row.name)) names.push(row.name);
    byUrl.set(row.media_url, names);
    if (row.poster_url && !posters.has(row.media_url)) {
      posters.set(row.media_url, row.poster_url);
    }
  }

  return items.map((item) => ({
    ...item,
    usedBy: byUrl.get(item.url) ?? [],
    posterUrl: posters.get(item.url) ?? '',
  }));
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
