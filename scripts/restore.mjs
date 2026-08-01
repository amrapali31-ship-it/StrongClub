/**
 * Puts back what a snapshot holds and the database is missing.
 *
 *   npm run restore -- backups/strongclub-2026-08-01T23-00-00.json
 *
 * Only ever inserts. Rows that still exist are left exactly as they are, so
 * restoring a deleted week won't undo edits you made to everything else.
 * Add --dry-run to see what it would do without touching anything.
 *
 * Ids are preserved, which is what makes a restore hang together: exercises
 * still point at their workout, and a re-inserted week reclaims its own.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { loadEnv, supabaseFromEnv } from './supabase-env.mjs';

loadEnv();

// Parents before children, or a foreign key rejects the insert.
const ORDER = [
  'profiles',
  'weeks',
  'workouts',
  'exercises',
  'library_exercises',
  'exercise_completions',
];

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const target = args.find((a) => !a.startsWith('--'));

if (!target) {
  console.error('Which snapshot? e.g. npm run restore -- backups/strongclub-....json');
  process.exit(1);
}

const supabase = supabaseFromEnv();
if (!supabase) {
  console.error('Restore only runs against Supabase. Nothing is configured in .env.local.');
  process.exit(1);
}

const snapshot = JSON.parse(await fs.readFile(path.resolve(target), 'utf8'));
console.log(`Snapshot taken ${snapshot.taken_at}`);
console.log(`Restoring into ${process.env.NEXT_PUBLIC_SUPABASE_URL}${dryRun ? '  (dry run)' : ''}\n`);

let restored = 0;

for (const table of ORDER) {
  const rows = snapshot.tables?.[table] ?? [];
  if (rows.length === 0) continue;

  const { data: existing, error } = await supabase.from(table).select('id');
  if (error) {
    console.error(`Could not read ${table}: ${error.message}`);
    process.exit(1);
  }

  const have = new Set(existing.map((row) => row.id));
  const missing = rows.filter((row) => !have.has(row.id));

  if (missing.length === 0) {
    console.log(`  ${table}: nothing missing`);
    continue;
  }

  if (dryRun) {
    console.log(`  ${table}: would restore ${missing.length}`);
    restored += missing.length;
    continue;
  }

  // In chunks, so one oversized table doesn't fail the whole request.
  for (let i = 0; i < missing.length; i += 100) {
    const { error: insertError } = await supabase.from(table).insert(missing.slice(i, i + 100));
    if (insertError) {
      console.error(`Failed restoring ${table}: ${insertError.message}`);
      process.exit(1);
    }
  }

  console.log(`  ${table}: restored ${missing.length}`);
  restored += missing.length;
}

console.log(
  dryRun
    ? `\n${restored} row(s) would be restored. Re-run without --dry-run to do it.`
    : `\nRestored ${restored} row(s).`,
);
