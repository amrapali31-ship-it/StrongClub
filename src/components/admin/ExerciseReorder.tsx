'use client';

import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Link from 'next/link';
import { useState, useTransition } from 'react';

import { DeleteExerciseButton } from '@/components/admin/DeleteExerciseButton';
import { MediaThumb } from '@/components/MediaFrame';
import { setsLabel } from '@/lib/media';
import { placeRow, readOrderFromRows } from '@/lib/ordering';
import type { Exercise } from '@/lib/types';

/**
 * A section heading rendered inline in the sortable list. Headings don't move,
 * but they act as boundaries: whichever heading an exercise ends up under
 * decides its section, so dragging across one recategorises it.
 */
interface HeadingRow {
  kind: 'heading';
  id: string;
  category: string;
  heading: string;
  isEmpty: boolean;
  /** Position among the headings, for greying out the end stops. */
  index: number;
  count: number;
}

interface ExerciseRow {
  kind: 'exercise';
  id: string;
  exercise: Exercise;
}

type Row = HeadingRow | ExerciseRow;

interface Props {
  workoutId: string;
  exercises: Exercise[];
  showHeadings: boolean;
  /** Grouped display order, computed on the server so first paint matches. */
  groups: { category: string; heading: string; exercises: Exercise[] }[];
  /** Section names already in use, offered while renaming. */
  suggestions: string[];
  reorder: (formData: FormData) => Promise<void>;
  remove: (formData: FormData) => Promise<void>;
  rename: (formData: FormData) => Promise<void>;
  removeSection: (formData: FormData) => Promise<void>;
  moveSection: (formData: FormData) => Promise<void>;
}

function toRows(
  groups: Props['groups'],
  showHeadings: boolean,
): Row[] {
  const rows: Row[] = [];
  // Only named sections can be moved, so the "Also" bucket doesn't count
  // towards the end stops — otherwise the last real section looks stuck.
  const movable = groups.filter((g) => g.category);

  for (const group of groups) {
    if (showHeadings) {
      rows.push({
        kind: 'heading',
        id: `heading:${group.category}`,
        category: group.category,
        heading: group.heading,
        isEmpty: group.exercises.length === 0,
        index: movable.indexOf(group),
        count: movable.length,
      });
    }
    for (const exercise of group.exercises) {
      rows.push({ kind: 'exercise', id: exercise.id, exercise });
    }
  }
  return rows;
}

