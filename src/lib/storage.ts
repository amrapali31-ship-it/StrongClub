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

function safeExtension(file: File): string {
  const ext = path.extname(file.name).toLowerCase();
  return /^\.[a-z0-9]{1,5}$/.test(ext) ? ext : '';
}

/**
 * Stores an uploaded photo or video and returns a URL the app can render.
 * Uses Supabase Storage in production, `public/uploads` when running locally
 * against the JSON store.
 */
export async function saveUpload(file: File): Promise<string> {
  if (!file.size) throw new Error('That file was empty.');
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`That file is too big. Keep uploads under ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`);
  }
  if (!ALLOWED_UPLOAD_TYPES.test(file.type)) {
    throw new Error('Only images (png, jpg, gif, webp) and videos (mp4, mov, webm) can be uploaded.');
  }

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
