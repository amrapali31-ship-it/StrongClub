import { NextResponse } from 'next/server';

import { isAdmin } from '@/lib/auth';
import {
  draftWeekFromSources,
  IMPORT_IMAGE_TYPES,
  MAX_IMPORT_IMAGES,
  MAX_IMPORT_IMAGE_BYTES,
} from '@/lib/importer';

// Reading images and calling the model comfortably exceeds the default budget.
export const maxDuration = 120;

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  const formData = await request.formData();
  const text = String(formData.get('text') ?? '');
  const files = formData.getAll('images').filter((f): f is File => f instanceof File && f.size > 0);

  if (!text.trim() && files.length === 0) {
    return NextResponse.json(
      { error: 'Paste a plan or add a screenshot first.' },
      { status: 400 },
    );
  }

  if (files.length > MAX_IMPORT_IMAGES) {
    return NextResponse.json(
      { error: `Up to ${MAX_IMPORT_IMAGES} images at a time.` },
      { status: 400 },
    );
  }

  const images = [];
  for (const file of files) {
    if (!IMPORT_IMAGE_TYPES.includes(file.type as (typeof IMPORT_IMAGE_TYPES)[number])) {
      return NextResponse.json(
        { error: `${file.name} isn't an image Claude can read. Use PNG, JPG, GIF or WebP.` },
        { status: 400 },
      );
    }
    if (file.size > MAX_IMPORT_IMAGE_BYTES) {
      return NextResponse.json(
        { error: `${file.name} is over ${MAX_IMPORT_IMAGE_BYTES / 1024 / 1024} MB.` },
        { status: 400 },
      );
    }
    images.push({
      mediaType: file.type,
      base64: Buffer.from(await file.arrayBuffer()).toString('base64'),
    });
  }

  try {
    const draft = await draftWeekFromSources({ text, images });
    return NextResponse.json({ draft });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Something went wrong.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
