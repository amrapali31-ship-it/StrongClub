/**
 * Pure ordering helpers shared by the server and the drag-and-drop UI.
 *
 * This lives apart from `queries.ts` on purpose: that module imports the
 * database layer, which reaches for `node:fs`. Importing it from a client
 * component drags the filesystem into the browser bundle and the build fails.
 */

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
