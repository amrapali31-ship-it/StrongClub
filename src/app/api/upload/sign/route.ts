import { NextResponse } from 'next/server';

import { isAdmin } from '@/lib/auth';
import { signUpload } from '@/lib/storage';

/**
 * Issues a one-shot URL the browser uploads to directly. Only the file's name,
 * size and type come through here — the bytes never do, which is the whole
 * point: they'd be rejected by the platform long before reaching this code.
 */
export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  let meta: { name?: unknown; size?: unknown; type?: unknown };
  try {
    meta = (await request.json()) as typeof meta;
  } catch {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
  }

  const file = {
    name: typeof meta.name === 'string' ? meta.name : '',
    size: typeof meta.size === 'number' ? meta.size : 0,
    type: typeof meta.type === 'string' ? meta.type : '',
  };

  try {
    const signed = await signUpload(file);
    const mediaType = file.type.startsWith('video/') ? 'video' : 'image';

    // No Supabase configured: the caller should post the file to /api/upload
    // instead, which writes to disk.
    return NextResponse.json(signed ? { ...signed, mediaType } : { direct: false, mediaType });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload failed.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
