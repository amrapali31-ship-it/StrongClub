/**
 * Fills the exercise library with a broad set of standard movements.
 *
 *   npm run seed:library
 *
 * Safe to re-run and safe against a live database: it only adds names that
 * aren't already there, so your own edits and additions are never touched.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import { LIBRARY, toRecords } from './library-data.mjs';
import { loadEnv, supabaseFromEnv } from './supabase-env.mjs';

loadEnv();
const supabase = supabaseFromEnv();
const records = toRecords(LIBRARY);
const FILE = path.join(process.cwd(), '.data', 'db.json');

if (supabase) {
  const { data: existing, error } = await supabase.from('library_exercises').select('name');
  if (error) {
    console.error(`Could not read library_exercises: ${error.message}`);
    console.error('Re-run supabase/schema.sql in the SQL editor to create the new table.');
    process.exit(1);
  }

  const have = new Set(existing.map((row) => row.name));
  const toAdd = records.filter((row) => !have.has(row.name));

  if (toAdd.length === 0) {
    console.log(`Library already has all ${records.length} starter exercises. Nothing to do.`);
  } else {
    const { error: insertError } = await supabase.from('library_exercises').insert(toAdd);
    if (insertError) {
      console.error(`Failed inserting into library_exercises: ${insertError.message}`);
      process.exit(1);
    }
    console.log(`Added ${toAdd.length} exercises to the library → Supabase`);
    if (have.size) console.log(`Left your existing ${have.size} alone.`);
  }
} else {
  let db = { profiles: [], weeks: [], workouts: [], exercises: [], library: [], completions: [] };
  try {
    db = { ...db, ...JSON.parse(await fs.readFile(FILE, 'utf8')) };
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }

  const have = new Set(db.library.map((row) => row.name));
  const now = new Date().toISOString();
  const toAdd = records
    .filter((row) => !have.has(row.name))
    .map((row) => ({ id: randomUUID(), ...row, created_at: now }));

  db.library.push(...toAdd);

  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(db, null, 2));
  console.log(`Added ${toAdd.length} exercises to the library → .data/db.json`);
}
