/**
 * Pure ordering helpers shared by the server and the drag-and-drop UI.
 *
 * This lives apart from `queries.ts` on purpose: that module imports the
 * database layer, which reaches for `node:fs`. Importing it from a client
 * component drags the filesystem into the browser bundle and the build fails.
 */

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
