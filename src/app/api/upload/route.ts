import { NextResponse } from 'next/server';

import { isAdmin } from '@/lib/auth';
import { saveUpload } from '@/lib/storage';

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file was sent.' }, { status: 400 });
  }

  try {
    const url = await saveUpload(file);
    return NextResponse.json({
      url,
      mediaType: file.type.startsWith('video/') ? 'video' : 'image',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload failed.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
