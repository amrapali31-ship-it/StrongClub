/**
 * Writes a starter week so the app has something to show on first run.
 *
 *   npm run seed
 *
 * With no Supabase env vars set this replaces `.data/db.json` outright. With
 * them set it writes to Supabase instead, but refuses to touch a project that
 * already has weeks in it unless you pass `--force`.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import { loadEnv, supabaseFromEnv } from './supabase-env.mjs';

loadEnv();
const supabase = supabaseFromEnv();
const force = process.argv.includes('--force');

const FILE = path.join(process.cwd(), '.data', 'db.json');
const now = new Date().toISOString();

/** Monday of the current week, as yyyy-mm-dd. */
function thisMonday() {
  const date = new Date();
  const offset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - offset);
  return date.toISOString().slice(0, 10);
}

const profiles = [
  { name: 'Mum', color: '#d6552b' },
  { name: 'Dad', color: '#2e7d53' },
].map((p, i) => ({ id: randomUUID(), position: i, created_at: now, ...p }));

const week = {
  id: randomUUID(),
  title: 'Week 1 — Getting started',
  start_date: thisMonday(),
  note: 'Aim for three of these four. Go slowly, stop if anything hurts, and have a chat with your doctor before starting anything new.',
  published: true,
  created_at: now,
};

const plan = [
  {
    title: 'Legs & balance',
    subtitle: 'Chair-based strength for hips and knees',
    exercises: [
      {
        name: 'Sit to stand',
        mode: 'reps',
        sets: 2,
        reps: 8,
        rest_seconds: 45,
        instructions:
          'Sit tall at the front of a sturdy chair, feet flat and slightly back.\nStand up without pushing off with your hands, then lower yourself down slowly.\nUse your hands on the armrests if you need to — that still counts.',
        media_type: 'image',
        media_url: '/demo/sit-to-stand.svg',
      },
      {
        name: 'Heel raises',
        mode: 'reps',
        sets: 2,
        reps: 12,
        rest_seconds: 30,
        instructions:
          'Stand behind a chair, holding the back for balance.\nRise up onto your toes, hold for a second, then lower slowly.',
      },
      {
        name: 'Standing march',
        mode: 'time',
        duration_seconds: 30,
        sets: 2,
        rest_seconds: 30,
        instructions:
          'Holding the chair, lift one knee then the other, like marching on the spot.\nKeep it steady rather than fast.',
      },
      {
        name: 'One-leg balance',
        mode: 'time',
        duration_seconds: 20,
        sets: 2,
        rest_seconds: 30,
        instructions:
          'Hold the chair with one hand. Lift one foot slightly off the floor.\nSwap legs for the second set. Keep a hand on the chair the whole time.',
      },
    ],
  },
  {
    title: 'Upper body',
    subtitle: 'Arms, shoulders and posture',
    exercises: [
      {
        name: 'Wall push-ups',
        mode: 'reps',
        sets: 2,
        reps: 8,
        rest_seconds: 45,
        instructions:
          'Stand an arm’s length from a wall, hands flat at shoulder height.\nBend your elbows to bring your chest towards the wall, then push back.',
      },
      {
        name: 'Shoulder rolls',
        mode: 'reps',
        sets: 1,
        reps: 10,
        rest_seconds: 20,
        instructions: 'Roll both shoulders backwards in a big slow circle. Then ten forwards.',
      },
      {
        name: 'Bicep curls',
        mode: 'reps',
        sets: 2,
        reps: 10,
        rest_seconds: 30,
        instructions:
          'Hold a water bottle in each hand, arms by your sides.\nBend at the elbow to bring them up to your shoulders, then lower slowly.',
      },
      {
        name: 'Overhead reach',
        mode: 'reps',
        sets: 2,
        reps: 8,
        rest_seconds: 30,
        instructions:
          'Sitting or standing tall, reach both arms up above your head.\nOnly go as high as feels comfortable.',
      },
    ],
  },
  {
    title: 'Gentle mobility',
    subtitle: 'Loosening up — good for a stiff morning',
    exercises: [
      {
        name: 'Neck turns',
        mode: 'reps',
        sets: 1,
        reps: 6,
        rest_seconds: 20,
        instructions: 'Turn your head slowly to look over one shoulder, then the other. Never force it.',
      },
      {
        name: 'Seated twist',
        mode: 'time',
        duration_seconds: 30,
        sets: 2,
        rest_seconds: 20,
        instructions:
          'Sit tall. Turn your upper body to one side, resting a hand on the chair back.\nHold, breathe, then swap sides.',
      },
      {
        name: 'Ankle circles',
        mode: 'reps',
        sets: 2,
        reps: 10,
        rest_seconds: 20,
        instructions: 'Sitting down, lift one foot and draw slow circles with your toes. Swap feet.',
      },
      {
        name: 'Seated cat-cow',
        mode: 'reps',
        sets: 2,
        reps: 8,
        rest_seconds: 30,
        instructions:
          'Hands on knees. Arch your back and look up, then round your back and tuck your chin.\nMove with your breath.',
      },
    ],
  },
  {
    title: 'Walk & breathe',
    subtitle: 'Get outside if the weather is kind',
    exercises: [
      {
        name: 'Warm-up walk',
        mode: 'time',
        duration_seconds: 300,
        sets: 1,
        rest_seconds: 0,
        instructions: 'An easy stroll to get going. You should be able to chat comfortably.',
      },
      {
        name: 'Brisk walk',
        mode: 'time',
        duration_seconds: 600,
        sets: 1,
        rest_seconds: 60,
        instructions:
          'Pick the pace up a little — breathing harder, but still able to talk.\nSlow down whenever you want to.',
      },
      {
        name: 'Cool-down walk',
        mode: 'time',
        duration_seconds: 300,
        sets: 1,
        rest_seconds: 0,
        instructions: 'Back to an easy pace to finish.',
      },
      {
        name: 'Deep breathing',
        mode: 'time',
        duration_seconds: 60,
        sets: 2,
        rest_seconds: 20,
        instructions:
          'Sit down. Breathe in through your nose for four counts, out through your mouth for six.',
      },
    ],
  },
];

