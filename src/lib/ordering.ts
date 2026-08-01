/**
 * Pure ordering helpers shared by the server and the drag-and-drop UI.
 *
 * This lives apart from `queries.ts` on purpose: that module imports the
 * database layer, which reaches for `node:fs`. Importing it from a client
 * component drags the filesystem into the browser bundle and the build fails.
 */

import type { Exercise } from '@/lib/types';

/**
 * Sections are free text, so "Warm-up", "Warm up" and "warmup" all have to
 * count as the same thing when deciding what opens and closes a workout.
 */
export function normaliseCategory(category: string): string {
  return category.toLowerCase().replace(/[^a-z0-9]/g, '');
}

const OPENS_WORKOUT = ['warmup', 'warmups'];
const CLOSES_WORKOUT = ['cooldown', 'cooldowns', 'stretch', 'stretches'];

/** Sections that should always come first, whatever they're called. */
export function opensWorkout(category: string): boolean {
  return OPENS_WORKOUT.includes(normaliseCategory(category));
}

/** Sections that should always come last. */
export function closesWorkout(category: string): boolean {
  return CLOSES_WORKOUT.includes(normaliseCategory(category));
}

export interface OrderRow {
  kind: 'heading' | 'exercise';
  id: string;
  category: string;
}

/**
 * Reads the section for each exercise off the heading above it, after a drag
 * has rearranged the list.
 *
 * Anything dropped above the very first heading joins that first section —
 * dragging to the top should mean "put it first", not "strip its section".
 */
export function readOrderFromRows(
  rows: OrderRow[],
  showHeadings: boolean,
): { id: string; category: string }[] {
  const order: { id: string; category: string }[] = [];
  let current = rows.find((r) => r.kind === 'heading')?.category ?? '';

  for (const row of rows) {
    if (row.kind === 'heading') current = row.category;
    else order.push({ id: row.id, category: showHeadings ? current : row.category });
  }

  return order;
}

/**
 * Works out where a dragged row lands.
 *
 * Dropping onto another exercise means "go where that one is", which is what
 * a sortable list normally does. Dropping onto a *heading* means something
 * different — "put it in this section" — so the row goes directly under the
 * heading instead of above it. Without that, a section with nothing in it
 * would have no row to aim at and could never be filled.
 */
export function placeRow<T extends { id: string; kind: 'heading' | 'exercise' }>(
  rows: T[],
  activeId: string,
  overId: string,
): T[] {
  const from = rows.findIndex((r) => r.id === activeId);
  const to = rows.findIndex((r) => r.id === overId);
  if (from === -1 || to === -1 || from === to) return rows;

  const next = [...rows];
  const [moved] = next.splice(from, 1);

  if (rows[to].kind === 'heading') {
    next.splice(next.findIndex((r) => r.id === overId) + 1, 0, moved);
  } else {
    next.splice(to, 0, moved);
  }

  return next;
}

export interface ExerciseGroup {
  /** Empty string for exercises with no category. */
  category: string;
  /** What to print above the group. */
  heading: string;
  exercises: Exercise[];
}

/**
 * Splits a workout into its sub-sections — Legs, Core, and so on.
 *
 * `sections` is the coach's own running order, and it wins whenever it's set:
 * it's the only thing that can place a section with nothing in it, and it's
 * what lets a section be moved without shuffling the exercises inside it. A
 * workout that has never had its sections arranged has an empty list, and then
 * groups fall back to the order they first appear in — with a warm-up pulled
 * to the front and a cool-down pushed to the back.
 */
export function groupExercises(
  exercises: Exercise[],
  sections: string[] = [],
  /**
   * Sections with nothing in them. The admin shows them, because they're there
   * to be filled; parents never see a heading with no exercises under it.
   */
  { includeEmpty = false }: { includeEmpty?: boolean } = {},
): ExerciseGroup[] {
  const groups: ExerciseGroup[] = [];

  for (const exercise of exercises) {
    const category = exercise.category ?? '';
    const existing = groups.find((g) => g.category === category);
    if (existing) existing.exercises.push(exercise);
    else groups.push({ category, heading: category || 'Also', exercises: [exercise] });
  }

  if (includeEmpty) {
    for (const section of sections) {
      if (!groups.some((g) => g.category === section)) {
        groups.push({ category: section, heading: section || 'Also', exercises: [] });
      }
    }
  }

  // Sorted on a tuple: which band the group belongs to, then its place within
  // that band. Anything the coach has arranged sits in the middle band in the
  // order they put it in; a section they've never arranged keeps the old
  // behaviour, so adding one to an untouched workout still lands sensibly.
  const key = (g: ExerciseGroup, appearance: number): [number, number, number] => {
    const arranged = sections.indexOf(g.category);
    if (arranged !== -1) return [1, arranged, 0];
    if (opensWorkout(g.category)) return [0, 0, appearance];
    if (closesWorkout(g.category)) return [2, 0, appearance];

    // Uncategorised leftovers sit after everything arranged, but still ahead
    // of a cool-down — stretches belong at the end of a workout even when
    // there are odds and ends that never got a section.
    if (!g.category) {
      const closing = sections.findIndex((section) => closesWorkout(section));
      return [1, closing === -1 ? sections.length + 1 : closing - 0.5, appearance];
    }

    return [1, sections.length, appearance];
  };

  return groups
    .map((group, index) => ({ group, key: key(group, index) }))
    .sort((a, b) => a.key[0] - b.key[0] || a.key[1] - b.key[1] || a.key[2] - b.key[2])
    .map(({ group }) => group);
}
