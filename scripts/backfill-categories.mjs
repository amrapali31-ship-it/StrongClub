/**
 * Gives existing workout exercises a section by matching their name against
 * the library.
 *
 *   npm run backfill:categories
 *
 * Only fills blanks — anything you've already set is left alone. Names with no
 * library match stay empty and simply group under "Also" at the end.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { loadEnv, supabaseFromEnv } from './supabase-env.mjs';

loadEnv();
const supabase = supabaseFromEnv();
const FILE = path.join(process.cwd(), '.data', 'db.json');

const key = (name) => name.trim().toLowerCase();

if (supabase) {
  const { data: library, error: libError } = await supabase
    .from('library_exercises')
    .select('name,category');
  if (libError) {
    console.error(`Could not read the library: ${libError.message}`);
    process.exit(1);
  }

  const { data: exercises, error: exError } = await supabase
    .from('exercises')
    .select('id,name,category');
  if (exError) {
    console.error(`Could not read exercises: ${exError.message}`);
    console.error("If this mentions 'category', re-run supabase/schema.sql first.");
    process.exit(1);
  }

  const byName = new Map(library.map((l) => [key(l.name), l.category]));
  const todo = exercises.filter((e) => !e.category && byName.has(key(e.name)));

  for (const exercise of todo) {
    const { error } = await supabase
      .from('exercises')
      .update({ category: byName.get(key(exercise.name)) })
      .eq('id', exercise.id);
    if (error) {
      console.error(`Failed on ${exercise.name}: ${error.message}`);
      process.exit(1);
    }
    console.log(`  ${exercise.name} → ${byName.get(key(exercise.name))}`);
  }

  const unmatched = exercises.filter((e) => !e.category && !byName.has(key(e.name)));
  console.log(`\nSet a section on ${todo.length} exercise(s) → Supabase`);
  if (unmatched.length) {
    console.log(
      `No library match for: ${unmatched.map((e) => e.name).join(', ')}` +
        '\n(these stay unsectioned — set them by hand if you want them grouped)',
    );
  }
} else {
  const db = JSON.parse(await fs.readFile(FILE, 'utf8'));
  const byName = new Map((db.library ?? []).map((l) => [key(l.name), l.category]));

  let filled = 0;
  for (const exercise of db.exercises) {
    if (!exercise.category && byName.has(key(exercise.name))) {
      exercise.category = byName.get(key(exercise.name));
      filled += 1;
    } else if (exercise.category === undefined) {
      exercise.category = '';
    }
  }

  await fs.writeFile(FILE, JSON.stringify(db, null, 2));
  console.log(`Set a section on ${filled} exercise(s) → .data/db.json`);
}
