/**
 * Confirms the Supabase project is wired up correctly before you deploy.
 *
 *   npm run check:supabase
 *
 * Prints the project URL but never the service role key.
 */
import { loadEnv, supabaseFromEnv } from './supabase-env.mjs';

loadEnv();

const TABLES = [
  'profiles',
  'weeks',
  'workouts',
  'exercises',
  'library_exercises',
  'exercise_completions',
];
const BUCKET = 'workout-media';

/**
 * Columns added by later migrations. The tables themselves existing isn't
 * enough — a missing column here fails at write time, long after this check
 * would otherwise have said everything was fine.
 */
const COLUMNS = [
  ['profiles', 'photo_url'],
  ['workouts', 'emoji'],
  ['workouts', 'sections'],
  ['exercises', 'category'],
  ['exercises', 'equipment'],
  ['library_exercises', 'category'],
  ['library_exercises', 'equipment'],
];

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Not configured yet.\n');
  console.error(`  NEXT_PUBLIC_SUPABASE_URL   ${url ? 'set' : 'MISSING'}`);
  console.error(`  SUPABASE_SERVICE_ROLE_KEY  ${key ? 'set' : 'MISSING'}`);
  console.error('\nAdd both to .env.local, then run this again.');
  process.exit(1);
}

if (key.startsWith('eyJ')) {
  const role = JSON.parse(Buffer.from(key.split('.')[1] ?? '', 'base64url').toString())?.role;
  if (role && role !== 'service_role') {
    console.error(`That key is the "${role}" key, not the service role key.`);
    console.error('Copy the service_role key from Project Settings → API.');
    process.exit(1);
  }
}

// supabase-js appends /rest/v1 itself; pasting the full REST endpoint produces
// a doubled path that fails in confusing ways rather than erroring outright.
if (/\/rest\/v1/.test(url) || /\/$/.test(url)) {
  const suggestion = url.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
  console.error('That URL has extra path on the end.\n');
  console.error(`  you have:  ${url}`);
  console.error(`  should be: ${suggestion}\n`);
  console.error('Fix NEXT_PUBLIC_SUPABASE_URL in .env.local and run this again.');
  process.exit(1);
}

const supabase = supabaseFromEnv();
console.log(`Project: ${url}\n`);

let failed = false;

for (const table of TABLES) {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
  // A null count with no error means the request didn't reach the table at
  // all — treat it as a failure rather than reporting a hollow success.
  if (error || count === null) {
    console.log(`  ✗ ${table.padEnd(22)} ${error?.message ?? 'no response from this table'}`);
    failed = true;
  } else {
    console.log(`  ✓ ${table.padEnd(22)} ${count} row${count === 1 ? '' : 's'}`);
  }
}

// `limit(0)` asks the API to resolve the column without returning any rows.
const missingColumns = [];
for (const [table, column] of COLUMNS) {
  const { error } = await supabase.from(table).select(column).limit(0);
  if (error) missingColumns.push(`${table}.${column}`);
}

if (missingColumns.length === 0) {
  console.log(`  ✓ ${'columns'.padEnd(22)} all ${COLUMNS.length} up to date`);
} else {
  for (const name of missingColumns) {
    console.log(`  ✗ ${name.padEnd(22)} column missing`);
  }
  failed = true;
}

const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
if (bucketError) {
  console.log(`  ✗ ${BUCKET.padEnd(22)} ${bucketError.message}`);
  failed = true;
} else {
  const bucket = buckets.find((b) => b.name === BUCKET);
  if (!bucket) {
    console.log(`  ✗ ${BUCKET.padEnd(22)} bucket missing`);
    failed = true;
  } else if (!bucket.public) {
    console.log(`  ✗ ${BUCKET.padEnd(22)} exists but is private — videos won't load`);
    failed = true;
  } else {
    console.log(`  ✓ ${BUCKET.padEnd(22)} public bucket ready`);
  }
}

if (failed) {
  console.error('\nSomething is missing. Run supabase/schema.sql in the Supabase SQL editor.');
  if (missingColumns.length) {
    console.error('It is safe to re-run in full — every statement is add-if-missing.');
  }
  process.exit(1);
}

console.log('\nAll good. StrongClub will use Supabase from here on.');
