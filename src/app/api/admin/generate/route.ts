import { NextResponse } from 'next/server';

import { isAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { composeWorkout, type StyleExample } from '@/lib/importer';
import { groupExercises } from '@/lib/ordering';

// Composing takes a while; the default budget isn't enough.
export const maxDuration = 120;

/** How many past workouts to show as a guide to the coach's style. */
const EXAMPLES = 4;

/**
 * Summarises workouts the coach has already built, so a generated one reads
 * like theirs rather than like a magazine plan — their section names, their
 * structure, their idea of how hard a session should be.
 */
async function recentStyle(): Promise<StyleExample[]> {
  const weeks = await db.listWeeks();
  const examples: StyleExample[] = [];

  for (const week of weeks) {
    for (const workout of await db.listWorkouts(week.id)) {
      const exercises = await db.listExercises(workout.id);
      if (exercises.length === 0) continue;

      const rounds = workout.section_rounds ?? {};
      examples.push({
        title: workout.title,
        sections: groupExercises(exercises, workout.sections ?? []).map((group) => ({
          name: group.heading,
          rounds: rounds[group.category] ?? 1,
          exercises: group.exercises.map((exercise) => exercise.name),
        })),
      });

      if (examples.length >= EXAMPLES) return examples;
    }
  }

  return examples;
}

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  let body: { request?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
  }

  const asked = typeof body.request === 'string' ? body.request.trim() : '';
  if (!asked) {
    return NextResponse.json({ error: 'Say what you want building.' }, { status: 400 });
  }

  try {
    const library = (await db.listLibrary()).map((entry) => ({
      id: entry.id,
      name: entry.name,
      category: entry.category,
      equipment: entry.equipment,
      hasMedia: entry.media_type !== 'none',
    }));

    const draft = await composeWorkout(asked, library, await recentStyle());
    return NextResponse.json({ draft });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not build a workout.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
