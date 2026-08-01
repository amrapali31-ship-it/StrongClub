/**
 * Writes a complete snapshot of the database to backups/.
 *
 *   npm run backup
 *
 * Read-only against your data. Storage files aren't copied — they're never
 * deleted by the app, so a snapshot plus the bucket is a full restore.
 *
 * Free Supabase projects have no point-in-time recovery, so this is the only
 * thing standing between a mistaken delete and retyping a month of work. Worth
 * running before you delete anything, and every so often regardless.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { loadEnv, supabaseFromEnv } from './supabase-env.mjs';

loadEnv();

export const TABLES = [
  'profiles',
  'weeks',
  'workouts',
  'exercises',
  'library_exercises',
  'exercise_completions',
];

const supabase = supabaseFromEnv();
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const dir = path.join(process.cwd(), 'backups');
const file = path.join(dir, `strongclub-${stamp}.json`);

const snapshot = { taken_at: new Date().toISOString(), source: '', tables: {} };

if (supabase) {
  snapshot.source = process.env.NEXT_PUBLIC_SUPABASE_URL;
  for (const table of TABLES) {
    const { data, error } = await supabase.from(table).select('*');
    if (error) {
      console.error(`Could not read ${table}: ${error.message}`);
      process.exit(1);
    }
    snapshot.tables[table] = data;
  }
} else {
  snapshot.source = '.data/db.json';
  const db = JSON.parse(await fs.readFile(path.join(process.cwd(), '.data', 'db.json'), 'utf8'));
  const localNames = {
    profiles: 'profiles',
    weeks: 'weeks',
    workouts: 'workouts',
    exercises: 'exercises',
    library_exercises: 'library',
    exercise_completions: 'completions',
  };
  for (const table of TABLES) snapshot.tables[table] = db[localNames[table]] ?? [];
}

await fs.mkdir(dir, { recursive: true });
await fs.writeFile(file, JSON.stringify(snapshot, null, 2));

console.log(`Snapshot → ${path.relative(process.cwd(), file)}\n`);
for (const table of TABLES) {
  console.log(`  ${String(snapshot.tables[table].length).padStart(5)}  ${table}`);
}
console.log('\nRestore with:  npm run restore -- <file>');
