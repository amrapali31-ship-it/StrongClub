/**
 * Fills in equipment on exercises that predate the field, by matching their
 * name against the starter library.
 *
 *   npm run backfill:equipment
 *
 * Only fills blanks — anything you've already typed is left alone. Names the
 * starter library doesn't know stay empty and simply show nothing.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { LIBRARY } from './library-data.mjs';
import { loadEnv, supabaseFromEnv } from './supabase-env.mjs';

loadEnv();
const supabase = supabaseFromEnv();
const FILE = path.join(process.cwd(), '.data', 'db.json');

const key = (name) => name.trim().toLowerCase();
const KNOWN = new Map(LIBRARY.filter((e) => e.equipment).map((e) => [key(e.name), e.equipment]));

/** Both tables get the same treatment: blank rows with a known name. */
async function fillTable(table) {
  const { data, error } = await supabase.from(table).select('id,name,equipment');
  if (error) {
    console.error(`Could not read ${table}: ${error.message}`);
    if (error.message.includes('equipment')) {
      console.error('Run the new lines at the bottom of supabase/schema.sql first.');
    }
    process.exit(1);
  }

  const todo = data.filter((row) => !row.equipment && KNOWN.has(key(row.name)));
  for (const row of todo) {
    const equipment = KNOWN.get(key(row.name));
    const { error: updateError } = await supabase
      .from(table)
      .update({ equipment })
      .eq('id', row.id);
    if (updateError) {
      console.error(`Failed on ${row.name}: ${updateError.message}`);
      process.exit(1);
    }
    console.log(`  ${row.name} → ${equipment}`);
  }

  const unmatched = data.filter((row) => !row.equipment && !KNOWN.has(key(row.name)));
  console.log(`Set equipment on ${todo.length} row(s) in ${table}`);
  return unmatched.map((row) => row.name);
}

if (supabase) {
  const unmatched = [...new Set([...(await fillTable('library_exercises')), ...(await fillTable('exercises'))])];
  console.log('\nDone → Supabase');
  if (unmatched.length) {
    console.log(
      `No starter-library match for: ${unmatched.join(', ')}` +
        '\n(these stay blank — set them by hand if you want them listed)',
    );
  }
} else {
  const db = JSON.parse(await fs.readFile(FILE, 'utf8'));

  let filled = 0;
  for (const row of [...(db.library ?? []), ...(db.exercises ?? [])]) {
    if (!row.equipment && KNOWN.has(key(row.name))) {
      row.equipment = KNOWN.get(key(row.name));
      filled += 1;
    } else if (row.equipment === undefined) {
      row.equipment = '';
    }
  }

  await fs.writeFile(FILE, JSON.stringify(db, null, 2));
  console.log(`Set equipment on ${filled} row(s) → .data/db.json`);
}
