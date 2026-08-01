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
 * Splits a workout into its sub-sections — Legs, Core, and so on — using the
 * category each exercise inherited from the library.
 *
 * Groups appear in the order they first show up in the workout, so the coach's
 * own sequencing decides whether legs or core comes first. Uncategorised
 * one-offs collect at the end.
 */
export function groupExercises(
  exercises: Exercise[],
  /**
   * Sections to show even when empty. The admin passes the workout's own list
   * so a freshly created section is visible and can be dragged into; parents
   * don't, so they never see an empty heading.
   */
  declaredSections: string[] = [],
): ExerciseGroup[] {
  const groups: ExerciseGroup[] = [];

  for (const exercise of exercises) {
    const category = exercise.category ?? '';
    const existing = groups.find((g) => g.category === category);
    if (existing) existing.exercises.push(exercise);
    else groups.push({ category, heading: category || 'Also', exercises: [exercise] });
  }

  for (const section of declaredSections) {
    if (!groups.some((g) => g.category === section)) {
      groups.push({ category: section, heading: section || 'Also', exercises: [] });
    }
  }

  // A warm-up opens and a cool-down closes, however they've been spelled;
  // uncategorised sits just before the cool-down. Everything else keeps the
  // order the coach arranged.
  const rank = (g: ExerciseGroup) => {
    if (opensWorkout(g.category)) return 0;
    if (closesWorkout(g.category)) return 3;
    return g.category ? 1 : 2;
  };

  return groups
    .map((group, index) => ({ group, index }))
    .sort((a, b) => rank(a.group) - rank(b.group) || a.index - b.index)
    .map(({ group }) => group);
}
