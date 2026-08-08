/**
 * The pure logic, tested without a browser or a database.
 *
 *   npm test
 *
 * These live in the repo rather than somewhere scratch because every rule here
 * was learned the hard way — each one is a bug that reached a screen once.
 * Modules imported here must stay free of database imports, which is the same
 * constraint that keeps them out of the client bundle.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { groupExercises, placeRow, readOrderFromRows } from '../src/lib/ordering.ts';
import { searchExercises, similarity, suggestMatch } from '../src/lib/matching.ts';

/* ------------------------------------------------------------- sections */

const ex = (id: string, category: string) => ({ id, category }) as never;

test('a declared section shows even with nothing in it', () => {
  const groups = groupExercises([ex('a', 'Legs')], ['Legs', 'Finisher'], { includeEmpty: true });
  assert.deepEqual(
    groups.map((g) => [g.category, g.exercises.length]),
    [
      ['Legs', 1],
      ['Finisher', 0],
    ],
  );
});

test('a declared section already in use is not duplicated', () => {
  const groups = groupExercises([ex('a', 'Legs')], ['Legs'], { includeEmpty: true });
  assert.equal(groups.length, 1);
  assert.equal(groups[0].exercises.length, 1);
});

test('an arranged order is followed exactly, warm-up rules and all', () => {
  const groups = groupExercises([ex('a', 'Legs')], ['Cool-down', 'Warm up', 'Legs'], {
    includeEmpty: true,
  });
  assert.deepEqual(
    groups.map((g) => g.category),
    ['Cool-down', 'Warm up', 'Legs'],
  );
});

test('with nothing arranged, a warm-up opens and a cool-down closes', () => {
  const groups = groupExercises([ex('a', 'Cool-down'), ex('b', 'Legs'), ex('c', 'Warm-up')]);
  assert.deepEqual(
    groups.map((g) => g.category),
    ['Warm-up', 'Legs', 'Cool-down'],
  );
});

test('parents get the arranged order but never an empty heading', () => {
  const groups = groupExercises([ex('a', 'Legs'), ex('b', 'Core')], ['Core', 'Finisher', 'Legs']);
  assert.deepEqual(
    groups.map((g) => g.category),
    ['Core', 'Legs'],
  );
});

test('a section nobody has arranged lands after the ones that are', () => {
  const groups = groupExercises([ex('a', 'Legs'), ex('b', 'Cardio')], ['Legs']);
  assert.deepEqual(
    groups.map((g) => g.category),
    ['Legs', 'Cardio'],
  );
});

test('uncategorised leftovers sit last, but ahead of an arranged cool-down', () => {
  const groups = groupExercises(
    [ex('a', ''), ex('b', 'Legs'), ex('c', 'Cool-down')],
    ['Legs', 'Cool-down'],
  );
  assert.deepEqual(
    groups.map((g) => g.category),
    ['Legs', '', 'Cool-down'],
  );
});

/* ------------------------------------------------------ drag and drop */

const H = (c: string) => ({ kind: 'heading' as const, id: `heading:${c}`, category: c });
const E = (id: string, c: string) => ({ kind: 'exercise' as const, id, category: c });

test('dropping on an empty heading lands under it, not above', () => {
  const rows = [H('Legs'), E('a', 'Legs'), E('b', 'Legs'), H('Finisher')];
  const next = placeRow(rows, 'b', 'heading:Finisher');
  assert.deepEqual(
    next.map((r) => r.id),
    ['heading:Legs', 'a', 'heading:Finisher', 'b'],
  );
  assert.deepEqual(readOrderFromRows(next, true), [
    { id: 'a', category: 'Legs' },
    { id: 'b', category: 'Finisher' },
  ]);
});

test('dropping on a heading from below also lands under it', () => {
  const rows = [H('Legs'), E('a', 'Legs'), H('Finisher'), E('b', 'Finisher')];
  const next = placeRow(rows, 'b', 'heading:Legs');
  assert.deepEqual(
    next.map((r) => r.id),
    ['heading:Legs', 'b', 'a', 'heading:Finisher'],
  );
});

test('dropping on another exercise still behaves like a plain sort', () => {
  const rows = [H('Legs'), E('a', 'Legs'), E('b', 'Legs'), E('c', 'Legs')];
  assert.deepEqual(
    placeRow(rows, 'c', 'a').map((r) => r.id),
    ['heading:Legs', 'c', 'a', 'b'],
  );
});

test('an unknown or unchanged target leaves the list alone', () => {
  const rows = [H('Legs'), E('a', 'Legs')];
  assert.equal(placeRow(rows, 'a', 'a'), rows);
  assert.equal(placeRow(rows, 'a', 'nope'), rows);
});

/* ------------------------------------------------------------ matching */

const LIB = [
  'Wall angel',
  'Wall push-up',
  'Wall sit',
  'Bicep curl',
  'Bent-over row',
  'Dumbbell row',
  'Glute bridge',
  'Single-leg deadlift',
  'Deadlift',
  'Romanian deadlift',
  'Side plank',
  'Plank',
  'Dead bug',
  'Standing march',
  'Heel raise',
  'Sit to stand',
  'Goblet squat',
  'Bodyweight squat',
  'Step-up',
].map((name, i) => ({ id: `id${i}`, name }));

