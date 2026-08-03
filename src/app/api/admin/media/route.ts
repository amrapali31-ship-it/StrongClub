import { NextResponse } from 'next/server';

import { isAdmin } from '@/lib/auth';
import { listStoredMedia } from '@/lib/storage';

/**
 * Everything already uploaded. Fetched only when the picker's "already
 * uploaded" tab is opened, so an exercise page doesn't pay for a bucket
 * listing it probably won't use.
 */
export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  try {
    return NextResponse.json({ media: await listStoredMedia() });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not list uploads.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