const workouts = [];
const exercises = [];

plan.forEach((entry, workoutIndex) => {
  const workout = {
    id: randomUUID(),
    week_id: week.id,
    title: entry.title,
    subtitle: entry.subtitle,
    position: workoutIndex,
    created_at: now,
  };
  workouts.push(workout);

  entry.exercises.forEach((exercise, exerciseIndex) => {
    exercises.push({
      id: randomUUID(),
      workout_id: workout.id,
      name: exercise.name,
      instructions: exercise.instructions ?? '',
      mode: exercise.mode,
      sets: exercise.sets,
      reps: exercise.mode === 'reps' ? exercise.reps : null,
      duration_seconds: exercise.mode === 'time' ? exercise.duration_seconds : null,
      rest_seconds: exercise.rest_seconds,
      media_type: exercise.media_type ?? 'none',
      media_url: exercise.media_url ?? '',
      position: exerciseIndex,
      created_at: now,
    });
  });
});

const summary = `${profiles.length} people, 1 week, ${workouts.length} workouts, ${exercises.length} exercises`;

if (supabase) {
  const { count, error: countError } = await supabase
    .from('weeks')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.error(`Could not read the weeks table: ${countError.message}`);
    console.error('Have you run supabase/schema.sql in the SQL editor yet?');
    process.exit(1);
  }

  if (count > 0 && !force) {
    console.error(
      `This Supabase project already has ${count} week(s). Refusing to add more.\n` +
        'Re-run with --force if you really want to add the starter week anyway.',
    );
    process.exit(1);
  }

  // Parents first, then week → workouts → exercises, so foreign keys resolve.
  for (const [table, rows] of [
    ['profiles', profiles],
    ['weeks', [week]],
    ['workouts', workouts],
    ['exercises', exercises],
  ]) {
    const { error } = await supabase.from(table).insert(rows);
    if (error) {
      console.error(`Failed inserting into ${table}: ${error.message}`);
      process.exit(1);
    }
  }

  console.log(`Seeded ${summary} → Supabase`);
} else {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(
    FILE,
    JSON.stringify({ profiles, weeks: [week], workouts, exercises, completions: [] }, null, 2),
  );

  console.log(`Seeded ${summary} → .data/db.json`);
}