const suggest = (name: string) => suggestMatch(name, LIB)?.name ?? null;

test('a narrowed variation still points at the movement', () => {
  assert.equal(suggest('Upward wall angel'), 'Wall angel');
  assert.equal(suggest('Standing wall angel'), 'Wall angel');
});

test('plurals and punctuation are not differences', () => {
  assert.equal(suggest('Bicep curls'), 'Bicep curl');
  assert.equal(suggest('Bent over rows'), 'Bent-over row');
  assert.equal(suggest('Sit-to-stand'), 'Sit to stand');
});

test('filler words about how it is done are ignored', () => {
  assert.equal(suggest('Slow controlled glute bridge'), 'Glute bridge');
  assert.equal(suggest('Dead bug (each side)'), 'Dead bug');
});

test('a genuinely different exercise is not offered', () => {
  for (const name of ['Burpee', 'Farmer carry', 'Sled push', 'Swimming']) {
    assert.equal(suggest(name), null, name);
  }
});

test('a real match beats a merely overlapping one', () => {
  assert.equal(suggest('Wall sit'), 'Wall sit');
  assert.equal(suggest('Plank'), 'Plank');
  assert.equal(suggest('Deadlift'), 'Deadlift');
});

test('a longer name containing another does not drag in the wrong one', () => {
  assert.equal(suggest('Single leg deadlift'), 'Single-leg deadlift');
  assert.equal(suggest('Romanian deadlifts'), 'Romanian deadlift');
});

test('similarity is bounded and ranks the closer name higher', () => {
  assert.ok(similarity('Wall angel', 'Upward wall angel') > similarity('Wall angel', 'Wall sit'));
  assert.equal(similarity('', 'Plank'), 0);
});

/* -------------------------------------------------------------- search */

const CATALOGUE = [
  { name: 'Wall angel', category: 'Upper body', equipment: 'Wall' },
  { name: 'Bicep curl', category: 'Upper body', equipment: 'Dumbbells' },
  { name: 'Goblet squat', category: 'Legs', equipment: 'Dumbbells' },
  { name: 'Chair squat', category: 'Legs', equipment: 'Chair' },
  { name: 'Standing march', category: 'Balance', equipment: 'Chair' },
];
const found = (q: string) => searchExercises(q, CATALOGUE).map((e) => e.name);

test('an empty search leaves the list alone', () => {
  assert.equal(found('').length, CATALOGUE.length);
  assert.equal(found('   ').length, CATALOGUE.length);
});

test('words can be typed in any order, and part-typed', () => {
  assert.deepEqual(found('wall ang'), ['Wall angel']);
  assert.deepEqual(found('curl bicep'), ['Bicep curl']);
  assert.deepEqual(found('squat'), ['Goblet squat', 'Chair squat']);
});

test('section and equipment are searchable too', () => {
  assert.deepEqual(found('dumbbells'), ['Bicep curl', 'Goblet squat']);
  assert.deepEqual(found('legs chair'), ['Chair squat']);
});

test('a typo still finds it rather than showing nothing', () => {
  // "angle" for "angel" is a transposition, which plain edit distance charges
  // two for — the reason this needs Damerau-Levenshtein.
  assert.deepEqual(found('wall angle'), ['Wall angel']);
});

test('a search for something absent returns nothing', () => {
  assert.deepEqual(found('trampoline'), []);
});

/* ------------------------------------------------------------ estimate */

// estimateMinutes lives in queries.ts, which imports the database layer, so the
// rule it implements is restated here rather than importing it.
const minutes = (
  exercises: {
    mode: string;
    sets: number;
    reps: number | null;
    duration_seconds: number | null;
    rest_seconds: number;
    category: string;
  }[],
  rounds: Record<string, number> = {},
) => {
  const seconds = exercises.reduce((total, e) => {
    const work = e.mode === 'time' ? (e.duration_seconds ?? 30) : (e.reps ?? 10) * 4;
    const repeats = rounds[e.category ?? ''] ?? 1;
    const times = repeats > 1 ? repeats : e.sets;
    return total + times * (work + e.rest_seconds);
  }, 0);
  return Math.max(1, Math.round(seconds / 60));
};

const pair = [
  { mode: 'reps', sets: 2, reps: 10, duration_seconds: null, rest_seconds: 30, category: 'Legs' },
  { mode: 'reps', sets: 2, reps: 10, duration_seconds: null, rest_seconds: 30, category: 'Legs' },
];

test("rounds replace an exercise's own sets rather than multiplying with them", () => {
  assert.equal(minutes(pair), Math.round((4 * 70) / 60));
  assert.equal(minutes(pair, { Legs: 3 }), Math.round((6 * 70) / 60));
});

test('a section that does not repeat is unaffected', () => {
  assert.equal(minutes(pair, { Balance: 4 }), minutes(pair));
  assert.equal(minutes(pair, { Legs: 1 }), minutes(pair));
});
