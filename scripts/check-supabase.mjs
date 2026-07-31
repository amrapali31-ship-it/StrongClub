/**
 * Confirms the Supabase project is wired up correctly before you deploy.
 *
 *   npm run check:supabase
 *
 * Prints the project URL but never the service role key.
 */
import { loadEnv, supabaseFromEnv } from './supabase-env.mjs';

loadEnv();

const TABLES = ['profiles', 'weeks', 'workouts', 'exercises', 'exercise_completions'];
const BUCKET = 'workout-media';

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

const supabase = supabaseFromEnv();
console.log(`Project: ${url}\n`);

let failed = false;

for (const table of TABLES) {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
  if (error) {
    console.log(`  ✗ ${table.padEnd(22)} ${error.message}`);
    failed = true;
  } else {
    console.log(`  ✓ ${table.padEnd(22)} ${count} row${count === 1 ? '' : 's'}`);
  }
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
  process.exit(1);
}

console.log('\nAll good. StrongClub will use Supabase from here on.');