export function ExerciseReorder({
  workoutId,
  groups,
  showHeadings,
  suggestions,
  reorder,
  remove,
  rename,
  removeSection,
  moveSection,
}: Props) {
  const [rows, setRows] = useState<Row[]>(() => toRows(groups, showHeadings));
  const [, startTransition] = useTransition();

  // The server list is the source of truth; local state only holds the
  // optimistic order between a drop and the revalidate landing. Adjusting
  // during render (rather than in an effect) avoids a second paint.
  const signature = groups
    .map((g) => `${g.category}:${g.exercises.map((e) => e.id).join(',')}`)
    .join('|');
  const [seenSignature, setSeenSignature] = useState(signature);
  if (signature !== seenSignature) {
    setSeenSignature(signature);
    setRows(toRows(groups, showHeadings));
  }

  // Mouse and touch are listed separately rather than using PointerSensor:
  // touch needs a short press-and-hold so a scroll gesture isn't read as a
  // drag, while a mouse should start dragging as soon as it moves a little.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const next = placeRow(rows, String(active.id), String(over.id));
    if (next === rows) return;

    setRows(next);

    const order = readOrderFromRows(
      next.map((row) => ({
        kind: row.kind,
        id: row.id,
        category: row.kind === 'heading' ? row.category : row.exercise.category,
      })),
      showHeadings,
    );

    const body = new FormData();
    body.append('workoutId', workoutId);
    body.append('order', JSON.stringify(order));
    startTransition(async () => {
      await reorder(body);
    });
  }

  const exerciseIds = rows.filter((r) => r.kind === 'exercise').map((r) => r.id);

  return (
    <DndContext
      // Without a fixed id, dnd-kit numbers its accessibility descriptions
      // from a module counter that starts over on the client — the ids then
      // disagree with the server HTML and hydration fails outright.
      id="exercise-reorder"
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={exerciseIds} strategy={verticalListSortingStrategy}>
        <ul className="relative mt-4 flex flex-col gap-2">
          {rows.map((row) =>
            row.kind === 'heading' ? (
              <HeadingItem key={row.id} id={row.id} isEmpty={row.isEmpty}>
                <SectionHeading
                  workoutId={workoutId}
                  category={row.category}
                  heading={row.heading}
                  isEmpty={row.isEmpty}
                  index={row.index}
                  count={row.count}
                  suggestions={suggestions}
                  rename={rename}
                  removeSection={removeSection}
                  moveSection={moveSection}
                />
              </HeadingItem>
            ) : (
              <SortableExercise
                key={row.id}
                exercise={row.exercise}
                remove={remove}
              />
            ),
          )}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

/**
 * A heading row that exercises can be dropped onto. Sortable items can't be
 * dropped onto a plain heading, so an empty section would be unreachable
 * without registering the heading as a drop target in its own right.
 */
function HeadingItem({
  id,
  isEmpty,
  children,
}: {
  id: string;
  isEmpty: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <li ref={setNodeRef} className="mt-4 mb-1 first:mt-0">
      {children}
      {isEmpty && (
        <p
          className={`mt-2 rounded-xl2 border-2 border-dashed p-4 text-center text-sm transition ${
            isOver ? 'border-brand text-ink' : 'border-line text-muted'
          }`}
        >
          Drag an exercise here, or add one below.
        </p>
      )}
    </li>
  );
}

function SortableExercise({
  exercise,
  remove,
}: {
  exercise: Exercise;
  remove: (formData: FormData) => Promise<void>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: exercise.id,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`card relative flex touch-manipulation items-center gap-2 p-3 ${
        isDragging ? 'z-20 border-brand opacity-90 shadow-xl shadow-brand/20' : ''
      }`}
    >
      {/* Drag only starts from the handle, so the list still scrolls normally
          when a thumb lands anywhere else on the row. */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${exercise.name}`}
        className="flex h-11 w-7 shrink-0 cursor-grab touch-none items-center justify-center text-lg text-muted active:cursor-grabbing hover:text-ink"
      >
        ⠿
      </button>

      <MediaThumb
        mediaType={exercise.media_type}
        url={exercise.media_url}
        name={exercise.name}
      />

      <Link href={`/admin/exercise/${exercise.id}`} className="min-w-0 flex-1 py-1">
        <p className="font-bold">{exercise.name}</p>
        <p className="text-sm text-muted">
          {setsLabel(exercise)}
          {exercise.equipment && <> &middot; {exercise.equipment}</>}
          {exercise.media_type === 'none' && (
            <span className="ml-2 whitespace-nowrap text-brand">no video</span>
          )}
        </p>
      </Link>

      <form action={remove} className="shrink-0">
        <input type="hidden" name="exerciseId" value={exercise.id} />
        <DeleteExerciseButton name={exercise.name} />
      </form>
    </li>
  );
}


/**
 * Section headings are free text and renameable in place. Renaming moves every
 * exercise in that section across, so the list doesn't reshuffle underneath.
 */
function SectionHeading({
  workoutId,
  category,
  heading,
  isEmpty,
  index,
  count,
  suggestions,
  rename,
  removeSection,
  moveSection,
}: {
  workoutId: string;
  category: string;
  heading: string;
  isEmpty: boolean;
  /** Position among the movable sections, and how many there are. */
  index: number;
  count: number;
  suggestions: string[];
  rename: (formData: FormData) => Promise<void>;
  removeSection: (formData: FormData) => Promise<void>;
  moveSection: (formData: FormData) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="group flex items-center gap-2 text-sm font-bold tracking-widest text-brand uppercase"
        >
          {heading}
          {/* Always shown, not on hover: there is no hover on a phone, and
              nothing else says the heading can be tapped. */}
          <span aria-hidden className="text-xs tracking-normal text-muted normal-case">
            rename
          </span>
        </button>

        {/* Whole sections move a step at a time rather than by dragging: a
            section can be taller than the screen, and tapping an arrow beats
            dragging a ten-row block past its neighbours on a phone. */}
        {category && count > 1 && (
          <span className="flex items-center">
            <MoveSectionButton
              workoutId={workoutId}
              category={category}
              direction="up"
              disabled={index === 0}
              moveSection={moveSection}
            />
            <MoveSectionButton
              workoutId={workoutId}
              category={category}
              direction="down"
              disabled={index === count - 1}
              moveSection={moveSection}
            />
          </span>
        )}

        {/* Only empty sections can be removed, so this can't orphan anything. */}
        {isEmpty && category && (
          <form action={removeSection}>
            <input type="hidden" name="workoutId" value={workoutId} />
            <input type="hidden" name="name" value={category} />
            <button
              type="submit"
              className="px-1 text-xs font-semibold text-muted normal-case hover:text-brand"
            >
              remove
            </button>
          </form>
        )}
      </div>
    );
  }

  return (
    <form
      action={rename}
      onSubmit={() => setEditing(false)}
      className="flex items-center gap-2"
    >
      <input type="hidden" name="workoutId" value={workoutId} />
      <input type="hidden" name="from" value={category} />
      <input
        name="to"
        defaultValue={category}
        list="section-names"
        autoFocus
        placeholder="e.g. Strength"
        aria-label="Section name"
        className="field max-w-56 py-2 text-sm"
      />
      <datalist id="section-names">
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <button type="submit" className="shrink-0 rounded-lg bg-brand px-3 py-2 text-sm font-bold text-canvas">
        Save
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        className="shrink-0 px-1 text-sm font-semibold text-muted hover:text-ink"
      >
        Cancel
      </button>
    </form>
  );
}

function MoveSectionButton({
  workoutId,
  category,
  direction,
  disabled,
  moveSection,
}: {
  workoutId: string;
  category: string;
  direction: 'up' | 'down';
  disabled: boolean;
  moveSection: (formData: FormData) => Promise<void>;
}) {
  return (
    <form action={moveSection}>
      <input type="hidden" name="workoutId" value={workoutId} />
      <input type="hidden" name="name" value={category} />
      <input type="hidden" name="direction" value={direction} />
      <button
        type="submit"
        disabled={disabled}
        aria-label={`Move ${category} ${direction}`}
        className="flex h-9 w-7 items-center justify-center text-base text-muted transition hover:text-ink disabled:opacity-25 disabled:hover:text-muted"
      >
        {direction === 'up' ? '↑' : '↓'}
      </button>
    </form>
  );
}
